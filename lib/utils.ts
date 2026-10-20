import type { Note, Priority, SortMode } from "./types";
import { PRIORITY_ORDER } from "./types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function compareNotes(a: Note, b: Note, sort: SortMode): number {
  // Pinned notes always float to the top within their group.
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

  switch (sort) {
    case "created":
      return b.createdAt - a.createdAt;
    case "title":
      return (
        (a.title || "Untitled").localeCompare(b.title || "Untitled", undefined, {
          sensitivity: "base",
        }) || b.updatedAt - a.updatedAt
      );
    case "priority": {
      const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      return byPriority || b.updatedAt - a.updatedAt;
    }
    case "updated":
    default:
      return b.updatedAt - a.updatedAt;
  }
}

export function sortNotes(notes: Note[], sort: SortMode): Note[] {
  return [...notes].sort((a, b) => compareNotes(a, b, sort));
}

export function noteMatchesQuery(
  note: Note,
  query: string,
  categoryName?: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (note.title.toLowerCase().includes(q)) return true;
  if (note.body.toLowerCase().includes(q)) return true;
  if (note.items.some((item) => item.text.toLowerCase().includes(q))) return true;
  if (categoryName && categoryName.toLowerCase().includes(q)) return true;
  return false;
}

export function checklistProgress(note: Note): {
  done: number;
  total: number;
  complete: boolean;
} {
  const total = note.items.length;
  const done = note.items.filter((item) => item.done).length;
  return { done, total, complete: total > 0 && done === total };
}


export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function priorityLabel(priority: Priority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}
