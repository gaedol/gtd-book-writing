import {
  Notice,
  Plugin,
  TFile,
  WorkspaceLeaf,
  debounce,
} from "obsidian";
import {
  Book,
  DEFAULT_MATERIALS,
  DEFAULT_STRUCTURAL,
  StructuralNames,
} from "./model";
import { buildBooks } from "./parser";
import { registerCommands } from "./commands";
import { registerSceneCard } from "./scene-card";
import { GtdBookSettingTab } from "./settings";
import { GtdBookView, VIEW_TYPE_GTD_BOOK } from "./view";

export interface GtdBookSettings {
  structural: StructuralNames;
  defaultMaterials: string[];
  activeBookPath: string | null; // index path of the book shown in the panel
}

const DEFAULT_SETTINGS: GtdBookSettings = {
  structural: { ...DEFAULT_STRUCTURAL },
  defaultMaterials: [...DEFAULT_MATERIALS],
  activeBookPath: null,
};

export default class GtdBookPlugin extends Plugin {
  settings: GtdBookSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_GTD_BOOK,
      (leaf) => new GtdBookView(leaf, this),
    );

    this.addRibbonIcon("book", "GTD book panel", () => this.activateView());

    this.addCommand({
      id: "open-gtd-book-panel",
      name: "Open GTD book panel",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "insert-scene-card",
      name: "Insert scene card in current note",
      callback: () => void this.insertSceneCard(),
    });

    this.addSettingTab(new GtdBookSettingTab(this.app, this));

    registerSceneCard(this);
    registerCommands(this);

    const refresh = debounce(() => this.refreshViews(), 400, true);
    // "resolved" fires when initial vault indexing completes — without it,
    // books whose frontmatter wasn't cached at first render stay missing.
    this.registerEvent(this.app.metadataCache.on("resolved", refresh));
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_GTD_BOOK);
  }

  buildBooks(): Promise<Book[]> {
    return buildBooks(
      this.app,
      this.settings.structural,
      this.settings.defaultMaterials,
    );
  }

  private async insertSceneCard(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("No active note.");
      return;
    }
    const content = await this.app.vault.read(file);
    if (content.includes("```gtd-scene")) {
      new Notice("Scene card already present.");
      return;
    }
    const block = "```gtd-scene\n```\n\n";
    const fm = content.match(/^---\n[\s\S]*?\n---\n/);
    const next = fm
      ? content.slice(0, fm[0].length) + block + content.slice(fm[0].length)
      : block + content;
    await this.app.vault.modify(file, next);
    new Notice("Scene card inserted.");
  }

  async reorderScenes(
    indexPath: string,
    chapterName: string,
    sceneTitles: string[],
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(indexPath);
    if (!(file instanceof TFile)) return;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      const so =
        fm.sceneOrder && typeof fm.sceneOrder === "object" ? fm.sceneOrder : {};
      so[chapterName] = sceneTitles;
      fm.sceneOrder = so;
    });
    this.refreshViews();
  }

  async reorderChapters(indexPath: string, chapterNames: string[]): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(indexPath);
    if (!(file instanceof TFile)) return;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.chapterOrder = chapterNames;
    });
    this.refreshViews();
  }

  async markReviewDone(indexPath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(indexPath);
    if (!(file instanceof TFile)) return;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.lastReview = new Date().toISOString().slice(0, 10);
    });
    new Notice("Weekly review marked done.");
    this.refreshViews();
  }

  openScene(path: string): void {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      this.app.workspace.getLeaf(false).openFile(file);
    }
  }

  private refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_GTD_BOOK)) {
      const view = leaf.view;
      if (view instanceof GtdBookView) void view.render();
    }
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null =
      workspace.getLeavesOfType(VIEW_TYPE_GTD_BOOK)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_GTD_BOOK, active: true });
    }
    if (leaf) workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    // Migrate pre-materials settings ({ reserved: {...} }).
    const legacy = data?.reserved;
    this.settings = {
      structural: {
        ...DEFAULT_STRUCTURAL,
        ...(legacy
          ? { manuscript: legacy.manuscript, notes: legacy.notes }
          : {}),
        ...(data?.structural ?? {}),
      },
      defaultMaterials: Array.isArray(data?.defaultMaterials)
        ? data.defaultMaterials
        : [...DEFAULT_MATERIALS],
      activeBookPath:
        typeof data?.activeBookPath === "string" ? data.activeBookPath : null,
    };
  }

  async setActiveBook(indexPath: string): Promise<void> {
    this.settings.activeBookPath = indexPath;
    await this.saveSettings();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.refreshViews();
  }
}
