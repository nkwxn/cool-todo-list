import type {
  AppData,
  Category,
  ChecklistItem,
  Note,
  NoteColor,
  Priority,
  Recurrence,
  Reminder,
  Settings,
} from "./types";
import { DATA_VERSION, DEFAULT_SETTINGS } from "./types";
import { createId, moveItem } from "./utils";
import { nextOccurrenceAfter } from "./time";

export interface NotesState extends AppData {
  hydrated: boolean;
}

export function createEmptyState(): NotesState {
  return {
    version: DATA_VERSION,
    notes: [],
    categories: [],
    settings: { ...DEFAULT_SETTINGS },
    hydrated: false,
  };
}

function touch(note: Note, patch: Partial<Note>): Note {
  return { ...note, ...patch, updatedAt: Date.now() };
}

function mapNote(
  state: NotesState,
  id: string,
  fn: (note: Note) => Note,
): NotesState {
  return {
    ...state,
    notes: state.notes.map((note) => (note.id === id ? fn(note) : note)),
  };
}

export function createNote(input?: Partial<Note>): Note {
  const now = Date.now();
  return {
    id: createId(),
    title: "",
    body: "",
    type: "text",
    items: [],
    hideCompleted: false,
    color: "slate",
    categoryId: null,
    priority: "medium",
    pinned: false,
    archived: false,
    trashed: false,
    reminder: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

export type NotesAction =
  | { type: "HYDRATE"; data: AppData }
  | { type: "ADD_NOTE"; note: Note }
  | { type: "UPDATE_NOTE"; id: string; patch: Partial<Note> }
  | { type: "DUPLICATE_NOTE"; id: string; newId?: string }
  | { type: "TRASH_NOTE"; id: string }
  | { type: "RESTORE_NOTE"; id: string }
  | { type: "PURGE_NOTE"; id: string }
  | { type: "EMPTY_TRASH" }
  | { type: "TOGGLE_PIN"; id: string }
  | { type: "TOGGLE_ARCHIVE"; id: string }
  | { type: "SET_COLOR"; id: string; color: NoteColor }
  | { type: "SET_CATEGORY"; id: string; categoryId: string | null }
  | { type: "SET_PRIORITY"; id: string; priority: Priority }
  | { type: "ADD_ITEM"; noteId: string; text: string; itemId?: string; afterId?: string }
  | { type: "TOGGLE_ITEM"; noteId: string; itemId: string }
  | { type: "UPDATE_ITEM"; noteId: string; itemId: string; text: string }
  | { type: "PRUNE_EMPTY_ITEMS"; noteId: string }
  | { type: "DELETE_ITEM"; noteId: string; itemId: string }
  | { type: "MOVE_ITEM"; noteId: string; from: number; to: number }
  | { type: "SET_HIDE_COMPLETED"; noteId: string; hide: boolean }
  | { type: "SET_NOTE_TYPE"; noteId: string; noteType: Note["type"] }
  | {
      type: "SET_REMINDER";
      noteId: string;
      dueAt: number;
      recurrence: Recurrence;
    }
  | { type: "SNOOZE_REMINDER"; noteId: string; until: number }
  | { type: "CANCEL_REMINDER"; noteId: string }
  | { type: "MARK_REMINDER_FIRED"; noteId: string }
  | { type: "ADD_CATEGORY"; name: string; color: NoteColor }
  | { type: "UPDATE_CATEGORY"; id: string; patch: Partial<Category> }
  | { type: "DELETE_CATEGORY"; id: string }
  | { type: "SET_SETTINGS"; patch: Partial<Settings> };

export function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case "HYDRATE":
      return { ...action.data, hydrated: true };

    case "ADD_NOTE":
      return { ...state, notes: [action.note, ...state.notes] };

    case "UPDATE_NOTE":
      return mapNote(state, action.id, (note) => touch(note, action.patch));

    case "DUPLICATE_NOTE": {
      const source = state.notes.find((note) => note.id === action.id);
      if (!source) return state;
      const now = Date.now();
      const copy: Note = {
        ...source,
        id: action.newId ?? createId(),
        title: source.title ? `${source.title} (copy)` : "",
        items: source.items.map((item) => ({ ...item, id: createId() })),
        // Do not carry the reminder over: two notes would fire the same alert.
        reminder: null,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      return { ...state, notes: [copy, ...state.notes] };
    }

    case "TRASH_NOTE":
      return mapNote(state, action.id, (note) =>
        touch(note, { trashed: true, archived: false }),
      );

    case "RESTORE_NOTE":
      return mapNote(state, action.id, (note) => touch(note, { trashed: false }));

    case "PURGE_NOTE":
      return {
        ...state,
        notes: state.notes.filter((note) => note.id !== action.id),
      };

    case "EMPTY_TRASH":
      return { ...state, notes: state.notes.filter((note) => !note.trashed) };

    case "TOGGLE_PIN":
      return mapNote(state, action.id, (note) =>
        touch(note, { pinned: !note.pinned }),
      );

    case "TOGGLE_ARCHIVE":
      return mapNote(state, action.id, (note) =>
        // Pin is preserved so archive → Undo / Unarchive restores it; archived notes are excluded from pinned views.
        touch(note, { archived: !note.archived }),
      );

    case "SET_COLOR":
      return mapNote(state, action.id, (note) => touch(note, { color: action.color }));

    case "SET_CATEGORY":
      return mapNote(state, action.id, (note) =>
        touch(note, { categoryId: action.categoryId }),
      );

    case "SET_PRIORITY":
      return mapNote(state, action.id, (note) =>
        touch(note, { priority: action.priority }),
      );

    case "ADD_ITEM": {
      const item: ChecklistItem = {
        id: action.itemId ?? createId(),
        text: action.text,
        done: false,
        createdAt: Date.now(),
      };
      return mapNote(state, action.noteId, (note) => {
        const items = [...note.items];
        const afterIndex = action.afterId
          ? items.findIndex((existing) => existing.id === action.afterId)
          : -1;
        if (afterIndex >= 0) items.splice(afterIndex + 1, 0, item);
        else items.push(item);
        return touch(note, { items, type: "checklist" });
      });
    }

    case "TOGGLE_ITEM":
      return mapNote(state, action.noteId, (note) =>
        touch(note, {
          items: note.items.map((item) =>
            item.id === action.itemId ? { ...item, done: !item.done } : item,
          ),
        }),
      );

    case "UPDATE_ITEM":
      return mapNote(state, action.noteId, (note) =>
        touch(note, {
          items: note.items.map((item) =>
            item.id === action.itemId ? { ...item, text: action.text } : item,
          ),
        }),
      );

    case "PRUNE_EMPTY_ITEMS":
      return mapNote(state, action.noteId, (note) => {
        const items = note.items.filter((item) => item.text.trim() !== "");
        return items.length === note.items.length ? note : touch(note, { items });
      });

    case "DELETE_ITEM":
      return mapNote(state, action.noteId, (note) =>
        touch(note, {
          items: note.items.filter((item) => item.id !== action.itemId),
        }),
      );

    case "MOVE_ITEM": {
      const { from, to } = action;
      return mapNote(state, action.noteId, (note) => {
        if (
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= note.items.length ||
          to >= note.items.length
        ) {
          return note;
        }
        return touch(note, { items: moveItem(note.items, from, to) });
      });
    }

    case "SET_HIDE_COMPLETED":
      return mapNote(state, action.noteId, (note) =>
        touch(note, { hideCompleted: action.hide }),
      );

    case "SET_NOTE_TYPE":
      return mapNote(state, action.noteId, (note) => {
        if (action.noteType === note.type) return note;
        if (action.noteType === "text") {
          // Keep checklist text in the body so nothing is lost.
          const lines = note.items.map((item) =>
            item.done ? `✓ ${item.text}` : item.text,
          );
          const merged = [note.body, ...lines].filter(Boolean).join("\n");
          return touch(note, { type: "text", items: [], body: merged });
        }
        return touch(note, { type: "checklist" });
      });

    case "SET_REMINDER": {
      return mapNote(state, action.noteId, (note) => {
        const reminder: Reminder = {
          id: note.reminder?.id ?? createId(),
          dueAt: action.dueAt,
          anchor: action.dueAt,
          recurrence: action.recurrence,
          firedAt: null,
          snoozedUntil: null,
        };
        return touch(note, { reminder });
      });
    }

    case "SNOOZE_REMINDER":
      return mapNote(state, action.noteId, (note) => {
        const reminder = note.reminder;
        if (!reminder) return note;
        // One-off: just move it. Recurring: postpone only this occurrence.
        const next: Reminder =
          reminder.recurrence === "none"
            ? { ...reminder, dueAt: action.until, anchor: action.until, snoozedUntil: null, firedAt: null }
            : { ...reminder, snoozedUntil: action.until, firedAt: null };
        return touch(note, { reminder: next });
      });

    case "CANCEL_REMINDER":
      return mapNote(state, action.noteId, (note) =>
        touch(note, { reminder: null }),
      );

    case "MARK_REMINDER_FIRED":
      return mapNote(state, action.noteId, (note) => {
        if (!note.reminder) return note;
        const firedAt = Date.now();
        const reminder = note.reminder;
        if (reminder.recurrence === "none") {
          // Keep the effective (possibly snoozed) time so the card shows when it fired.
          const dueAt = reminder.snoozedUntil ?? reminder.dueAt;
          return touch(note, { reminder: { ...reminder, dueAt, snoozedUntil: null, firedAt } });
        }
        const nextDue = nextOccurrenceAfter(reminder.anchor ?? reminder.dueAt, reminder.recurrence, firedAt);
        return touch(note, {
          reminder: { ...reminder, dueAt: nextDue, snoozedUntil: null, firedAt },
        });
      });

    case "ADD_CATEGORY": {
      const name = action.name.trim();
      if (!name) return state;
      const category: Category = {
        id: createId(),
        name,
        color: action.color,
      };
      return { ...state, categories: [...state.categories, category] };
    }

    case "UPDATE_CATEGORY":
      return {
        ...state,
        categories: state.categories.map((category) =>
          category.id === action.id ? { ...category, ...action.patch } : category,
        ),
      };

    case "DELETE_CATEGORY":
      return {
        ...state,
        categories: state.categories.filter(
          (category) => category.id !== action.id,
        ),
        notes: state.notes.map((note) =>
          note.categoryId === action.id ? { ...note, categoryId: null } : note,
        ),
      };

    case "SET_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.patch } };

    default:
      return state;
  }
}
