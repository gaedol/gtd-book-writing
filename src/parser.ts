import { App, TFile, TFolder } from "obsidian";
import {
  Book,
  Chapter,
  ReservedNames,
  Scene,
  isSceneStatus,
} from "./model";

const OPEN_TASK_RE = /^[ \t]*[-*] \[ \] (.+)$/m;
const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n?/;

function normalizeDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return null;
}

function normalizeContexts(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : v != null ? [v] : [];
  return raw
    .map((x) => String(x).trim().replace(/^@/, ""))
    .filter((x) => x.length > 0);
}

function countWords(body: string): number {
  const m = body.match(/\S+/g);
  return m ? m.length : 0;
}

async function parseScene(
  app: App,
  file: TFile,
  chapterName: string,
): Promise<Scene> {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  const content = await app.vault.cachedRead(file);
  const body = content.replace(FRONTMATTER_RE, "");

  const statusRaw = fm.status;
  const taskMatch = body.match(OPEN_TASK_RE);

  return {
    path: file.path,
    title: file.basename,
    status: isSceneStatus(statusRaw) ? statusRaw : null,
    contexts: normalizeContexts(fm.context),
    defer: normalizeDate(fm.defer),
    due: normalizeDate(fm.due),
    flagged: fm.flagged === true,
    wordGoal: typeof fm.wordGoal === "number" ? fm.wordGoal : null,
    words: countWords(body),
    firstOpenTask: taskMatch ? taskMatch[1].trim() : null,
    chapterName,
    mtime: file.stat.mtime,
  };
}

interface OrderSpec {
  chapters: string[];
  scenes: Record<string, string[]>;
}

// Stable sort: items named in `names` come first in that order; the rest keep
// their incoming (filename) order. Unknown names are ignored, so the list
// self-heals when files are added or removed.
function ordered<T>(items: T[], names: string[], nameOf: (t: T) => string): T[] {
  const idx = new Map(names.map((n, i) => [n, i] as const));
  const big = Number.MAX_SAFE_INTEGER;
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const ia = idx.get(nameOf(a.item)) ?? big;
      const ib = idx.get(nameOf(b.item)) ?? big;
      return ia - ib || a.i - b.i;
    })
    .map((x) => x.item);
}

function childFolders(folder: TFolder): TFolder[] {
  return folder.children
    .filter((c): c is TFolder => c instanceof TFolder && !c.name.startsWith("_"))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function childMarkdown(folder: TFolder): TFile[] {
  return folder.children
    .filter((c): c is TFile => c instanceof TFile && c.extension === "md")
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function parseChapter(
  app: App,
  folder: TFolder,
  actName: string | null,
  sequentialNames: Set<string>,
  order: OrderSpec,
): Promise<Chapter> {
  const sceneFiles = childMarkdown(folder);
  const scenes: Scene[] = [];
  for (const f of sceneFiles) {
    scenes.push(await parseScene(app, f, folder.name));
  }
  return {
    path: folder.path,
    name: folder.name,
    actName,
    sequential: sequentialNames.has(folder.name),
    scenes: ordered(scenes, order.scenes[folder.name] ?? [], (s) => s.title),
  };
}

// A folder under Manuscript/ with markdown files is a chapter;
// a folder with only subfolders is an Act whose subfolders are chapters.
async function parseManuscript(
  app: App,
  manuscript: TFolder,
  sequentialNames: Set<string>,
  order: OrderSpec,
): Promise<Chapter[]> {
  const chapters: Chapter[] = [];
  for (const entry of childFolders(manuscript)) {
    const hasScenes = childMarkdown(entry).length > 0;
    if (hasScenes) {
      chapters.push(await parseChapter(app, entry, null, sequentialNames, order));
    } else {
      for (const chFolder of childFolders(entry)) {
        chapters.push(
          await parseChapter(app, chFolder, entry.name, sequentialNames, order),
        );
      }
    }
  }
  return ordered(chapters, order.chapters, (c) => c.name);
}

export async function parseSceneByPath(
  app: App,
  path: string,
): Promise<Scene | null> {
  const f = app.vault.getAbstractFileByPath(path);
  if (!(f instanceof TFile)) return null;
  return parseScene(app, f, f.parent?.name ?? "");
}

export async function buildBooks(
  app: App,
  reserved: ReservedNames,
): Promise<Book[]> {
  const books: Book[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm || fm.type !== "book") continue;

    const bookFolder = file.parent;
    if (!bookFolder) continue;

    const manuscript = app.vault.getAbstractFileByPath(
      `${bookFolder.path}/${reserved.manuscript}`,
    );
    const sequentialNames = new Set<string>(
      normalizeContexts(fm.sequential),
    );

    const order: OrderSpec = {
      chapters: Array.isArray(fm.chapterOrder) ? fm.chapterOrder.map(String) : [],
      scenes:
        fm.sceneOrder && typeof fm.sceneOrder === "object" ? fm.sceneOrder : {},
    };

    const chapters =
      manuscript instanceof TFolder
        ? await parseManuscript(app, manuscript, sequentialNames, order)
        : [];

    books.push({
      folderPath: bookFolder.path,
      indexPath: file.path,
      title: typeof fm.title === "string" ? fm.title : file.basename,
      deadline: normalizeDate(fm.deadline),
      dailyTarget: typeof fm.dailyTarget === "number" ? fm.dailyTarget : null,
      lastReview: normalizeDate(fm.lastReview),
      chapters,
    });
  }
  return books;
}
