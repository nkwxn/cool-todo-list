import type { Recurrence } from "./types";

/**
 * All timestamps are stored as epoch milliseconds (absolute instants).
 * Input widgets produce local wall-clock strings; conversion happens here so
 * reminders always fire at the correct instant for the user's timezone.
 */

export function toDateInputValue(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toTimeInputValue(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** Local wall-clock date + time inputs → epoch ms. */
export function fromDateTimeInputs(date: string, time: string): number | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const result = new Date(y, m - 1, d, hh, mm, 0, 0);
  return result.getTime();
}




/** The anchor shifted by `n` recurrence periods, keeping local time-of-day and day-of-month. */
export function occurrenceAt(anchor: number, recurrence: Recurrence, n: number): number {
  if (recurrence === "none" || n === 0) return anchor;
  const d = new Date(anchor);
  if (recurrence === "daily" || recurrence === "weekly") {
    d.setDate(d.getDate() + n * (recurrence === "daily" ? 1 : 7));
    return d.getTime();
  }
  // Monthly: always clamp the ORIGINAL day (31 → Feb 28 → Mar 31), never the previous occurrence's.
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target.getTime();
}

/**
 * First occurrence of the series strictly after `after`. Computed by estimating
 * the period count arithmetically, so a far-past anchor costs O(1), not one
 * step per missed period.
 */
export function nextOccurrenceAfter(anchor: number, recurrence: Recurrence, after: number): number {
  if (recurrence === "none") return anchor;
  if (anchor > after) return anchor;
  const approxPeriod = recurrence === "daily" ? 86_400_000 : recurrence === "weekly" ? 604_800_000 : 2_629_746_000;
  // Estimate, then correct for DST and month-length variance (at most a couple of steps either way).
  let n = Math.max(0, Math.floor((after - anchor) / approxPeriod) - 1);
  while (n > 0 && occurrenceAt(anchor, recurrence, n) > after) n--;
  while (occurrenceAt(anchor, recurrence, n) <= after) n++;
  return occurrenceAt(anchor, recurrence, n);
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});


const fullFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "short",
});

export function formatDateTime(ts: number): string {
  return dateTimeFormatter.format(ts);
}



export function formatFullDate(ts: number): string {
  return fullFormatter.format(ts);
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = ts - now;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return diff >= 0 ? "in a moment" : "just now";

  const rtf = relativeFormatter;
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return dateFormatter.format(ts);
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const monthDayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthDayYearFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

export function formatUpdated(ts: number, now = Date.now()): string {
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? monthDayFormatter : monthDayYearFormatter).format(ts);
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "Does not repeat",
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
};

export const SNOOZE_PRESETS: { label: string; ms: number }[] = [
  { label: "In 10 minutes", ms: 10 * 60_000 },
  { label: "In 1 hour", ms: 60 * 60_000 },
  { label: "In 3 hours", ms: 3 * 60 * 60_000 },
];
