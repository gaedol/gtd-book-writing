export type SceneStatus = "idea" | "outlined" | "drafting" | "revising" | "final";

export const STATUS_ORDER: SceneStatus[] = [
  "idea",
  "outlined",
  "drafting",
  "revising",
  "final",
];

export function isSceneStatus(v: unknown): v is SceneStatus {
  return typeof v === "string" && (STATUS_ORDER as string[]).includes(v);
}

export interface Scene {
  path: string;
  title: string;
  status: SceneStatus | null;
  contexts: string[];
  defer: string | null; // ISO YYYY-MM-DD
  due: string | null; // ISO YYYY-MM-DD
  flagged: boolean;
  wordGoal: number | null;
  words: number;
  firstOpenTask: string | null;
  chapterName: string;
  mtime: number; // last modified, epoch ms
}

export interface Chapter {
  path: string;
  name: string;
  actName: string | null;
  sequential: boolean;
  scenes: Scene[];
}

export interface Book {
  folderPath: string;
  indexPath: string;
  title: string;
  deadline: string | null; // ISO YYYY-MM-DD
  dailyTarget: number | null;
  lastReview: string | null; // ISO YYYY-MM-DD
  materials: string[]; // per-book material folders (index fm `materials:`)
  chapters: Chapter[]; // ordered, flattened across acts; chapter.actName preserves grouping
}

// Structural folders have plugin behavior attached (tracking, compile output)
// and are renameable globally. Material folders are free-form per book.
export interface StructuralNames {
  manuscript: string;
  notes: string;
}

export const DEFAULT_STRUCTURAL: StructuralNames = {
  manuscript: "Manuscript",
  notes: "Notes",
};

export const DEFAULT_MATERIALS = ["Characters", "Locations", "Research"];
