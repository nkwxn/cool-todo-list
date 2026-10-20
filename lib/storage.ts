import type {
  AppData,
  Category,
  ChecklistItem,
  Note,
  NoteColor,
  Priority,
  Recurrence,
  Reminder,
  SortMode,
  ViewMode,
} from "./types";
import { DATA_VERSION, DEFAULT_SETTINGS, NOTE_COLORS } from "./types";
import { createSeedData } from "./seed";

/**
 * Persistence boundary. The app only talks to this interface, so swapping
 * localStorage for IndexedDB or a remote sync backend later is a
 * single-file change.
 */
export interface NotesRepository {
  load(): LoadResult;
  save(data: AppData): void;
}

/**
 * - `empty`: nothing stored yet (first visit) → seed with demo notes.
 * - `ok`: stored data loaded; `repaired` counts dropped/fixed records.
 * - `corrupt`: data exists but is unreadable. The raw value is backed up
 *   before anything can overwrite it, and the app starts empty (never seeded).
 */
export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; data: AppData; repaired: number }
  | { status: "corrupt"; backupKey: string | null };

const STORAGE_KEY = "cn.data";
const BACKUP_PREFIX = "cn.data.backup-";

/* ---------------- validation ---------------- */

// Plausible instants only: rejects garbage such as -8.64e15 that would make
// date math meaningless (2000-01-01 … 2200-01-01).
const MIN_TIME = 946_684_800_000;
const MAX_TIME = 7_258_118_400_000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= MIN_TIME && value <= MAX_TIME;
const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const PRIORITIES: readonly Priority[] = ["low", "medium", "high"];
const RECURRENCES: readonly Recurrence[] = ["none", "daily", "weekly", "monthly"];
const SORTS: readonly SortMode[] = ["updated", "created", "title", "priority"];
const VIEWS: readonly ViewMode[] = ["grid", "list"];

function parseItem(value: unknown, now: number): ChecklistItem | null {
  if (!isObject(value) || typeof value.id !== "string" || !value.id) return null;
  return {
    id: value.id,
    text: str(value.text),
    done: value.done === true,
    createdAt: isTime(value.createdAt) ? value.createdAt : now,
  };
}

function parseReminder(value: unknown): Reminder | null {
  if (!isObject(value) || !isTime(value.dueAt)) return null;
  return {
    id: str(value.id) || `r-${value.dueAt}`,
    dueAt: value.dueAt,
    anchor: isTime(value.anchor) ? value.anchor : value.dueAt,
    recurrence: oneOf(value.recurrence, RECURRENCES, "none"),
    firedAt: isTime(value.firedAt) ? value.firedAt : null,
    snoozedUntil: isTime(value.snoozedUntil) ? value.snoozedUntil : null,
  };
}

/** Repairs a stored note; returns null when it cannot be salvaged (no id). */
function parseNote(value: unknown, now: number, categoryIds: Set<string>): { note: Note; repaired: boolean } | null {
  if (!isObject(value) || typeof value.id !== "string" || !value.id) return null;
  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items = rawItems.map((item) => parseItem(item, now)).filter((item): item is ChecklistItem => item !== null);
  const createdAt = isTime(value.createdAt) ? value.createdAt : now;
  const categoryId = typeof value.categoryId === "string" && categoryIds.has(value.categoryId) ? value.categoryId : null;
  const note: Note = {
    id: value.id,
    title: str(value.title),
    body: str(value.body),
    type: value.type === "checklist" || items.length > 0 ? "checklist" : "text",
    items,
    hideCompleted: value.hideCompleted === true,
    color: oneOf<NoteColor>(value.color, NOTE_COLORS, "slate"),
    categoryId,
    priority: oneOf(value.priority, PRIORITIES, "medium"),
    pinned: value.pinned === true,
    archived: value.archived === true,
    trashed: value.trashed === true,
    reminder: parseReminder(value.reminder),
    createdAt,
    updatedAt: isTime(value.updatedAt) ? value.updatedAt : createdAt,
  };
  const repaired =
    items.length !== rawItems.length ||
    typeof value.title !== "string" ||
    typeof value.body !== "string" ||
    (value.reminder != null && note.reminder === null) ||
    (value.categoryId != null && categoryId === null);
  return { note, repaired };
}

function parseCategory(value: unknown): Category | null {
  if (!isObject(value) || typeof value.id !== "string" || !value.id) return null;
  const name = str(value.name).trim();
  if (!name) return null;
  return { id: value.id, name, color: oneOf<NoteColor>(value.color, NOTE_COLORS, "blue") };
}

/** Schema upgrades, keyed on the version that was actually stored. */
function migrate(raw: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  const data = raw;
  // if (fromVersion < 2) { …upgrade v1 → v2… }
  void fromVersion;
  return data;
}

/** Exported for tests: validates and repairs an untrusted stored value. */
export function parseStoredData(value: unknown, now = Date.now()): { data: AppData; repaired: number } | null {
  if (!isObject(value) || !Array.isArray(value.notes) || !Array.isArray(value.categories)) return null;
  const storedVersion = typeof value.version === "number" && Number.isInteger(value.version) ? value.version : 1;
  if (storedVersion > DATA_VERSION) return null; // written by a newer app version: never downgrade it
  const upgraded = migrate(value, storedVersion);
  const rawNotes = upgraded.notes as unknown[];
  const rawCategories = upgraded.categories as unknown[];

  const seen = new Set<string>();
  const categories = rawCategories
    .map(parseCategory)
    .filter((category): category is Category => {
      if (!category || seen.has(category.id)) return false;
      seen.add(category.id);
      return true;
    });
  const categoryIds = new Set(categories.map((category) => category.id));

  let repaired = rawCategories.length - categories.length;
  const noteIds = new Set<string>();
  const notes: Note[] = [];
  for (const raw of rawNotes) {
    const parsed = parseNote(raw, now, categoryIds);
    if (!parsed || noteIds.has(parsed.note.id)) {
      repaired++;
      continue;
    }
    noteIds.add(parsed.note.id);
    if (parsed.repaired) repaired++;
    notes.push(parsed.note);
  }

  const settings = isObject(upgraded.settings) ? upgraded.settings : {};
  return {
    data: {
      version: DATA_VERSION,
      notes,
      categories,
      settings: {
        sort: oneOf(settings.sort, SORTS, DEFAULT_SETTINGS.sort),
        view: oneOf(settings.view, VIEWS, DEFAULT_SETTINGS.view),
      },
    },
    repaired,
  };
}

/* ---------------- repository ---------------- */

/** Small stable string hash (FNV-1a) for naming backups. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export class LocalStorageRepository implements NotesRepository {
  load(): LoadResult {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked (privacy mode / policy): run in memory without seeding over anything.
      return { status: "corrupt", backupKey: null };
    }
    if (raw === null) return { status: "empty" };

    let parsed: ReturnType<typeof parseStoredData> = null;
    try {
      parsed = parseStoredData(JSON.parse(raw));
    } catch {
      parsed = null;
    }
    if (parsed) return { status: "ok", ...parsed };

    // Present but unreadable: preserve the original bytes before the app can overwrite them.
    // Key is derived from the content, so re-loading the same bytes never makes duplicate backups.
    const backupKey = `${BACKUP_PREFIX}${hash(raw)}`;
    try {
      if (window.localStorage.getItem(backupKey) !== raw) window.localStorage.setItem(backupKey, raw);
      return { status: "corrupt", backupKey };
    } catch {
      return { status: "corrupt", backupKey: null };
    }
  }

  save(data: AppData): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or blocked; the in-memory session keeps working.
    }
  }
}

export const notesRepository: NotesRepository = new LocalStorageRepository();

export function createInitialData(): AppData {
  return createSeedData();
}

export function createBlankData(): AppData {
  return { version: DATA_VERSION, notes: [], categories: [], settings: { ...DEFAULT_SETTINGS } };
}
