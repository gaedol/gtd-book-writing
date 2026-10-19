# GTD Book Writing

Write books the GTD way, inside Obsidian.

Most writing tools measure a manuscript by word count. GTD measures a project by its **next action**. This plugin applies that lens to a book: every scene has a status, a resolvable next action, and — when it doesn't — the plugin tells you. The question it answers is not "how many words have I written" but "what can I actually sit down and work on right now."

## Why

Scrivener gives you a binder. Plottr gives you a timeline. StoryLine and Novelcrafter give you a story bible. None of them ask the question a stuck writer actually has: *what's next, and what's workable today.* That's the gap this plugin fills — nothing more.

It deliberately does **not** do codex/relationship management, ebook or print formatting, or AI generation. Other tools already do those well; adding them here would just be StoryLine with extra steps.

## Features

- **Available now** — the list of scenes you can actually work on, given their status, defer date, and (for sequential chapters) what's already finished ahead of them. Flagged scenes float to the top. A pacing strip shows words-to-go and days-to-deadline.
- **Manuscript** — the ordered chapter/scene tree, with word counts and status at a glance. Drag to reorder chapters and scenes; order is stored in the book's index note, so your folders never need renaming.
- **Review** — a weekly-review checklist in the GTD tradition: chapters that have gone untouched, scenes due soon, stale flags, and contexts with nothing available. Stalled scenes (no resolvable next action — the one state this plugin treats as an error) are listed front and center.
- **Forecast** — a timeline of deferred and due scenes, plus the book deadline.
- **Scene card** — an interactive header at the top of every scene note: click through statuses, see exactly where your next action came from (an explicit task always overrides the status default), toggle a flag, and check beats off inline.
- **Compile** — stitch scenes into a single manuscript document, in order, filtered by status, with configurable chapter headings and separators.
- **Scaffolding commands** — `New book`, `New chapter`, `New scene`, `New material note` build the folder structure and starter frontmatter for you. You never hand-build a note.

## How a book is structured

A book is a folder containing a note with `type: book` frontmatter — that's the only thing the plugin needs to recognize it, no configuration required. Everything else is plain Markdown that works with or without the plugin installed.

```
My Novel/
├── My Novel.md          ← index note (type: book, deadline, order)
├── Manuscript/           ← chapters (folders) and scenes (notes) — the only tracked part
│   ├── 01 Arrival/
│   │   ├── At the dock.md
│   │   └── The inn.md
│   └── 02 Threads/
│       └── The market.md
├── Characters/           ← per-book material folder — call it whatever you want
├── Locations/
└── Research/
```

Only `Manuscript/` and a `Notes/` folder (where Compile writes its output) are structural. Every other folder — `Characters/`, `Locations/`, `Concepts/`, `Sources/`, anything — is declared per book via a `materials:` list in the index note, so a novel and a technical manual can have completely different supporting structure in the same vault.

## The GTD model

- A **scene** is the atomic unit — the smallest thing the plugin tracks. Finer detail lives as ordinary `- [ ]` checkboxes inside the scene ("beats"); the first open one becomes the scene's next action.
- **Status** (`idea → outlined → drafting → revising → final`) always yields a default next action ("outline this scene", "draft this scene", …).
- An **explicit task always wins** over the derived default. A scene is "stalled" only when it has neither — that's the signal the Review tab surfaces.
- **Available now** hides anything deferred, anything blocked by an earlier unfinished scene in a sequential chapter, and anything already final. What's left is genuinely workable today.

Full usage guide: [MANUAL.md](MANUAL.md) — setup, the scene card, the panel, and a "what do I do if I want…" cookbook.

## Installation

Not yet in the community plugin catalog. Manual install:

```bash
git clone https://github.com/<you>/gtd-book-writing
cd gtd-book-writing
npm install
npm run build
```

Then symlink (or copy) the folder into your vault:

```bash
ln -s /path/to/gtd-book-writing "/path/to/YourVault/.obsidian/plugins/gtd-book-writing"
```

Enable **GTD Book Writing** under Settings → Community plugins.

## Status

v1 feature-complete, including compile. Actively dogfooded — this plugin's own manual is written as a book inside it (see `sample-vault/`).

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).
