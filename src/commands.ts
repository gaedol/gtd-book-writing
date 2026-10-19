import {
  App,
  FuzzySuggestModal,
  Modal,
  Notice,
  Setting,
  TFolder,
  normalizePath,
} from "obsidian";
import type GtdBookPlugin from "./main";
import { Book } from "./model";
import { openCompileModal } from "./compile";

class PromptModal extends Modal {
  private value = "";
  private onSubmit: (value: string) => void | Promise<void>;
  private title: string;
  private placeholder: string;

  constructor(app: App, title: string, placeholder: string, onSubmit: (value: string) => void | Promise<void>) {
    super(app);
    this.title = title;
    this.placeholder = placeholder;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    this.titleEl.setText(this.title);
    new Setting(this.contentEl).addText((t) => {
      t.setPlaceholder(this.placeholder);
      t.inputEl.setCssStyles({ width: "100%" });
      t.onChange((v) => (this.value = v));
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.submit();
      });
      window.setTimeout(() => t.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).addButton((b) =>
      b.setButtonText("Create").setCta().onClick(() => this.submit()),
    );
  }

  private submit(): void {
    const v = this.value.trim();
    if (v) {
      this.close();
      void this.onSubmit(v);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function sceneTemplate(): string {
  const fence = "```";
  return [
    "---",
    "status: idea",
    "context: [outline]",
    "wordGoal: 1000",
    "---",
    `${fence}gtd-scene`,
    fence,
    "",
    "## Beats",
    "",
    "- [ ] ",
    "",
    "## Draft",
    "",
    "",
  ].join("\n");
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const p = normalizePath(path);
  if (!app.vault.getAbstractFileByPath(p)) {
    await app.vault.createFolder(p);
  }
}

// Find the book folder (the folder holding a `type: book` note) that contains the given path.
async function bookFolderFor(plugin: GtdBookPlugin, path: string): Promise<string | null> {
  const books = await plugin.buildBooks();
  let best: string | null = null;
  for (const b of books) {
    if (path === b.folderPath || path.startsWith(b.folderPath + "/")) {
      if (!best || b.folderPath.length > best.length) best = b.folderPath;
    }
  }
  return best ?? (books.length === 1 ? books[0].folderPath : null);
}

class MaterialFolderModal extends FuzzySuggestModal<string> {
  private folders: string[];
  private onPick: (folder: string) => void;

  constructor(app: App, folders: string[], onPick: (folder: string) => void) {
    super(app);
    this.folders = folders;
    this.onPick = onPick;
    this.setPlaceholder("Which folder?");
  }

  getItems(): string[] {
    return this.folders;
  }
  getItemText(item: string): string {
    return item;
  }
  onChooseItem(item: string): void {
    this.onPick(item);
  }
}

export function registerCommands(plugin: GtdBookPlugin): void {
  const app = plugin.app;
  const structural = () => plugin.settings.structural;

  plugin.addCommand({
    id: "new-book",
    name: "New book",
    callback: () => {
      new PromptModal(app, "New book", "Title", async (title) => {
        const root = normalizePath(title);
        if (app.vault.getAbstractFileByPath(root)) {
          new Notice("A folder with that name already exists.");
          return;
        }
        const materials = plugin.settings.defaultMaterials;
        await ensureFolder(app, root);
        for (const sub of [
          structural().manuscript,
          structural().notes,
          ...materials,
        ]) {
          await ensureFolder(app, `${root}/${sub}`);
        }
        const index = `${root}/${title}.md`;
        const fm = [
          "---",
          "type: book",
          `title: ${title}`,
          "deadline:",
          "dailyTarget:",
          "sequential: []",
          `materials: [${materials.join(", ")}]`,
          "---",
          "",
          `# ${title}`,
          "",
        ].join("\n");
        const file = await app.vault.create(index, fm);
        await app.workspace.getLeaf(false).openFile(file);
        new Notice(`Created book "${title}".`);
      }).open();
    },
  });

  plugin.addCommand({
    id: "new-material-note",
    name: "New material note",
    callback: async () => {
      const active = app.workspace.getActiveFile();
      const bookFolder = active ? await bookFolderFor(plugin, active.path) : null;
      if (!bookFolder) {
        new Notice("Open a note inside a book first.");
        return;
      }
      const books = await plugin.buildBooks();
      const book = books.find((b: Book) => b.folderPath === bookFolder);
      const folders = [...(book?.materials ?? []), structural().notes];
      new MaterialFolderModal(app, folders, (folder) => {
        new PromptModal(app, `New note in ${folder}`, "Title", async (title) => {
          await ensureFolder(app, `${bookFolder}/${folder}`);
          const path = normalizePath(`${bookFolder}/${folder}/${title}.md`);
          if (app.vault.getAbstractFileByPath(path)) {
            new Notice("A note with that title already exists there.");
            return;
          }
          const file = await app.vault.create(path, `# ${title}\n\n`);
          await app.workspace.getLeaf(false).openFile(file);
          new Notice(`Created "${title}" in ${folder}.`);
        }).open();
      }).open();
    },
  });

  plugin.addCommand({
    id: "new-chapter",
    name: "New chapter",
    callback: async () => {
      const active = app.workspace.getActiveFile();
      const bookFolder = active ? await bookFolderFor(plugin, active.path) : null;
      if (!bookFolder) {
        new Notice("Open a note inside a book first.");
        return;
      }
      const manuscript = `${bookFolder}/${structural().manuscript}`;
      await ensureFolder(app, manuscript);
      const folder = app.vault.getAbstractFileByPath(manuscript);
      const count = folder instanceof TFolder
        ? folder.children.filter((c) => c instanceof TFolder).length
        : 0;
      const prefix = String(count + 1).padStart(2, "0");
      new PromptModal(app, "New chapter", "Chapter name", async (name) => {
        await ensureFolder(app, `${manuscript}/${prefix} ${name}`);
        new Notice(`Created chapter "${prefix} ${name}".`);
      }).open();
    },
  });

  plugin.addCommand({
    id: "compile-manuscript",
    name: "Compile manuscript",
    callback: async () => {
      const books = await plugin.buildBooks();
      if (books.length === 0) {
        new Notice("No book found.");
        return;
      }
      const active = app.workspace.getActiveFile();
      const folder = active ? await bookFolderFor(plugin, active.path) : null;
      const book = books.find((b) => b.folderPath === folder) ?? books[0];
      openCompileModal(plugin, book);
    },
  });

  plugin.addCommand({
    id: "new-scene",
    name: "New scene",
    callback: async () => {
      const active = app.workspace.getActiveFile();
      const bookFolder = active ? await bookFolderFor(plugin, active.path) : null;
      if (!active || !bookFolder) {
        new Notice("Open a note inside a chapter first.");
        return;
      }
      const manuscript = `${bookFolder}/${structural().manuscript}/`;
      if (!active.path.startsWith(manuscript)) {
        new Notice("Open a note inside a chapter folder first.");
        return;
      }
      const chapterFolder = active.parent?.path;
      if (!chapterFolder) {
        new Notice("Couldn't resolve the chapter folder.");
        return;
      }
      new PromptModal(app, "New scene", "Scene title", async (title) => {
        const path = `${chapterFolder}/${title}.md`;
        if (app.vault.getAbstractFileByPath(path)) {
          new Notice("A scene with that title already exists.");
          return;
        }
        const file = await app.vault.create(path, sceneTemplate());
        await app.workspace.getLeaf(false).openFile(file);
        new Notice(`Created scene "${title}".`);
      }).open();
    },
  });
}
