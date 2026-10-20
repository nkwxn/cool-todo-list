"use client";

import { useSyncExternalStore } from "react";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

const listeners = new Set<() => void>();

function read(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Pick up changes made in browser settings while the app is open.
  let status: PermissionStatus | null = null;
  navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((result) => {
      status = result;
      result.onchange = notify;
    })
    .catch(() => {});
  window.addEventListener("focus", notify);
  return () => {
    listeners.delete(listener);
    if (status) status.onchange = null;
    window.removeEventListener("focus", notify);
  };
}

/** Ask only in response to a user action (setting a reminder or pressing Enable). */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  const current = read();
  if (current !== "default") return current;
  try {
    await Notification.requestPermission();
  } catch {
    // Older Safari uses a callback-style API; treat failures as "not granted".
  }
  notify();
  return read();
}

/**
 * Browser notification permission. Notifications are delivered only while the
 * app is open in a tab (see README: background reminder limitations).
 */
export function useNotificationPermission() {
  const permission = useSyncExternalStore(subscribe, read, () => "default" as const);
  return { permission, request: requestNotificationPermission };
}
