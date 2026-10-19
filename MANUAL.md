# GTD Book Writing — Manual

A plugin that applies GTD (Getting Things Done) to writing a book. Instead of measuring your manuscript only by word count, it answers the question a stuck writer actually has: **what can I work on right now, and what has quietly stalled?**

Everything is plain Markdown with YAML frontmatter. The plugin reads and lightly annotates your notes; it never locks you into a proprietary format, and your book works with or without it installed.

---

## 1. Concepts

- **Book** — a folder containing one note with `type: book` in its frontmatter (the *index note*). That marker is all the plugin needs to recognise a book; no configuration required.
- **Manuscript** — the `Manuscript/` folder inside a book. Only this folder is *tracked*. Chapters are sub-folders; scenes are the notes inside them.
- **Scene** — a single note: the atomic unit of work. It carries a status, and the plugin resolves a *next action* for it.
- **Status pipeline** — every scene moves through five stages: `idea → outlined → drafting → revising → final`.
- **Next action** — the one concrete thing to do next on a scene. It is *derived* from the status (`outlined` → "Draft this scene"), unless you write an explicit task, which takes over.
- **Beats** — ordinary `- [ ]` checkboxes inside a scene. The first unchecked beat becomes the scene's next action. Beats are not tracked individually — they keep your Available Now list short.
- **Context** — a GTD tag (`@draft`, `@research`, `@revise`…) describing the *mode* of work.
- **Defer / due** — a scene can be deferred (not workable before a date) and given a due date (a real deadline).
- **Flag** — mark a scene as today's focus; flagged scenes float to the top of Available Now.
- **Sequential chapter** — a chapter whose scenes must be finished in order. A scene in it is blocked until every earlier scene is `final`.
- **Material folders** — per-book supporting folders (Characters, Locations, Research, Concepts… — whatever each book declares). Not tracked; just organised.

### Frontmatter reference

On a **scene note**:

```yaml
status: drafting          # idea | outlined | drafting | revising | final
context: [draft]          # @-modes, without the @
defer: 2026-07-01         # optional — not workable before this date
due: 2026-09-30           # optional — deadline
flagged: true             # optional — today's focus
wordGoal: 2000            # optional — target, drives pacing
```

On the **index note** (`type: book`):

```yaml
type: book
title: My Novel
deadline: 2026-09-30      # optional — drives pacing
dailyTarget: 800          # optional
sequential: [01 Arrival]  # chapters whose scenes must be done in order
materials: [Characters, Locations, Research]
# managed by the plugin when you drag-reorder:
# chapterOrder: [...]
# sceneOrder: { "01 Arrival": [...] }
# lastReview: 2026-07-05
```

---

## 2. Setup

### Install (until it is in the community catalogue)

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [release](https://github.com/gaedol/gtd-book-writing/releases).
2. Put them in `<your vault>/.obsidian/plugins/gtd-book-writing/`.
3. Enable **GTD Book Writing** under *Settings → Community plugins*.

(Or clone the repo, `npm install`, `npm run build`, and symlink the folder into `.obsidian/plugins/`.)

### Create your first book

Run the command **New book** (from the command palette). The plugin scaffolds:

```
My Novel/
├── My Novel.md          ← index note (type: book)
├── Manuscript/          ← the tracked part
├── Characters/          ← material folders (from your defaults)
├── Locations/
└── Research/
```

Then **New chapter** creates a numbered chapter folder, and **New scene** (run from inside a chapter) creates a scene note pre-filled with a scene card, a Beats section, and a Draft heading.

### Open the panel

Click the book icon in the ribbon, or run **Open GTD book panel**. It opens in the right sidebar with four tabs (below).

---

## 3. The scene card

Every scene note carries a fenced ` ```gtd-scene ` block at the top. The plugin renders it as an interactive card:

- **Status control** — click a stage to move the scene along the pipeline.
- **Next-action banner** — shows the resolved next action and where it came from ("from your task list" vs "derived from status"). Turns into a *stalled* warning when there is neither.
- **Status suggestion** — when your word count crosses a threshold (e.g. words appear on an `outlined` scene), the card *suggests* advancing the status. It never changes anything on its own — one click applies it.
- **Metadata row** — contexts, defer, due, a flag toggle, and word progress.
- **Beats** — your checkboxes, clickable; the first open one is marked `next`.

To add the card to an older note, run **Insert scene card in current note**.

---

## 4. The panel

**Available now** — the scenes you can actually sit down and work on, given status, defer dates, and sequential blocking. Flagged scenes float to the top. A pacing strip shows words-to-go, days left, and the pace you need. Scenes that are deferred, blocked, or final are hidden on purpose.

**Manuscript** — the ordered chapter/scene tree, with status dots, word counts, and `blocked`/`stalled` markers. Drag the ⠿ grips to reorder scenes within a chapter (or chapters, when the book has no Act layer); the new order is written to the index note, so your folders never need renaming. A **Compile** button sits at the bottom.

**Review** — your weekly review. Lists stalled scenes (no resolvable next action — the one state treated as an error), plus a checklist: chapters untouched for over a week, scenes due soon or overdue, flagged-but-untouched scenes, and contexts with nothing available. **Mark review done** stamps the date; the header nudges you once a week has passed.

**Forecast** — a timeline of dated scenes (defer = becomes available, due = deadline) plus the book deadline. Each scene appears once; a due date wins over a defer date.

---

## 5. Compile

**Compile manuscript** (command, or the button in the Manuscript tab) stitches your scenes — in order — into a single note in the `Notes/` folder (`<title> — compiled <date>.md`). In the options dialog you choose which statuses to include (default: everything past `idea`), whether chapters get headings, and the scene separator. Frontmatter, the scene card, and the Beats section are stripped; if a scene has a `## Draft` section, only that prose is taken.

For EPUB, the repo ships `scripts/md2epub.py` (needs [pandoc](https://pandoc.org/)): `python3 scripts/md2epub.py "path/to/My Novel"`.

---

## 6. Settings

Two **structural folders** are global (renameable, e.g. for localisation): `Manuscript/` (tracked) and `Notes/` (compile output). Everything else is a per-book **material folder**, declared in each book's `materials:`. The settings tab's "Defaults for new books" only seeds newly created books.

---

## 7. "What do I do if I want…"

Real cases, with the exact move.

### …to know what to write today?
Open the panel → **Available now**. Work the top item. Flag (★ on the scene card, or the metadata row) the one or two scenes you want to prioritise — they jump to the top.

### …to start a scene but I'm not ready to draft it?
Create it (**New scene**) and leave the status at `idea`. Its next action becomes "Outline this scene." Jot structure under Beats or an `## Outline` heading. When you've outlined, click `outlined` on the card.

### …a specific next step that isn't just "keep drafting"?
Add a checkbox inside the scene: `- [ ] check the 1890s train schedule`. That explicit beat *overrides* the status-derived action and shows up as the scene's next action everywhere. Finish it and the next open beat takes over.

### …to stop a half-finished chapter from silently dying?
Check the **Review** tab. A scene with no status (or otherwise no resolvable next action) shows as **stalled** — give it a status or a beat. The checklist also flags chapters you haven't touched in over a week.

### …to work on scenes in a strict order (no drafting chapter 3 before chapter 2)?
In the index note, add the chapter to `sequential:`, e.g. `sequential: [01 Arrival]`. Scenes after an unfinished one are marked `blocked` and hidden from Available Now until the earlier scenes are `final`.

### …to leave scenes parallel (write them in any order)?
Do nothing — chapters are parallel by default. Only chapters listed in `sequential:` enforce order.

### …to not see a scene until later (it depends on something first)?
Set `defer: 2026-08-01` in its frontmatter (or use the card's metadata). It stays hidden from Available Now and appears in Forecast under that date, surfacing when the date arrives.

### …to track a deadline and know if I'm on pace?
Put `deadline:` on the index note and `wordGoal:` on your scenes. The **Available now** pacing strip computes words-to-go ÷ days-left. The deadline also appears in **Forecast**.

### …to reorder scenes or chapters?
Drag the ⠿ grips in the **Manuscript** tab. The order is saved to `sceneOrder` / `chapterOrder` in the index note — no files are renamed or moved. (You can also edit those fields by hand.)

### …to group chapters into Acts?
Add a folder layer under `Manuscript/`: a folder that contains chapter *folders* (not scenes) is treated as an Act. The plugin never creates Acts for you; nest them yourself when you want them.

### …a story bible — characters, locations, lore?
Keep them as ordinary notes in your material folders and link with `[[wikilinks]]`. Declare the folders you want in the book's `materials:` (a novel might use `[Characters, Locations, Research]`; a manual `[Concepts, Terminology]`). Run **New material note** to file one in the right place. For rich codex/relationship/timeline features, pair this plugin with a dedicated writing plugin — this one deliberately stays the "what do I do next" layer and reads the same notes.

### …different supporting folders for a non-fiction book vs a novel?
Materials are per-book. Set each book's `materials:` independently — they don't have to match, even in the same vault.

### …to produce a manuscript to send to a reader or editor?
**Compile manuscript** → pick the statuses to include (e.g. `drafting` and up) → it writes a single note to `Notes/`. For a `.epub`, run `scripts/md2epub.py` on the book folder.

### …to retrofit an existing note so the scene card appears?
Open it and run **Insert scene card in current note**. It adds the ` ```gtd-scene ` block after any existing frontmatter.

### …to write "books and the like" that aren't novels (a manual, a thesis)?
Same model. Chapters are sections; scenes are sub-sections; statuses track drafting state all the same. Rename material folders to fit (`Concepts`, `Sources`, `Figures`). The plugin's own documentation is maintained this way.

### …to be sure the plugin won't mangle my notes?
It only writes the frontmatter keys it owns (status, flag, order, review date) and never deletes your content. Unknown frontmatter keys and other plugins' metadata are left untouched.
