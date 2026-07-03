import { ItemView, WorkspaceLeaf } from "obsidian";
import type GtdBookPlugin from "./main";
import { openCompileModal } from "./compile";
import { Book, Chapter, Scene } from "./model";
import {
  ReviewItem,
  availableScenes,
  daysSinceReview,
  forecast,
  isSequenceBlocked,
  isStalled,
  pacing,
  reviewChecklist,
  stalledScenes,
  todayISO,
} from "./logic";

export const VIEW_TYPE_GTD_BOOK = "gtd-book-panel";

type Tab = "now" | "manuscript" | "review" | "forecast";

export class GtdBookView extends ItemView {
  private plugin: GtdBookPlugin;
  private tab: Tab = "now";

  constructor(leaf: WorkspaceLeaf, plugin: GtdBookPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_GTD_BOOK;
  }
  getDisplayText(): string {
    return "GTD book";
  }
  getIcon(): string {
    return "book";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("gtd-book");

    const books = await this.plugin.buildBooks();
    if (books.length === 0) {
      root.createEl("p", {
        cls: "gtd-empty",
        text: "No book found. Add a note with `type: book` frontmatter.",
      });
      return;
    }
    const book = books[0]; // v1: first book
    const today = todayISO();

    const header = root.createDiv({ cls: "gtd-header" });
    header.createSpan({ cls: "gtd-title", text: book.title });

    this.renderTabs(root);
    const body = root.createDiv({ cls: "gtd-body" });

    switch (this.tab) {
      case "now":
        this.renderNow(body, book, today);
        break;
      case "manuscript":
        this.renderManuscript(body, book);
        break;
      case "review":
        this.renderReview(body, book, today);
        break;
      case "forecast":
        this.renderForecast(body, book, today);
        break;
    }
  }

  private renderTabs(root: HTMLElement): void {
    const bar = root.createDiv({ cls: "gtd-tabs" });
    const tabs: [Tab, string][] = [
      ["now", "Available now"],
      ["manuscript", "Manuscript"],
      ["review", "Review"],
      ["forecast", "Forecast"],
    ];
    for (const [id, label] of tabs) {
      const b = bar.createEl("button", {
        cls: "gtd-tab" + (this.tab === id ? " is-active" : ""),
        text: label,
      });
      b.onclick = () => {
        this.tab = id;
        void this.render();
      };
    }
  }

  private renderNow(body: HTMLElement, book: Book, today: string): void {
    const pace = pacing(book, today);
    const strip = body.createDiv({ cls: "gtd-pace" });
    this.metric(strip, "Pace", pace.perDay != null ? `≈ ${pace.perDay}/day` : "—");
    this.metric(strip, "Days left", pace.daysLeft != null ? String(pace.daysLeft) : "—");
    this.metric(strip, "To go", `${pace.wordsToGo.toLocaleString()} w`);

    const avail = availableScenes(book, today);
    body.createEl("p", { cls: "gtd-count", text: `${avail.length} workable now` });
    if (avail.length === 0) {
      body.createEl("p", { cls: "gtd-muted", text: "Nothing workable right now." });
    }
    for (const a of avail) {
      const row = body.createDiv({ cls: "gtd-row" });
      const top = row.createDiv({ cls: "gtd-row-top" });
      if (a.scene.flagged) top.createSpan({ cls: "gtd-flag", text: "★" });
      this.sceneLink(top, a.scene);
      this.statusPill(top, a.scene);
      top.createSpan({ cls: "gtd-chap", text: a.chapter.name });

      const na = row.createDiv({ cls: "gtd-na" });
      na.createSpan({ text: `→ ${a.action.text}` });
      if (a.scene.contexts.length) {
        na.createSpan({ cls: "gtd-ctx", text: "@" + a.scene.contexts.join(" @") });
      }
      this.progress(row, a.scene);
    }
  }

  private renderManuscript(body: HTMLElement, book: Book): void {
    const hasActs = book.chapters.some((c) => c.actName);
    const chaptersEl = body.createDiv({ cls: "gtd-chapters" });

    let act: string | null | undefined = undefined;
    for (const chapter of book.chapters) {
      if (chapter.actName !== act) {
        act = chapter.actName;
        if (act) chaptersEl.createDiv({ cls: "gtd-act", text: act });
      }
      const section = chaptersEl.createDiv({ cls: "gtd-chsection" });
      section.dataset.key = chapter.name;
      this.renderChapterHeader(section, chapter);

      const scenesEl = section.createDiv({ cls: "gtd-scenes" });
      for (const scene of chapter.scenes) {
        this.renderSceneRow(scenesEl, scene, chapter);
      }
      this.makeSortable(scenesEl, (keys) =>
        void this.plugin.reorderScenes(book.indexPath, chapter.name, keys),
      );
    }

    if (!hasActs && book.chapters.length > 1) {
      this.makeSortable(chaptersEl, (keys) =>
        void this.plugin.reorderChapters(book.indexPath, keys),
      );
    }

    const compile = body.createEl("button", {
      cls: "gtd-review-btn gtd-compile-btn",
      text: "Compile manuscript…",
    });
    compile.onclick = () => openCompileModal(this.plugin, book);
  }

  private renderChapterHeader(section: HTMLElement, chapter: Chapter): void {
    const head = section.createDiv({ cls: "gtd-chh" });
    head.createSpan({ cls: "gtd-grip", text: "⠿" });
    head.createSpan({ cls: "gtd-chname", text: chapter.name });
    head.createSpan({
      cls: chapter.sequential ? "gtd-seq" : "gtd-par",
      text: chapter.sequential ? "sequential" : "parallel",
    });
    const words = chapter.scenes.reduce((n, s) => n + s.words, 0);
    const goal = chapter.scenes.reduce((n, s) => n + (s.wordGoal ?? 0), 0);
    const stalls = chapter.scenes.filter(isStalled).length;
    const meta = head.createSpan({ cls: "gtd-chmeta" });
    if (stalls) {
      meta.createSpan({ cls: "gtd-warn", text: `⚠ ${stalls} stalled` });
    } else {
      meta.setText(`${words.toLocaleString()} / ${goal.toLocaleString()}`);
    }
  }

  private renderSceneRow(scenesEl: HTMLElement, scene: Scene, chapter: Chapter): void {
    const row = scenesEl.createDiv({ cls: "gtd-sc" });
    row.dataset.key = scene.title;
    row.createSpan({ cls: "gtd-grip", text: "⠿" });
    row.createSpan({ cls: `gtd-dot st-${scene.status ?? "none"}` });
    this.sceneLink(row, scene);
    if (scene.flagged) row.createSpan({ cls: "gtd-flag", text: "★" });
    if (isSequenceBlocked(scene, chapter)) {
      row.createSpan({ cls: "gtd-blk", text: "blocked" });
    }
    if (isStalled(scene)) {
      row.createSpan({ cls: "gtd-blk gtd-blk-warn", text: "stalled" });
    }
    this.statusPill(row, scene, true);
    row.createSpan({ cls: "gtd-scwc", text: scene.words.toLocaleString() });
  }

  private makeSortable(container: HTMLElement, onReorder: (keys: string[]) => void): void {
    let dragEl: HTMLElement | null = null;
    const keysOf = () =>
      (Array.from(container.children) as HTMLElement[])
        .filter((c) => c.dataset.key)
        .map((c) => c.dataset.key as string);

    for (const child of Array.from(container.children) as HTMLElement[]) {
      if (!child.dataset.key) continue;
      child.draggable = true;
      child.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        dragEl = child;
        child.addClass("gtd-dragging");
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      });
      child.addEventListener("dragend", (e) => {
        e.stopPropagation();
        child.removeClass("gtd-dragging");
        dragEl = null;
        onReorder(keysOf());
      });
    }

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragEl) return;
      const after = this.dragAfter(container, e.clientY);
      if (after == null) container.appendChild(dragEl);
      else container.insertBefore(dragEl, after);
    });
  }

  private dragAfter(container: HTMLElement, y: number): HTMLElement | null {
    let closest: { offset: number; el: HTMLElement | null } = {
      offset: Number.NEGATIVE_INFINITY,
      el: null,
    };
    for (const child of Array.from(container.children) as HTMLElement[]) {
      if (!child.dataset.key || child.classList.contains("gtd-dragging")) continue;
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) closest = { offset, el: child };
    }
    return closest.el;
  }

  private renderReview(body: HTMLElement, book: Book, today: string): void {
    const since = daysSinceReview(book, today);
    const head = body.createDiv({ cls: "gtd-review-head" });
    head.createSpan({
      cls: "gtd-muted",
      text:
        since == null
          ? "Never reviewed."
          : since === 0
            ? "Reviewed today."
            : `Last review ${since} day${since === 1 ? "" : "s"} ago.`,
    });
    if (since == null || since > 7) head.addClass("gtd-review-late");
    const done = head.createEl("button", {
      cls: "gtd-review-btn",
      text: "Mark review done",
    });
    done.onclick = () => void this.plugin.markReviewDone(book.indexPath);

    const stalled = stalledScenes(book);
    body.createEl("h4", { cls: "gtd-h gtd-h-warn", text: `Stalled (${stalled.length})` });
    if (stalled.length === 0) {
      body.createEl("p", { cls: "gtd-muted", text: "Nothing stalled." });
    }
    for (const s of stalled) {
      const row = body.createDiv({ cls: "gtd-row gtd-row-warn" });
      const top = row.createDiv({ cls: "gtd-row-top" });
      this.sceneLink(top, s.scene);
      top.createSpan({ cls: "gtd-chap", text: s.chapter.name });
      row.createDiv({
        cls: "gtd-na gtd-na-warn",
        text: s.scene.status
          ? "No next action — add a task or move the status on."
          : "No status set — can't derive a next action.",
      });
    }

    const items = reviewChecklist(book, today);
    body.createEl("h4", { cls: "gtd-h", text: `Checklist (${items.length})` });
    if (items.length === 0) {
      body.createEl("p", { cls: "gtd-muted", text: "All clear — nothing needs attention." });
    }
    const labels: Record<ReviewItem["kind"], string> = {
      "untouched": "untouched",
      "due-soon": "due",
      "stale-flag": "stale flag",
      "empty-context": "context",
    };
    for (const item of items) {
      const row = body.createDiv({ cls: "gtd-fc" });
      row.createSpan({ cls: `gtd-pill rv-${item.kind}`, text: labels[item.kind] });
      if (item.scenePath) {
        const link = row.createEl("a", { cls: "gtd-scene", text: item.label });
        const path = item.scenePath;
        link.onclick = () => this.plugin.openScene(path);
      } else {
        row.createSpan({ cls: "gtd-scene", text: item.label });
      }
      row.createSpan({ cls: "gtd-chap", text: item.detail });
    }
  }

  private renderForecast(body: HTMLElement, book: Book, today: string): void {
    const rows = forecast(book, today);
    if (rows.length === 0) {
      body.createEl("p", { cls: "gtd-muted", text: "No dated scenes or deadline." });
    }
    for (const r of rows) {
      const row = body.createDiv({ cls: "gtd-fc" });
      row.createSpan({ cls: "gtd-fcd", text: r.date });
      row.createSpan({ cls: `gtd-pill fc-${r.kind}`, text: r.kind });
      if (r.scenePath) {
        const link = row.createEl("a", { cls: "gtd-scene", text: r.label });
        link.onclick = () => this.plugin.openScene(r.scenePath!);
      } else {
        row.createSpan({ cls: "gtd-scene", text: r.label });
      }
      row.createSpan({ cls: "gtd-chap", text: r.chapter });
    }
    body.createEl("p", { cls: "gtd-muted", text: "Each scene shown once — due wins over defer." });
  }

  private sceneLink(parent: HTMLElement, scene: Scene): void {
    const link = parent.createEl("a", { cls: "gtd-scene", text: scene.title });
    link.onclick = () => this.plugin.openScene(scene.path);
  }

  private statusPill(parent: HTMLElement, scene: Scene, right = false): void {
    if (!scene.status) return;
    const pill = parent.createSpan({
      cls: `gtd-pill st-${scene.status}`,
      text: scene.status,
    });
    if (right) pill.addClass("gtd-pill-right");
  }

  private progress(parent: HTMLElement, scene: Scene): void {
    if (!scene.wordGoal) return;
    const bar = parent.createDiv({ cls: "gtd-bar" });
    const pct = Math.min(100, Math.round((scene.words / scene.wordGoal) * 100));
    bar.createDiv({ cls: "gtd-bar-fill" }).style.width = `${pct}%`;
    parent.createDiv({
      cls: "gtd-wc",
      text: `${scene.words.toLocaleString()} / ${scene.wordGoal.toLocaleString()}`,
    });
  }

  private metric(parent: HTMLElement, label: string, value: string): void {
    const m = parent.createDiv({ cls: "gtd-metric" });
    m.createDiv({ cls: "gtd-metric-label", text: label });
    m.createDiv({ cls: "gtd-metric-value", text: value });
  }
}
