import type { AppData, Category, Note, NoteColor } from "./types";
import { DATA_VERSION, DEFAULT_SETTINGS } from "./types";
import { createId } from "./utils";

const WELCOME_COLOR: NoteColor = "blue";

function welcomeNote(now: number): Note {
  const itemId = () => createId();
  return {
    id: createId(),
    title: "Welcome to your notebook 👋",
    body: "This is a quick tour. Everything you do here is saved automatically in your browser — no account, no save button.\n\nClick a note to open it, or press ⌘K to search.",
    type: "checklist",
    hideCompleted: false,
    items: [
      { id: itemId(), text: "Try checking this off", done: false, createdAt: now },
      {
        id: itemId(),
        text: "Open a note and add a reminder for a few minutes from now",
        done: false,
        createdAt: now,
      },
      {
        id: itemId(),
        text: "Reorder tasks by dragging the grip handle",
        done: false,
        createdAt: now,
      },
      { id: itemId(), text: "Switch the theme with the sun/moon button", done: false, createdAt: now },
    ],
    color: WELCOME_COLOR,
    categoryId: null,
    priority: "medium",
    pinned: true,
    archived: false,
    trashed: false,
    reminder: null,
    createdAt: now,
    updatedAt: now,
  };
}

function ideasNote(now: number): Note {
  return {
    id: createId(),
    title: "Getting organized",
    body: "Categories live in the sidebar — create “Work”, “Personal”, or anything else, then file notes into them.",
    type: "text",
    hideCompleted: false,
    items: [],
    color: "violet",
    categoryId: null,
    priority: "low",
    pinned: false,
    archived: false,
    trashed: false,
    reminder: null,
    createdAt: now - 60_000,
    updatedAt: now - 60_000,
  };
}

export function createSeedData(): AppData {
  const now = Date.now();
  const personal: Category = { id: createId(), name: "Personal", color: "green" };
  const ideas: Note = ideasNote(now);
  return {
    version: DATA_VERSION,
    notes: [welcomeNote(now), { ...ideas, categoryId: personal.id }],
    categories: [personal],
    settings: { ...DEFAULT_SETTINGS },
  };
}
