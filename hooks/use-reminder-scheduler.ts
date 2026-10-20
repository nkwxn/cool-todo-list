"use client";

import { useEffect, useRef, type Dispatch } from "react";
import type { Note } from "@/lib/types";
import type { NotesAction } from "@/lib/reducer";
import { buildReminderBody, effectiveDue, isReminderDue } from "@/lib/reminders";
import { formatDateTime } from "@/lib/time";
import { useToast } from "@/components/providers/toast-provider";

const TICK_MS = 10_000;

/**
 * In-page reminder engine.
 *
 * While the app is open in a tab, a periodic tick plus focus/visibility events
 * look for due reminders, raise a browser notification (when permitted) and an
 * in-app toast, then mark the occurrence fired (recurring reminders advance).
 *
 * Limitation: with no push backend + service worker, nothing can fire while
 * the app is closed. Missed reminders appear as overdue and fire on next open.
 */
export function useReminderScheduler({
  notes,
  dispatch,
  enabled,
  onOpenNote,
}: {
  notes: Note[];
  dispatch: Dispatch<NotesAction>;
  enabled: boolean;
  onOpenNote: (noteId: string) => void;
}) {
  const { pushToast } = useToast();
  const latest = useRef({ notes, dispatch, onOpenNote, pushToast });
  const fired = useRef<Set<string>>(new Set());
  const check = useRef<() => void>(() => {});

  useEffect(() => {
    latest.current = { notes, dispatch, onOpenNote, pushToast };
  });

  useEffect(() => {
    check.current = () => {
      const { notes, dispatch, onOpenNote, pushToast } = latest.current;
      const now = Date.now();
      for (const note of notes) {
        if (!isReminderDue(note, now)) continue;
        const reminder = note.reminder!;
        // MARK_REMINDER_FIRED lands asynchronously; avoid duplicate alerts meanwhile.
        const due = effectiveDue(reminder);
        const key = `${note.id}:${due}`;
        if (fired.current.has(key)) continue;
        fired.current.add(key);

        const title = note.title.trim() || "Untitled note";
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            const notification = new Notification(title, {
              body: `${buildReminderBody(note)}\nDue ${formatDateTime(due)}`,
              tag: key,
              icon: "/favicon.ico",
            });
            notification.onclick = () => {
              window.focus();
              latest.current.onOpenNote(note.id);
              notification.close();
            };
          } catch {
            // e.g. Android Chrome requires a service worker; the toast still shows.
          }
        }

        pushToast(`Reminder: ${title}`, {
          action: { label: "Open", onClick: () => onOpenNote(note.id) },
          durationMs: 15_000,
        });
        dispatch({ type: "MARK_REMINDER_FIRED", noteId: note.id });
      }
    };
  });

  // Re-check whenever notes change (e.g. a reminder was just set in the past).
  useEffect(() => {
    if (enabled) check.current();
  }, [enabled, notes]);

  useEffect(() => {
    if (!enabled) return;
    const run = () => check.current();
    const interval = window.setInterval(run, TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", run);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", run);
    };
  }, [enabled]);
}
