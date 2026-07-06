#!/usr/bin/env python3
"""Convert a GTD Book Writing book folder (or a compiled .md) to EPUB via pandoc.

Usage:
  md2epub.py <book-folder> [-o out.epub] [--statuses drafting,revising,final]
             [--author "Name"] [--manuscript-folder Manuscript] [--all]
  md2epub.py <compiled.md> [-o out.epub] [--author "Name"] [--title "Title"]

Book-folder mode mirrors the plugin's Compile command:
- book = folder containing a note with `type: book` frontmatter (the index)
- chapters = folders under Manuscript/ (an extra Act layer is flattened)
- scene order: filename order, overridden by `chapterOrder` / `sceneOrder` in the index
- each scene: frontmatter, the ```gtd-scene``` block, and the '## Beats' section are
  stripped; if a '## Draft' section exists, only its prose is kept
- scenes whose `status` is not in --statuses are skipped (default: outlined,
  drafting, revising, final — i.e. everything past idea; --all includes everything)
"""

import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path

FRONTMATTER_RE = re.compile(r"^﻿?\s*---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?")
GTD_BLOCK_RE = re.compile(r"^```gtd-scene[^\n]*\n[\s\S]*?\n?```[ \t]*\n?", re.M)
DEFAULT_STATUSES = {"outlined", "drafting", "revising", "final"}


def parse_frontmatter(text: str) -> dict:
    """Minimal YAML subset: scalars, inline lists, block lists, one-level maps."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    fm: dict = {}
    key = None
    subkey_parent = None
    for raw in m.group(1).splitlines():
        if not raw.strip() or raw.strip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip())
        line = raw.strip()
        if line.startswith("- ") and key:
            target = fm[subkey_parent] if indent > 2 and subkey_parent else fm
            if isinstance(target.get(key), list):
                target[key].append(line[2:].strip())
            continue
        if ":" in line:
            k, _, v = line.partition(":")
            k, v = k.strip(), v.strip()
            if indent == 0:
                subkey_parent = None
                if v == "":
                    fm[k] = []  # may become list or map container
                    key = k
                elif v.startswith("[") and v.endswith("]"):
                    fm[k] = [x.strip() for x in v[1:-1].split(",") if x.strip()]
                    key = k
                else:
                    fm[k] = v.strip("\"'")
                    key = k
            else:
                # one-level nested map (e.g. sceneOrder)
                parent = key
                if not isinstance(fm.get(parent), dict):
                    if fm.get(parent) == []:
                        fm[parent] = {}
                    else:
                        continue
                if v.startswith("[") and v.endswith("]"):
                    fm[parent][k] = [x.strip() for x in v[1:-1].split(",") if x.strip()]
                else:
                    fm[parent][k] = [] if v == "" else v.strip("\"'")
                subkey_parent = parent
                key = k
    return fm


def strip_section(body: str, heading: str) -> str:
    m = re.search(rf"^## {heading}[ \t]*$", body, re.M)
    if not m:
        return body
    rest = body[m.end():]
    nxt = re.search(r"^#{1,2} ", rest, re.M)
    end = m.end() + nxt.start() if nxt else len(body)
    return body[: m.start()] + body[end:]


def extract_section(body: str, heading: str):
    m = re.search(rf"^## {heading}[ \t]*$", body, re.M)
    if not m:
        return None
    rest = body[m.end():]
    nxt = re.search(r"^#{1,2} ", rest, re.M)
    return (rest[: nxt.start()] if nxt else rest).strip()


def scene_prose(text: str) -> str:
    body = FRONTMATTER_RE.sub("", text)
    body = GTD_BLOCK_RE.sub("", body)
    draft = extract_section(body, "Draft")
    if draft is not None:
        return draft
    return strip_section(body, "Beats").strip()


def ordered(items, names, name_of):
    idx = {n: i for i, n in enumerate(names or [])}
    big = len(items) + len(idx) + 1
    return [
        x for _, _, x in sorted(
            (idx.get(name_of(it), big), i, it) for i, it in enumerate(items)
        )
    ]


def find_index(book_dir: Path):
    for p in sorted(book_dir.glob("*.md")):
        fm = parse_frontmatter(p.read_text(encoding="utf-8"))
        if fm.get("type") == "book":
            return p, fm
    return None, {}


def collect_chapters(manuscript: Path):
    """Yield (chapter_name, [scene files]) — folders with .md files are chapters;
    folders containing only subfolders are Acts whose children are chapters."""
    for entry in sorted(manuscript.iterdir()):
        if not entry.is_dir() or entry.name.startswith(("_", ".")):
            continue
        mds = sorted(entry.glob("*.md"))
        if mds:
            yield entry.name, mds
        else:
            for ch in sorted(e for e in entry.iterdir() if e.is_dir()):
                sc = sorted(ch.glob("*.md"))
                if sc:
                    yield ch.name, sc


def build_book_md(book_dir: Path, statuses, manuscript_name: str) -> tuple[str, dict]:
    index_path, fm = find_index(book_dir)
    if not index_path:
        sys.exit(f"error: no note with 'type: book' frontmatter in {book_dir}")
    title = fm.get("title") or index_path.stem
    manuscript = book_dir / manuscript_name
    if not manuscript.is_dir():
        sys.exit(f"error: no {manuscript_name}/ folder in {book_dir}")

    chapter_order = fm.get("chapterOrder") or []
    scene_order = fm.get("sceneOrder") or {}
    chapters = ordered(list(collect_chapters(manuscript)), chapter_order, lambda c: c[0])

    parts = []
    for ch_name, scenes in chapters:
        scenes = ordered(scenes, scene_order.get(ch_name, []), lambda p: p.stem)
        pieces = []
        for path in scenes:
            text = path.read_text(encoding="utf-8")
            sfm = parse_frontmatter(text)
            if statuses is not None and sfm.get("status") not in statuses:
                continue
            prose = scene_prose(text)
            if prose:
                pieces.append(prose)
        if pieces:
            heading = re.sub(r"^\d+\s+", "", ch_name)  # drop numeric prefix
            parts.append(f"# {heading}\n\n" + "\n\n* * *\n\n".join(pieces))
    return "\n\n".join(parts) + "\n", fm


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("source", help="book folder or compiled .md file")
    ap.add_argument("-o", "--output", help="output .epub path")
    ap.add_argument("--statuses", help="comma-separated statuses to include")
    ap.add_argument("--all", action="store_true", help="include every scene regardless of status")
    ap.add_argument("--author", default="", help="author metadata")
    ap.add_argument("--title", help="title override (md mode; folder mode uses the index)")
    ap.add_argument("--manuscript-folder", default="Manuscript")
    args = ap.parse_args()

    src = Path(args.source).expanduser()
    if not src.exists():
        sys.exit(f"error: {src} not found")

    statuses = None if args.all else (
        {s.strip() for s in args.statuses.split(",")} if args.statuses else DEFAULT_STATUSES
    )

    if src.is_dir():
        body, fm = build_book_md(src, statuses, args.manuscript_folder)
        title = args.title or fm.get("title") or src.name
        out = Path(args.output) if args.output else src / f"{title}.epub"
    else:
        text = src.read_text(encoding="utf-8")
        body = FRONTMATTER_RE.sub("", text)
        title = args.title or src.stem
        out = Path(args.output) if args.output else src.with_suffix(".epub")

    meta = ["-M", f"title={title}"]
    if args.author:
        meta += ["-M", f"author={args.author}"]

    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as tf:
        tf.write(body)
        tmp = tf.name
    try:
        subprocess.run(
            ["pandoc", tmp, "-f", "markdown", "-t", "epub3",
             "--toc", "--toc-depth=1", "--split-level=1", *meta, "-o", str(out)],
            check=True,
        )
    finally:
        Path(tmp).unlink(missing_ok=True)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
