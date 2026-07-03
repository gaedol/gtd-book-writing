import { Book, Chapter, Scene, SceneStatus } from "./model";

export function derivedNextAction(status: SceneStatus | null): string | null {
  switch (status) {
    case "idea":
      return "Outline this scene";
    case "outlined":
      return "Draft this scene";
    case "drafting":
      return "Finish the draft";
    case "revising":
      return "Revise this scene";
    default:
      return null; // final, or missing/unknown status
  }
}

export interface NextAction {
  text: string;
  source: "task" | "status";
}

// Precedence: first open explicit task wins; else the status-derived default; else none.
export function nextAction(scene: Scene): NextAction | null {
  if (scene.firstOpenTask) {
    return { text: scene.firstOpenTask, source: "task" };
  }
  const derived = derivedNextAction(scene.status);
  if (derived) return { text: derived, source: "status" };
  return null;
}

export function isStalled(scene: Scene): boolean {
  return nextAction(scene) === null && scene.status !== "final";
}

// today as ISO YYYY-MM-DD so string comparison is chronological.
export function isAvailable(
  scene: Scene,
  chapter: Chapter,
  today: string,
): boolean {
  if (scene.status === "final") return false;
  if (nextAction(scene) === null) return false; // stalled
  if (scene.defer && scene.defer > today) return false; // deferred
  if (chapter.sequential) {
    for (const s of chapter.scenes) {
      if (s.path === scene.path) break;
      if (s.status !== "final") return false; // earlier scene not done
    }
  }
  return true;
}

export interface AvailableScene {
  scene: Scene;
  chapter: Chapter;
  action: NextAction;
}

export function availableScenes(book: Book, today: string): AvailableScene[] {
  const out: AvailableScene[] = [];
  for (const chapter of book.chapters) {
    for (const scene of chapter.scenes) {
      if (isAvailable(scene, chapter, today)) {
        out.push({ scene, chapter, action: nextAction(scene)! });
      }
    }
  }
  // Flagged float to the top; otherwise keep manuscript order.
  out.sort((a, b) => Number(b.scene.flagged) - Number(a.scene.flagged));
  return out;
}

export function stalledScenes(book: Book): { scene: Scene; chapter: Chapter }[] {
  const out: { scene: Scene; chapter: Chapter }[] = [];
  for (const chapter of book.chapters) {
    for (const scene of chapter.scenes) {
      if (isStalled(scene)) out.push({ scene, chapter });
    }
  }
  return out;
}

export interface Pacing {
  wordsToGo: number;
  daysLeft: number | null;
  perDay: number | null;
}

export function pacing(book: Book, today: string): Pacing {
  let wordsToGo = 0;
  for (const chapter of book.chapters) {
    for (const scene of chapter.scenes) {
      if (scene.status === "final") continue;
      const goal = scene.wordGoal ?? 0;
      wordsToGo += Math.max(0, goal - scene.words);
    }
  }
  let daysLeft: number | null = null;
  if (book.deadline) {
    const ms = Date.parse(book.deadline) - Date.parse(today);
    daysLeft = Math.max(0, Math.ceil(ms / 86_400_000));
  }
  const perDay =
    daysLeft && daysLeft > 0 ? Math.round(wordsToGo / daysLeft) : null;
  return { wordsToGo, daysLeft, perDay };
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface StatusSuggestion {
  to: SceneStatus;
  reason: string;
}

// Word count only ever *suggests* a transition; the writer confirms (doc 03 §5).
export function statusSuggestion(scene: Scene): StatusSuggestion | null {
  if (scene.status === "outlined" && scene.words > 0) {
    return { to: "drafting", reason: "Words on the page — started drafting?" };
  }
  if (
    scene.status === "drafting" &&
    scene.wordGoal != null &&
    scene.words >= scene.wordGoal
  ) {
    return { to: "revising", reason: "Word goal reached — move to revising?" };
  }
  return null;
}

export interface ReviewItem {
  kind: "untouched" | "due-soon" | "stale-flag" | "empty-context";
  label: string;
  detail: string;
  scenePath: string | null;
}

const WEEK_MS = 7 * 86_400_000;

export function daysSinceReview(book: Book, today: string): number | null {
  if (!book.lastReview) return null;
  return Math.floor((Date.parse(today) - Date.parse(book.lastReview)) / 86_400_000);
}

export function reviewChecklist(book: Book, today: string): ReviewItem[] {
  const items: ReviewItem[] = [];
  const now = Date.parse(today);
  const weekAhead = new Date(now + WEEK_MS).toISOString().slice(0, 10);

  for (const chapter of book.chapters) {
    if (chapter.scenes.length === 0) continue;
    if (chapter.scenes.every((s) => s.status === "final")) continue;
    const touched = Math.max(...chapter.scenes.map((s) => s.mtime));
    if (now - touched > WEEK_MS) {
      const days = Math.floor((now - touched) / 86_400_000);
      items.push({
        kind: "untouched",
        label: chapter.name,
        detail: `no scene touched in ${days} days`,
        scenePath: null,
      });
    }
  }

  for (const chapter of book.chapters) {
    for (const scene of chapter.scenes) {
      if (scene.status === "final") continue;
      if (scene.due && scene.due <= weekAhead) {
        items.push({
          kind: "due-soon",
          label: scene.title,
          detail: scene.due < today ? `overdue (${scene.due})` : `due ${scene.due}`,
          scenePath: scene.path,
        });
      }
      if (scene.flagged && now - scene.mtime > WEEK_MS) {
        items.push({
          kind: "stale-flag",
          label: scene.title,
          detail: "flagged but untouched for over a week",
          scenePath: scene.path,
        });
      }
    }
  }

  const avail = availableScenes(book, today);
  const activeContexts = new Set(avail.flatMap((a) => a.scene.contexts));
  const allContexts = new Set(
    book.chapters.flatMap((c) =>
      c.scenes.filter((s) => s.status !== "final").flatMap((s) => s.contexts),
    ),
  );
  for (const ctx of allContexts) {
    if (!activeContexts.has(ctx)) {
      items.push({
        kind: "empty-context",
        label: `@${ctx}`,
        detail: "no available scene in this context",
        scenePath: null,
      });
    }
  }

  return items;
}

// In a sequential chapter, a non-final scene preceded by a non-final scene
// is blocked regardless of its own readiness.
export function isSequenceBlocked(scene: Scene, chapter: Chapter): boolean {
  if (!chapter.sequential || scene.status === "final") return false;
  for (const s of chapter.scenes) {
    if (s.path === scene.path) return false;
    if (s.status !== "final") return true;
  }
  return false;
}

export interface ForecastRow {
  date: string;
  kind: "due" | "opens" | "deadline";
  label: string;
  chapter: string;
  scenePath: string | null;
}

// One row per dated scene; due wins over defer (single placement, OmniFocus-style).
// Plus a row for the book deadline.
export function forecast(book: Book, today: string): ForecastRow[] {
  const rows: ForecastRow[] = [];
  for (const chapter of book.chapters) {
    for (const scene of chapter.scenes) {
      if (scene.due) {
        rows.push({ date: scene.due, kind: "due", label: scene.title, chapter: chapter.name, scenePath: scene.path });
      } else if (scene.defer && scene.defer >= today) {
        rows.push({ date: scene.defer, kind: "opens", label: scene.title, chapter: chapter.name, scenePath: scene.path });
      }
    }
  }
  if (book.deadline) {
    rows.push({ date: book.deadline, kind: "deadline", label: "Manuscript complete", chapter: "", scenePath: null });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}
