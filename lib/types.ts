export const NOTE_COLORS = [
  "slate",
  "amber",
  "orange",
  "rose",
  "violet",
  "blue",
  "cyan",
  "green",
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export type Priority = "low" | "medium" | "high";

export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export type NoteType = "text" | "checklist";

export type SortMode = "updated" | "created" | "title" | "priority";

export type ViewMode = "grid" | "list";

export type NavView =
  | "all"
  | "pinned"
  | "reminders"
  | "archive"
  | "trash"
  | "category";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export interface Reminder {
  id: string;
  /** Current occurrence as epoch ms (absolute instant), shown in the user's local timezone. */
  dueAt: number;
  /** First occurrence of the series; every recurrence is computed from it so day/time never drift. */
  anchor?: number;
  recurrence: Recurrence;
  /** Last time this reminder fired, used to avoid duplicate notifications. */
  firedAt: number | null;
  /**
   * One-off postponement of the current occurrence. While set it is the
   * effective fire time; `dueAt` stays the series anchor so postponing a
   * recurring reminder never shifts later occurrences.
   */
  snoozedUntil?: number | null;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  type: NoteType;
  items: ChecklistItem[];
  hideCompleted: boolean;
  color: NoteColor;
  categoryId: string | null;
  priority: Priority;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  reminder: Reminder | null;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: NoteColor;
}

export interface Settings {
  sort: SortMode;
  view: ViewMode;
}

export interface AppData {
  version: number;
  notes: Note[];
  categories: Category[];
  settings: Settings;
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const DATA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  sort: "updated",
  view: "grid",
};
