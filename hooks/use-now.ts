"use client";

import { useSyncExternalStore } from "react";

// One shared ticking clock so render stays pure (no Date.now() during render)
// and time-relative UI (overdue badges, "in 5 minutes") refreshes on its own.
const TICK_MS = 30_000;
let now = 0;
const listeners = new Set<() => void>();
let timer: number | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  if (now === 0) now = Date.now();
  return now;
}

/** Bump the shared clock immediately (e.g. right after scheduling a reminder). */
export function refreshNow() {
  now = Date.now();
  listeners.forEach((notify) => notify());
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
