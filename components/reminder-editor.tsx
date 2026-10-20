"use client";

import { useState } from "react";
import { AlarmClock, Bell, BellOff, Clock, Repeat, TriangleAlert, X } from "lucide-react";
import type { Note, Recurrence } from "@/lib/types";
import type { NotesAction } from "@/lib/reducer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/inputs";
import { Menu, MenuItem } from "@/components/ui/overlays";
import { useToast } from "@/components/providers/toast-provider";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { refreshNow, useNow } from "@/hooks/use-now";
import { effectiveDue, reminderGroup } from "@/lib/reminders";
import {
  RECURRENCE_LABEL,
  SNOOZE_PRESETS,
  formatFullDate,
  formatRelative,
  fromDateTimeInputs,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/time";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-9 rounded-lg border border-border bg-surface px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

/** Default for a new reminder: the next full hour from now. */
function defaultDueAt(): number {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.getTime();
}

/** Reminders are minute-precise so they fire on the minute and display cleanly. */
function roundToMinute(ts: number): number {
  return Math.round(ts / 60_000) * 60_000;
}

function tomorrowMorning(): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

export function ReminderEditor({ note, dispatch }: { note: Note; dispatch: (action: NotesAction) => void }) {
  const reminder = note.reminder;
  const now = useNow();
  const { pushToast } = useToast();
  const { permission, request } = useNotificationPermission();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    const base = reminder && reminder.dueAt > Date.now() ? reminder.dueAt : defaultDueAt();
    setDate(toDateInputValue(base));
    setTime(toTimeInputValue(base));
    setRecurrence(reminder?.recurrence ?? "none");
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const dueAt = fromDateTimeInputs(date, time);
    if (dueAt === null || !time) {
      setError("Choose a valid date and time.");
      return;
    }
    if (dueAt <= Date.now() && recurrence === "none") {
      setError("That time has already passed. Pick a time in the future.");
      return;
    }
    dispatch({ type: "SET_REMINDER", noteId: note.id, dueAt, recurrence });
    refreshNow();
    setEditing(false);
    pushToast(`Reminder set for ${formatFullDate(dueAt)}`);
    // Ask for permission in response to this user action, not on page load.
    if (permission === "default") await request();
  };

  // Recurring: postpones only this occurrence; the series keeps its usual day and time.
  const snooze = (until: number, label: string) => {
    dispatch({ type: "SNOOZE_REMINDER", noteId: note.id, until });
    refreshNow();
    pushToast(`Reminder postponed: ${label}`);
  };

  const cancel = () => {
    dispatch({ type: "CANCEL_REMINDER", noteId: note.id });
    setEditing(false);
    pushToast("Reminder cancelled");
  };

  const group = reminder && now ? reminderGroup(note, now) : null;
  const due = reminder ? effectiveDue(reminder) : 0;
  const snoozed = !!reminder?.snoozedUntil && group !== "done";

  return (
    <section aria-labelledby={`reminder-${note.id}`} className="rounded-xl border border-border bg-surface/60 p-3.5">
      <div className="flex items-center gap-2">
        <Bell className="size-4 text-muted" aria-hidden />
        <h3 id={`reminder-${note.id}`} className="text-[13px] font-semibold">
          Reminder
        </h3>
        {!editing && !reminder ? (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={startEditing}>
            Add reminder
          </Button>
        ) : null}
      </div>

      {reminder && !editing ? (
        <div className="mt-2.5 space-y-3">
          <div
            data-testid="reminder-summary"
            className={cn(
              "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
              group === "overdue" && "text-danger",
            )}
          >
            {group === "overdue" ? <TriangleAlert className="size-4" aria-hidden /> : <Clock className="size-4 text-muted" aria-hidden />}
            <span className="font-medium">{formatFullDate(due)}</span>
            {now ? (
              <span className={cn("text-muted", group === "overdue" && "text-danger")}>
                · {group === "done" ? "notified" : group === "overdue" ? `overdue, ${formatRelative(due, now)}` : formatRelative(due, now)}
              </span>
            ) : null}
            {snoozed ? <span className="text-muted">· postponed</span> : null}
            {reminder.recurrence !== "none" ? (
              <span className="inline-flex items-center gap-1 text-muted">
                <Repeat className="size-3.5" aria-hidden />
                {RECURRENCE_LABEL[reminder.recurrence]}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={startEditing}>
              Edit
            </Button>
            <Menu
              align="start"
              trigger={(props) => (
                <Button size="sm" {...props}>
                  <AlarmClock className="size-3.5" />
                  Postpone
                </Button>
              )}
            >
              {(close) => (
                <>
                  {SNOOZE_PRESETS.map((preset) => (
                    <MenuItem
                      key={preset.label}
                      onSelect={() => {
                        snooze(roundToMinute(Date.now() + preset.ms), preset.label.toLowerCase());
                        close();
                      }}
                    >
                      {preset.label}
                    </MenuItem>
                  ))}
                  <MenuItem
                    onSelect={() => {
                      snooze(tomorrowMorning(), "tomorrow 9:00");
                      close();
                    }}
                  >
                    Tomorrow morning
                  </MenuItem>
                </>
              )}
            </Menu>
            <Button size="sm" variant="ghost" onClick={cancel}>
              <X className="size-3.5" />
              Cancel reminder
            </Button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
              Date
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
              Time
              <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
              Repeat
              <Select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                className="h-9 w-auto rounded-lg py-0 text-sm"
              >
                {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((value) => (
                  <option key={value} value={value}>
                    {RECURRENCE_LABEL[value]}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <p className="text-[11px] text-faint">
            Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
          </p>
          {error ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="primary">
              {reminder ? "Update reminder" : "Save reminder"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Discard
            </Button>
          </div>
        </form>
      ) : null}

      {permission === "denied" ? (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-warning">
          <BellOff className="mt-px size-3.5 shrink-0" aria-hidden />
          Browser notifications are blocked for this site. Reminders will still appear inside the app while it is open.
        </p>
      ) : null}
    </section>
  );
}
