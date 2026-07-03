import { App, Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import type GtdBookPlugin from "./main";
import { Book, STATUS_ORDER, Scene, SceneStatus } from "./model";

export interface CompileOptions {
  statuses: Set<SceneStatus>;
  chapterHeadings: boolean;
  separator: string;
}

export const DEFAULT_COMPILE: CompileOptions = {
  // All non-idea by default: an idea note is premise, not prose.
  statuses: new Set<SceneStatus>(["outlined", "drafting", "revising", "final"]),
  chapterHeadings: true,
  separator: "* * *",
};

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n?/;
const GTD_BLOCK_RE = /^```gtd-scene[^\n]*\n[\s\S]*?\n?```[ \t]*\n?/m;

// Remove a `## Heading` section: the heading line through (not including)
// the next heading of the same or higher level.
function stripSection(body: string, heading: string): string {
  const re = new RegExp(`^## ${heading}[ \\t]*$`, "m");
  const m = body.match(re);
  if (!m || m.index == null) return body;
  const rest = body.slice(m.index + m[0].length);
  const next = rest.match(/^#{1,2} /m);
  const end = next?.index != null ? m.index + m[0].length + next.index : body.length;
  return body.slice(0, m.index) + body.slice(end);
}

function extractSection(body: string, heading: string): string | null {
  const re = new RegExp(`^## ${heading}[ \\t]*$`, "m");
  const m = body.match(re);
  if (!m || m.index == null) return null;
  const rest = body.slice(m.index + m[0].length);
  const next = rest.match(/^#{1,2} /m);
  return (next?.index != null ? rest.slice(0, next.index) : rest).trim();
}

// Scene note content → prose. Strips frontmatter, the gtd-scene block, and
// Beats; prefers the `## Draft` section, else whatever remains.
export function sceneProse(content: string): string {
  let body = content.replace(FRONTMATTER_RE, "").replace(GTD_BLOCK_RE, "");
  const draft = extractSection(body, "Draft");
  if (draft != null) return draft;
  body = stripSection(body, "Beats");
  return body.trim();
}

export interface CompiledScene {
  scene: Scene;
  prose: string;
}

export function compileBook(
  book: Book,
  proseOf: (scene: Scene) => string,
  opts: CompileOptions,
): string {
  const parts: string[] = [`# ${book.title}`];
  for (const chapter of book.chapters) {
    const included = chapter.scenes.filter(
      (s) => s.status != null && opts.statuses.has(s.status),
    );
    const pieces = included
      .map((s) => ({ scene: s, prose: proseOf(s) }))
      .filter((p) => p.prose.length > 0);
    if (pieces.length === 0) continue;
    if (opts.chapterHeadings) parts.push(`## ${chapter.name}`);
    parts.push(pieces.map((p) => p.prose).join(`\n\n${opts.separator}\n\n`));
  }
  return parts.join("\n\n") + "\n";
}

class CompileModal extends Modal {
  private plugin: GtdBookPlugin;
  private book: Book;
  private opts: CompileOptions;

  constructor(plugin: GtdBookPlugin, book: Book) {
    super(plugin.app);
    this.plugin = plugin;
    this.book = book;
    this.opts = {
      statuses: new Set(DEFAULT_COMPILE.statuses),
      chapterHeadings: DEFAULT_COMPILE.chapterHeadings,
      separator: DEFAULT_COMPILE.separator,
    };
  }

  onOpen(): void {
    this.titleEl.setText(`Compile "${this.book.title}"`);

    new Setting(this.contentEl)
      .setName("Include statuses")
      .setDesc("Scenes whose pipeline status is checked are compiled.");
    for (const s of STATUS_ORDER) {
      new Setting(this.contentEl).setName(s).addToggle((t) =>
        t.setValue(this.opts.statuses.has(s)).onChange((v) => {
          if (v) this.opts.statuses.add(s);
          else this.opts.statuses.delete(s);
        }),
      );
    }

    new Setting(this.contentEl).setName("Chapter headings").addToggle((t) =>
      t.setValue(this.opts.chapterHeadings).onChange((v) => (this.opts.chapterHeadings = v)),
    );

    new Setting(this.contentEl)
      .setName("Scene separator")
      .addText((t) =>
        t.setValue(this.opts.separator).onChange((v) => (this.opts.separator = v)),
      );

    new Setting(this.contentEl).addButton((b) =>
      b.setButtonText("Compile").setCta().onClick(() => {
        this.close();
        void runCompile(this.plugin, this.book, this.opts);
      }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

async function runCompile(
  plugin: GtdBookPlugin,
  book: Book,
  opts: CompileOptions,
): Promise<void> {
  const app = plugin.app;
  const prose = new Map<string, string>();
  for (const chapter of book.chapters) {
    for (const scene of chapter.scenes) {
      const f = app.vault.getAbstractFileByPath(scene.path);
      if (f instanceof TFile) prose.set(scene.path, sceneProse(await app.vault.read(f)));
    }
  }
  const out = compileBook(book, (s) => prose.get(s.path) ?? "", opts);

  const notesFolder = `${book.folderPath}/${plugin.settings.reserved.notes}`;
  if (!app.vault.getAbstractFileByPath(normalizePath(notesFolder))) {
    await app.vault.createFolder(normalizePath(notesFolder));
  }
  const date = new Date().toISOString().slice(0, 10);
  const path = normalizePath(`${notesFolder}/${book.title} — compiled ${date}.md`);

  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, out); // same-day recompile overwrites
  } else {
    await app.vault.create(path, out);
  }
  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) await app.workspace.getLeaf(false).openFile(file);
  new Notice(`Compiled ${book.title}.`);
}

export function openCompileModal(plugin: GtdBookPlugin, book: Book): void {
  new CompileModal(plugin, book).open();
}
