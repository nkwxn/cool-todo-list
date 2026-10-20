"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import { createBlankData, createInitialData, notesRepository } from "@/lib/storage";
import {
  createEmptyState,
  notesReducer,
  type NotesAction,
  type NotesState,
} from "@/lib/reducer";
import type { AppData } from "@/lib/types";
import { useToast } from "@/components/providers/toast-provider";

interface NotesContextValue {
  state: NotesState;
  dispatch: Dispatch<NotesAction>;
}

const NotesContext = createContext<NotesContextValue | null>(null);

/** Trailing delay before persisting, so typing does not serialize every keystroke. */
const SAVE_DELAY_MS = 300;

function snapshot(state: NotesState): AppData {
  return {
    version: state.version,
    notes: state.notes,
    categories: state.categories,
    settings: state.settings,
  };
}

/**
 * Single source of truth for notes/categories/settings.
 * - Server and first client render start from an empty, hydration-safe state.
 * - Stored data is validated on load; unreadable data is backed up and never
 *   silently replaced by demo notes.
 * - Changes are persisted automatically (debounced, flushed when the page is
 *   hidden or closed) — there is no Save button.
 */
export function NotesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notesReducer, undefined, createEmptyState);
  const { pushToast } = useToast();
  // false when stored data could not be backed up: persisting would destroy it.
  const canPersist = useRef(true);
  const pending = useRef<AppData | null>(null);

  // Load exactly once: Strict Mode double-invokes effects in development, and a
  // second load must not create a second backup or repeat the warning toast.
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const result = notesRepository.load();
    if (result.status === "ok") {
      dispatch({ type: "HYDRATE", data: result.data });
      if (result.repaired > 0) {
        pushToast(`Repaired ${result.repaired} damaged ${result.repaired === 1 ? "record" : "records"} in your saved notes.`, {
          durationMs: 8000,
        });
      }
    } else if (result.status === "empty") {
      dispatch({ type: "HYDRATE", data: createInitialData() });
    } else {
      dispatch({ type: "HYDRATE", data: createBlankData() });
      if (result.backupKey) {
        pushToast(`Your saved notes couldn't be read. A backup was kept in browser storage (“${result.backupKey}”).`, {
          tone: "danger",
          durationMs: 15_000,
        });
      } else {
        canPersist.current = false;
        pushToast("Saved notes couldn't be read or backed up. Changes in this session won't be saved.", {
          tone: "danger",
          durationMs: 15_000,
        });
      }
    }
  }, [pushToast]);

  // Debounced persistence.
  useEffect(() => {
    if (!state.hydrated || !canPersist.current) return;
    pending.current = snapshot(state);
    const timer = window.setTimeout(() => {
      if (pending.current) notesRepository.save(pending.current);
      pending.current = null;
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  // Flush unsaved changes when the tab is hidden, closed, or the app unmounts.
  useEffect(() => {
    const flush = () => {
      if (pending.current && canPersist.current) notesRepository.save(pending.current);
      pending.current = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes(): NotesContextValue {
  const context = useContext(NotesContext);
  if (!context) throw new Error("useNotes must be used within NotesProvider");
  return context;
}
