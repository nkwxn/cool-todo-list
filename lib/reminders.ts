import type { Note, Reminder } from "./types";

/** When the current occurrence actually fires: a snooze overrides the series time. */
export function effectiveDue(reminder: Reminder): number {
  return reminder.snoozedUntil ?? reminder.dueAt;
}

/** The current occurrence already notified (firedAt is at/after its effective time). */
export function hasFired(reminder: Reminder): boolean {
  return reminder.firedAt !== null && reminder.firedAt >= effectiveDue(reminder);
}

/** Due = the effective time has passed and this occurrence has not fired yet. */
export function isReminderDue(note: Note, now = Date.now()): boolean {
  const reminder = note.reminder;
  if (!reminder || note.trashed || note.archived) return false;
  return !hasFired(reminder) && effectiveDue(reminder) <= now;
}

export function activeReminders(notes: Note[]): Note[] {
  return notes
    .filter((note) => note.reminder && !note.trashed && !note.archived)
    .sort((a, b) => effectiveDue(a.reminder!) - effectiveDue(b.reminder!));
}

export type ReminderGroup = "overdue" | "today" | "upcoming" | "done";

/** "done" = a one-off reminder that already fired; it stays visible until cancelled. */
export function reminderGroup(note: Note, now = Date.now()): ReminderGroup {
  const reminder = note.reminder!;
  if (hasFired(reminder)) return "done";
  const due = effectiveDue(reminder);
  if (due < now) return "overdue";
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return due <= endOfToday.getTime() ? "today" : "upcoming";
}

export function groupReminders(notes: Note[], now = Date.now()): Record<ReminderGroup, Note[]> {
  const groups: Record<ReminderGroup, Note[]> = { overdue: [], today: [], upcoming: [], done: [] };
  for (const note of activeReminders(notes)) groups[reminderGroup(note, now)].push(note);
  groups.done.reverse();
  return groups;
}

export function buildReminderBody(note: Note): string {
  const parts: string[] = [];
  const open = note.items.filter((item) => !item.done);
  if (open.length > 0) {
    const preview = open
      .slice(0, 3)
      .map((item) => `• ${item.text}`)
      .join("\n");
    parts.push(preview);
    if (open.length > 3) parts.push(`…and ${open.length - 3} more`);
  } else if (note.body.trim()) {
    parts.push(
      note.body.trim().length > 120
        ? `${note.body.trim().slice(0, 117)}…`
        : note.body.trim(),
    );
  }
  return parts.join("\n") || "Open the note for details.";
}
