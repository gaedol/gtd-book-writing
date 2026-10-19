import { TFile } from "obsidian";
import type GtdBookPlugin from "./main";
import { STATUS_ORDER } from "./model";
import { nextAction, statusSuggestion } from "./logic";
import { parseSceneByPath } from "./parser";

interface Beat {
  text: string;
  done: boolean;
  line: number;
}

const TASK_RE = /^([ \t]*[-*] \[)([ xX])(\] )(.*)$/;

function parseBeats(content: string): Beat[] {
  const beats: Beat[] = [];
  content.split("\n").forEach((raw, i) => {
    const m = raw.match(TASK_RE);
    if (m) beats.push({ text: m[4].trim(), done: m[2] !== " ", line: i });
  });
  return beats;
}

export function registerSceneCard(plugin: GtdBookPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor("gtd-scene", (_src, el, ctx) => {
    void renderCard(plugin, el, ctx.sourcePath);
  });
}

async function renderCard(
  plugin: GtdBookPlugin,
  el: HTMLElement,
  path: string,
): Promise<void> {
  const { app } = plugin;
  const file = app.vault.getAbstractFileByPath(path);
  const scene = await parseSceneByPath(app, path);
  if (!(file instanceof TFile) || !scene) {
    el.setText("gtd-scene: not a scene note");
    return;
  }
  const content = await app.vault.read(file);
  const beats = parseBeats(content);
  const firstOpen = beats.findIndex((b) => !b.done);

  el.empty();
  el.addClass("gtd-card");

  // Status segmented control
  const seg = el.createDiv({ cls: "gtd-seg" });
  for (const s of STATUS_ORDER) {
    const b = seg.createDiv({
      cls: "gtd-seg-item" + (scene.status === s ? " is-on" : ""),
      text: s,
    });
    b.onclick = () => {
      void (async () => {
        await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
          fm.status = s;
        });
        await renderCard(plugin, el, path);
      })();
    };
  }

  // Next-action banner
  const na = nextAction(scene);
  const banner = el.createDiv({ cls: "gtd-banner" + (na ? "" : " is-warn") });
  if (na) {
    banner.createDiv({ cls: "gtd-banner-text", text: `→ ${na.text}` });
    banner.createDiv({
      cls: "gtd-banner-src",
      text:
        na.source === "task"
          ? "next action · from your task list"
          : "next action · derived from status",
    });
  } else {
    banner.createDiv({
      cls: "gtd-banner-text",
      text: scene.status === "final" ? "Scene complete" : "Stalled — no next action",
    });
    if (scene.status !== "final") {
      banner.createDiv({
        cls: "gtd-banner-src",
        text: "set a status or add a task",
      });
    }
  }

  // Status suggestion (never auto-applied)
  const suggestion = statusSuggestion(scene);
  if (suggestion) {
    const sug = el.createDiv({ cls: "gtd-suggest" });
    sug.createSpan({ text: suggestion.reason });
    const apply = sug.createEl("button", {
      cls: "gtd-suggest-btn",
      text: `→ ${suggestion.to}`,
    });
    apply.onclick = () => {
      void (async () => {
        await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
          fm.status = suggestion.to;
        });
        await renderCard(plugin, el, path);
      })();
    };
  }

  // Metadata row
  const meta = el.createDiv({ cls: "gtd-meta" });
  if (scene.contexts.length) {
    meta.createSpan({ cls: "gtd-ctx", text: "@" + scene.contexts.join(" @") });
  }
  meta.createSpan({ text: `defer ${scene.defer ?? "—"}` });
  const due = meta.createSpan({ text: `due ${scene.due ?? "—"}` });
  if (scene.due) due.addClass("gtd-due");
  const flag = meta.createSpan({
    cls: "gtd-flagtoggle" + (scene.flagged ? " is-on" : ""),
    text: scene.flagged ? "★ flagged" : "☆ flag",
  });
  flag.onclick = () => {
    void (async () => {
      await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm.flagged = !scene.flagged;
      });
      await renderCard(plugin, el, path);
    })();
  };
  if (scene.wordGoal) {
    const wc = meta.createSpan({ cls: "gtd-wc-inline" });
    wc.createSpan({
      text: `${scene.words.toLocaleString()} / ${scene.wordGoal.toLocaleString()}`,
    });
    const bar = wc.createDiv({ cls: "gtd-bar gtd-bar-inline" });
    const pct = Math.min(100, Math.round((scene.words / scene.wordGoal) * 100));
    bar.createDiv({ cls: "gtd-bar-fill" }).setCssStyles({ width: `${pct}%` });
  }

  // Beats
  if (beats.length) {
    el.createDiv({ cls: "gtd-beats-label", text: "BEATS" });
    beats.forEach((beat, i) => {
      const row = el.createDiv({ cls: "gtd-beat" });
      const box = row.createSpan({
        cls: "gtd-check",
        text: beat.done ? "☑" : "☐",
      });
      const label = row.createSpan({
        cls: "gtd-beat-text" + (beat.done ? " is-done" : ""),
        text: beat.text,
      });
      if (i === firstOpen) label.createSpan({ cls: "gtd-next", text: "next" });
      box.onclick = () => void toggleBeat(app, file, beat, () => renderCard(plugin, el, path));
    });
  }
}

async function toggleBeat(
  app: GtdBookPlugin["app"],
  file: TFile,
  beat: Beat,
  rerender: () => Promise<void>,
): Promise<void> {
  const content = await app.vault.read(file);
  const lines = content.split("\n");
  const m = lines[beat.line]?.match(TASK_RE);
  if (m) {
    lines[beat.line] = `${m[1]}${m[2] === " " ? "x" : " "}${m[3]}${m[4]}`;
    await app.vault.modify(file, lines.join("\n"));
  }
  await rerender();
}
