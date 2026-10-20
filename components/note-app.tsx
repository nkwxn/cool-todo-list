"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowUpDown,
  Bell,
  BellRing,
  Check,
  FolderPlus,
  Inbox,
  LayoutGrid,
  List,
  Menu as MenuIcon,
  Monitor,
  Moon,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Pin,
  Plus,
  Search,
  Sun,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { ThemeProvider, useTheme, type ThemePreference } from "@/components/providers/theme-provider";
import { ToastProvider, useToast } from "@/components/providers/toast-provider";
import { NotesProvider, useNotes } from "@/components/providers/notes-provider";
import { useReminderScheduler } from "@/hooks/use-reminder-scheduler";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { useNow } from "@/hooks/use-now";
import type { Category, NavView, Note, NoteColor, SortMode } from "@/lib/types";
import { NOTE_COLORS } from "@/lib/types";
import { createNote } from "@/lib/reducer";
import { cn, createId, noteMatchesQuery, sortNotes } from "@/lib/utils";
import { effectiveDue, groupReminders, type ReminderGroup } from "@/lib/reminders";
import { formatRelative } from "@/lib/time";
import { Button, IconButton } from "@/components/ui/button";
import { Input, SegmentedControl } from "@/components/ui/inputs";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { Menu, MenuItem, MenuLabel, MenuSeparator, Modal } from "@/components/ui/overlays";
import { NoteCard } from "@/components/note-card";
import { NoteEditor } from "@/components/note-editor";
import { AppSkeleton } from "@/components/app-skeleton";

interface Nav {
  view: NavView;
  categoryId?: string;
}

const SORT_LABEL: Record<SortMode, string> = {
  updated: "Last edited",
  created: "Date created",
  title: "Title (A–Z)",
  priority: "Priority",
};

const VIEW_TITLE: Record<Exclude<NavView, "category">, string> = {
  all: "All notes",
  pinned: "Pinned",
  reminders: "Reminders",
  archive: "Archive",
  trash: "Trash",
};

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/* ------------------------------------------------------------------ */

function AppShell() {
  const { state, dispatch } = useNotes();
  const { pushToast } = useToast();
  const searchParams = useSearchParams();
  const now = useNow();

  const [rawNav, setNav] = useState<Nav>({ view: "all" });
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState<{ mode: "create" } | { mode: "edit"; category: Category } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; action: () => void; label: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const deferredSearch = useDeferredValue(search);

  const categoryMap = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories]);
  // Deleting the selected category falls back to All notes (derived, no extra render).
  const selectedCategory = rawNav.view === "category" ? categoryMap.get(rawNav.categoryId ?? "") : undefined;
  const nav = useMemo<Nav>(
    () => (rawNav.view === "category" && !selectedCategory ? { view: "all" } : rawNav),
    [rawNav, selectedCategory],
  );
  const activeCategory = selectedCategory;

  /* ---------- open note lives in the URL (?note=id) for deep links & notification clicks ---------- */
  const openId = searchParams.get("note");
  const openNote = openId ? state.notes.find((note) => note.id === openId) : undefined;

  const openNoteById = useCallback((id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("note", id);
    window.history.pushState(null, "", `?${params.toString()}`);
  }, []);

  const closeNote = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("note");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, []);

  // A stale/deleted ?note= id (e.g. from an old notification) just closes the editor.
  useEffect(() => {
    if (state.hydrated && openId && !openNote) closeNote();
  }, [state.hydrated, openId, openNote, closeNote]);

  // When closing the editor, drop checklist rows left empty.
  const lastOpen = useRef<string | null>(null);
  useEffect(() => {
    if (lastOpen.current && lastOpen.current !== openId) {
      dispatch({ type: "PRUNE_EMPTY_ITEMS", noteId: lastOpen.current });
    }
    lastOpen.current = openId;
  }, [openId, dispatch]);

  useReminderScheduler({
    notes: state.notes,
    dispatch,
    enabled: state.hydrated,
    onOpenNote: openNoteById,
  });

  /* ---------- actions with undo ---------- */
  const newNote = useCallback(
    (type: Note["type"] = "text") => {
      const note = createNote({
        type,
        categoryId: nav.view === "category" ? (nav.categoryId ?? null) : null,
        pinned: nav.view === "pinned",
      });
      dispatch({ type: "ADD_NOTE", note });
      if (nav.view === "archive" || nav.view === "trash" || nav.view === "reminders") setNav({ view: "all" });
      setSidebarOpen(false);
      openNoteById(note.id);
    },
    [dispatch, nav, openNoteById],
  );

  // Card action handlers read notes/open id at call time via refs so their
  // identity stays stable while typing; otherwise every memo'd NoteCard re-renders per keystroke.
  const notesRef = useRef(state.notes);
  useEffect(() => {
    notesRef.current = state.notes;
  }, [state.notes]);
  const findNote = useCallback((id: string) => notesRef.current.find((note) => note.id === id), []);
  const titleOf = useCallback((id: string) => findNote(id)?.title.trim() || "Untitled", [findNote]);
  const isOpen = (id: string) => new URLSearchParams(window.location.search).get("note") === id;

  const togglePin = useCallback((id: string) => dispatch({ type: "TOGGLE_PIN", id }), [dispatch]);

  const toggleArchive = useCallback(
    (id: string) => {
      const wasArchived = findNote(id)?.archived;
      dispatch({ type: "TOGGLE_ARCHIVE", id });
      if (isOpen(id) && !wasArchived) closeNote();
      pushToast(wasArchived ? `“${titleOf(id)}” unarchived` : `“${titleOf(id)}” archived`, {
        action: { label: "Undo", onClick: () => dispatch({ type: "TOGGLE_ARCHIVE", id }) },
      });
    },
    [findNote, dispatch, closeNote, pushToast, titleOf],
  );

  const trash = useCallback(
    (id: string) => {
      const before = findNote(id);
      dispatch({ type: "TRASH_NOTE", id });
      if (isOpen(id)) closeNote();
      pushToast(`“${titleOf(id)}” moved to trash`, {
        action: {
          label: "Undo",
          onClick: () => {
            dispatch({ type: "RESTORE_NOTE", id });
            if (before?.archived) dispatch({ type: "TOGGLE_ARCHIVE", id });
          },
        },
      });
    },
    [findNote, dispatch, closeNote, pushToast, titleOf],
  );

  const restore = useCallback(
    (id: string) => {
      dispatch({ type: "RESTORE_NOTE", id });
      pushToast(`“${titleOf(id)}” restored`);
    },
    [dispatch, pushToast, titleOf],
  );

  const purge = useCallback(
    (id: string) =>
      setConfirm({
        title: "Delete note forever?",
        description: `“${titleOf(id)}” will be permanently deleted. This can’t be undone.`,
        label: "Delete forever",
        action: () => {
          if (isOpen(id)) closeNote();
          dispatch({ type: "PURGE_NOTE", id });
          pushToast("Note permanently deleted");
        },
      }),
    [titleOf, closeNote, dispatch, pushToast],
  );

  const duplicate = useCallback(
    (id: string) => {
      const newId = createId();
      dispatch({ type: "DUPLICATE_NOTE", id, newId });
      openNoteById(newId);
      pushToast("Note duplicated");
    },
    [dispatch, openNoteById, pushToast],
  );

  /* ---------- keyboard shortcuts ---------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (openId) closeNote();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (openId || document.querySelector('[role="dialog"], [role="menu"]')) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        newNote();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, closeNote, newNote]);

  /* ---------- derived data ---------- */
  const live = useMemo(() => state.notes.filter((note) => !note.trashed && !note.archived), [state.notes]);
  const reminderGroups = useMemo(() => groupReminders(state.notes, now), [state.notes, now]);

  const counts = useMemo(
    () => ({
      all: live.length,
      pinned: live.filter((note) => note.pinned).length,
      reminders: reminderGroups.overdue.length + reminderGroups.today.length + reminderGroups.upcoming.length,
      overdue: reminderGroups.overdue.length,
      archive: state.notes.filter((note) => note.archived && !note.trashed).length,
      trash: state.notes.filter((note) => note.trashed).length,
      byCategory: (id: string) => live.filter((note) => note.categoryId === id).length,
    }),
    [live, reminderGroups, state.notes],
  );

  const matches = useCallback(
    (note: Note) => noteMatchesQuery(note, deferredSearch, categoryMap.get(note.categoryId ?? "")?.name),
    [deferredSearch, categoryMap],
  );

  const visibleNotes = useMemo(() => {
    const scoped = state.notes.filter((note) => {
      switch (nav.view) {
        case "trash":
          return note.trashed;
        case "archive":
          return note.archived && !note.trashed;
        case "pinned":
          return note.pinned && !note.archived && !note.trashed;
        case "category":
          return note.categoryId === nav.categoryId && !note.archived && !note.trashed;
        case "reminders":
          return !!note.reminder && !note.archived && !note.trashed;
        default:
          return !note.archived && !note.trashed;
      }
    });
    return sortNotes(scoped.filter(matches), state.settings.sort);
  }, [state.notes, state.settings.sort, nav, matches]);

  /* ---------- rendering helpers ---------- */
  const go = (next: Nav) => {
    setNav(next);
    setSidebarOpen(false);
  };

  const renderCards = (notes: Note[]) => (
    <div
      className={cn(
        state.settings.view === "grid"
          ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          : "flex flex-col gap-2",
      )}
    >
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          now={now}
          category={note.categoryId ? categoryMap.get(note.categoryId) : undefined}
          view={state.settings.view}
          onOpen={openNoteById}
          onTogglePin={togglePin}
          onToggleArchive={toggleArchive}
          onTrash={trash}
          onRestore={restore}
        />
      ))}
    </div>
  );

  const heading = nav.view === "category" ? (activeCategory?.name ?? "Category") : VIEW_TITLE[nav.view];

  if (!state.hydrated) return <AppSkeleton />;

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Mobile drawer backdrop */}
      {sidebarOpen ? (
        <div className="fixed inset-0 z-30 bg-overlay anim-fade lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      ) : null}

      <Sidebar
        open={sidebarOpen}
        nav={nav}
        counts={counts}
        categories={state.categories}
        onNavigate={go}
        onClose={() => setSidebarOpen(false)}
        onNewNote={() => newNote()}
        onNewCategory={() => {
          setSidebarOpen(false);
          setCategoryDialog({ mode: "create" });
        }}
        onEditCategory={(category) => {
          setSidebarOpen(false);
          setCategoryDialog({ mode: "edit", category });
        }}
        onDeleteCategory={(category) => {
          setSidebarOpen(false);
          setConfirm({
            title: `Delete “${category.name}”?`,
            description: "Notes in this category are kept and become uncategorized.",
            label: "Delete category",
            action: () => {
              dispatch({ type: "DELETE_CATEGORY", id: category.id });
              pushToast(`Category “${category.name}” deleted`);
            },
          });
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-bg/85 px-3 py-2.5 backdrop-blur-md sm:px-5">
          <IconButton label="Open navigation" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <MenuIcon className="size-4" />
          </IconButton>

          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearch("");
                  event.currentTarget.blur();
                }
              }}
              aria-label="Search notes"
              placeholder="Search notes"
              className="h-9 w-full rounded-xl border border-border bg-surface pl-9 pr-14 text-sm placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&::-webkit-search-cancel-button]:hidden"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-faint hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-border px-1.5 font-mono text-[10px] text-faint sm:block">
                ⌘K
              </kbd>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Menu
              trigger={(props) => (
                <IconButton label={`Sort: ${SORT_LABEL[state.settings.sort]}`} {...props}>
                  <ArrowUpDown className="size-4" />
                </IconButton>
              )}
            >
              {(close) => (
                <>
                  <MenuLabel>Sort by</MenuLabel>
                  {(Object.keys(SORT_LABEL) as SortMode[]).map((sort) => (
                    <MenuItem
                      key={sort}
                      selected={state.settings.sort === sort}
                      onSelect={() => {
                        dispatch({ type: "SET_SETTINGS", patch: { sort } });
                        close();
                      }}
                    >
                      {SORT_LABEL[sort]}
                    </MenuItem>
                  ))}
                  <MenuSeparator />
                  <p className="px-2.5 py-1 text-[11px] text-faint">Pinned notes stay on top.</p>
                </>
              )}
            </Menu>
            <div className="hidden sm:block">
              <SegmentedControl
                label="Layout"
                value={state.settings.view}
                onChange={(view) => dispatch({ type: "SET_SETTINGS", patch: { view } })}
                options={[
                  { value: "grid", label: "", icon: <LayoutGrid className="size-4" aria-label="Grid" /> },
                  { value: "list", label: "", icon: <List className="size-4" aria-label="List" /> },
                ]}
              />
            </div>
            <ThemeMenu />
            {/* Wrapper controls visibility: Button's own inline-flex would override a "hidden" class. */}
            <div className="ml-1 hidden sm:block">
              <Button variant="primary" size="sm" onClick={() => newNote()}>
                <Plus className="size-4" />
                New note
              </Button>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-3 pb-28 pt-5 sm:px-5 lg:pb-10">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
                <p className="mt-0.5 text-[13px] text-muted" aria-live="polite">
                  {deferredSearch.trim()
                    ? `${visibleNotes.length} ${visibleNotes.length === 1 ? "result" : "results"} for “${deferredSearch.trim()}”`
                    : nav.view === "trash"
                      ? "Notes in trash can be restored or deleted forever."
                      : `${visibleNotes.length} ${visibleNotes.length === 1 ? "note" : "notes"}`}
                </p>
              </div>
              {nav.view === "trash" && counts.trash > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setConfirm({
                      title: "Empty trash?",
                      description: `${counts.trash} ${counts.trash === 1 ? "note" : "notes"} will be permanently deleted.`,
                      label: "Empty trash",
                      action: () => {
                        dispatch({ type: "EMPTY_TRASH" });
                        pushToast("Trash emptied");
                      },
                    })
                  }
                >
                  <Trash2 className="size-4" />
                  Empty trash
                </Button>
              ) : null}
            </div>

            {nav.view === "all" && !deferredSearch.trim() ? (
              <UpcomingStrip
                groups={reminderGroups}
                now={now}
                onOpen={openNoteById}
                onSeeAll={() => go({ view: "reminders" })}
              />
            ) : null}

            {nav.view === "reminders" ? (
              <RemindersView
                groups={reminderGroups}
                matches={matches}
                renderCards={renderCards}
                onNewNote={() => newNote()}
              />
            ) : visibleNotes.length === 0 ? (
              <ViewEmptyState
                view={nav.view}
                searching={!!deferredSearch.trim()}
                categoryName={activeCategory?.name}
                onClearSearch={() => setSearch("")}
                onNewNote={() => newNote()}
              />
            ) : nav.view === "all" || nav.view === "category" ? (
              <PinnedSections notes={visibleNotes} renderCards={renderCards} />
            ) : (
              renderCards(visibleNotes)
            )}
          </div>
        </main>
      </div>

      {/* Mobile floating action button */}
      <button
        type="button"
        onClick={() => newNote()}
        aria-label="New note"
        className="fixed bottom-5 right-5 z-20 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:hidden"
      >
        <Plus className="size-6" />
      </button>

      {openNote ? (
        <NoteEditor
          key={openNote.id}
          note={openNote}
          categories={state.categories}
          dispatch={dispatch}
          onClose={closeNote}
          onDuplicate={duplicate}
          onToggleArchive={toggleArchive}
          onTrash={trash}
          onRestore={restore}
          onPurge={purge}
        />
      ) : null}

      <CategoryDialog
        state={categoryDialog}
        onClose={() => setCategoryDialog(null)}
        onSubmit={(name, color) => {
          if (categoryDialog?.mode === "edit") {
            dispatch({ type: "UPDATE_CATEGORY", id: categoryDialog.category.id, patch: { name, color } });
          } else {
            dispatch({ type: "ADD_CATEGORY", name, color });
            pushToast(`Category “${name}” created`);
          }
          setCategoryDialog(null);
        }}
        existingNames={state.categories
          .filter((c) => categoryDialog?.mode !== "edit" || c.id !== categoryDialog.category.id)
          .map((c) => c.name.toLowerCase())}
      />

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        footer={
          <>
            <Button size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                confirm?.action();
                setConfirm(null);
              }}
            >
              {confirm?.label}
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Sidebar({
  open,
  nav,
  counts,
  categories,
  onNavigate,
  onClose,
  onNewNote,
  onNewCategory,
  onEditCategory,
  onDeleteCategory,
}: {
  open: boolean;
  nav: Nav;
  counts: { all: number; pinned: number; reminders: number; overdue: number; archive: number; trash: number; byCategory: (id: string) => number };
  categories: Category[];
  onNavigate: (nav: Nav) => void;
  onClose: () => void;
  onNewNote: () => void;
  onNewCategory: () => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
}) {
  // Off-canvas on small screens: make the closed drawer unreachable by keyboard/AT.
  const isDesktop = useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia("(min-width: 1024px)");
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );

  const item = (view: Exclude<NavView, "category">, icon: ReactNode, count: number, extra?: ReactNode) => {
    const active = nav.view === view;
    return (
      <li>
        <button
          type="button"
          aria-current={active ? "page" : undefined}
          onClick={() => onNavigate({ view })}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
            active ? "bg-surface-2 font-medium text-text" : "text-muted hover:bg-surface-2/60 hover:text-text",
          )}
        >
          <span className={cn("flex size-4 items-center justify-center", active && "text-accent")}>{icon}</span>
          <span className="flex-1 text-left">{VIEW_TITLE[view]}</span>
          {extra}
          {count > 0 ? <span className="text-[11px] tabular-nums text-faint">{count}</span> : null}
        </button>
      </li>
    );
  };

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out",
        "lg:static lg:translate-x-0 lg:bg-surface/60",
        open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
      )}
      inert={!open && !isDesktop}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
          <NotebookText className="size-4" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Notebook</span>
        <IconButton label="Close navigation" size="sm" className="ml-auto lg:hidden" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>

      <div className="px-3 py-2">
        <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onNewNote}>
          <Plus className="size-4" />
          New note
          <kbd className="ml-auto font-mono text-[10px] text-faint">N</kbd>
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Notes navigation">
        <ul className="space-y-0.5">
          {item("all", <Inbox className="size-4" />, counts.all)}
          {item("pinned", <Pin className="size-4" />, counts.pinned)}
          {item(
            "reminders",
            <Bell className="size-4" />,
            counts.overdue > 0 ? 0 : counts.reminders,
            counts.overdue > 0 ? <Badge tone="danger">{counts.overdue} overdue</Badge> : null,
          )}
        </ul>

        <div className="mb-1 mt-6 flex items-center justify-between px-2.5">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-faint">Categories</h2>
          <IconButton label="New category" size="sm" onClick={onNewCategory}>
            <FolderPlus className="size-3.5" />
          </IconButton>
        </div>
        <ul className="space-y-0.5">
          {categories.map((category) => {
            const active = nav.view === "category" && nav.categoryId === category.id;
            const count = counts.byCategory(category.id);
            return (
              <li key={category.id} className="group/cat relative">
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate({ view: "category", categoryId: category.id })}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg py-[7px] pl-2.5 pr-9 text-[13px] transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                    active ? "bg-surface-2 font-medium text-text" : "text-muted hover:bg-surface-2/60 hover:text-text",
                  )}
                >
                  <span className="flex size-4 items-center justify-center">
                    <span data-note-color={category.color} className="note-tint-strong size-2.5 rounded-full ring-1 ring-border-strong" />
                  </span>
                  <span className="flex-1 truncate text-left">{category.name}</span>
                  {count > 0 ? (
                    <span className="text-[11px] tabular-nums text-faint [@media(hover:hover)]:group-hover/cat:invisible">{count}</span>
                  ) : null}
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/cat:opacity-100 [@media(hover:hover)]:group-focus-within/cat:opacity-100">
                  <Menu
                    width="w-44"
                    trigger={(props) => (
                      <IconButton label={`${category.name} options`} size="sm" {...props}>
                        <MoreHorizontal className="size-3.5" />
                      </IconButton>
                    )}
                  >
                    {(close) => (
                      <>
                        <MenuItem
                          icon={<Pencil className="size-3.5" />}
                          onSelect={() => {
                            close();
                            onEditCategory(category);
                          }}
                        >
                          Rename
                        </MenuItem>
                        <MenuItem
                          danger
                          icon={<Trash2 className="size-3.5" />}
                          onSelect={() => {
                            close();
                            onDeleteCategory(category);
                          }}
                        >
                          Delete
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </div>
              </li>
            );
          })}
          {categories.length === 0 ? (
            <li>
              <button
                type="button"
                onClick={onNewCategory}
                className="w-full rounded-lg px-2.5 py-2 text-left text-[12px] text-faint hover:bg-surface-2/60 hover:text-muted"
              >
                Create a category to organize notes
              </button>
            </li>
          ) : null}
        </ul>

        <ul className="mt-6 space-y-0.5">
          {item("archive", <Archive className="size-4" />, counts.archive)}
          {item("trash", <Trash2 className="size-4" />, counts.trash)}
        </ul>
      </nav>

      <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-faint">
        Saved locally in this browser.
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ */

function ThemeMenu() {
  const { theme, resolved, setTheme } = useTheme();
  const options: { value: ThemePreference; label: string; icon: ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="size-3.5" /> },
    { value: "dark", label: "Dark", icon: <Moon className="size-3.5" /> },
    { value: "system", label: "System", icon: <Monitor className="size-3.5" /> },
  ];
  return (
    <Menu
      width="w-40"
      trigger={(props) => (
        <IconButton label={`Theme: ${theme}`} {...props}>
          {resolved === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </IconButton>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Theme</MenuLabel>
          {options.map((option) => (
            <MenuItem
              key={option.value}
              icon={option.icon}
              selected={theme === option.value}
              onSelect={() => {
                setTheme(option.value);
                close();
              }}
            >
              {option.label}
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  );
}

function PinnedSections({ notes, renderCards }: { notes: Note[]; renderCards: (notes: Note[]) => ReactNode }) {
  const pinned = notes.filter((note) => note.pinned);
  const others = notes.filter((note) => !note.pinned);
  if (pinned.length === 0) return <>{renderCards(others)}</>;
  return (
    <div className="space-y-7">
      <section aria-labelledby="pinned-heading">
        <h2 id="pinned-heading" className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
          <Pin className="size-3" /> Pinned
        </h2>
        {renderCards(pinned)}
      </section>
      {others.length > 0 ? (
        <section aria-labelledby="others-heading">
          <h2 id="others-heading" className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-faint">
            Others
          </h2>
          {renderCards(others)}
        </section>
      ) : null}
    </div>
  );
}

const GROUP_META: Record<ReminderGroup, { title: string; tone: string }> = {
  overdue: { title: "Overdue", tone: "text-danger" },
  today: { title: "Today", tone: "text-accent" },
  upcoming: { title: "Upcoming", tone: "text-muted" },
  done: { title: "Notified", tone: "text-faint" },
};

function UpcomingStrip({
  groups,
  now,
  onOpen,
  onSeeAll,
}: {
  groups: Record<ReminderGroup, Note[]>;
  now: number;
  onOpen: (id: string) => void;
  onSeeAll: () => void;
}) {
  const items = [...groups.overdue, ...groups.today, ...groups.upcoming].slice(0, 4);
  if (items.length === 0 || !now) return null;
  return (
    <section aria-labelledby="upcoming-heading" className="mb-7 rounded-2xl border border-border bg-surface p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="upcoming-heading" className="flex items-center gap-2 text-[13px] font-semibold">
          <BellRing className="size-4 text-accent" />
          Upcoming reminders
        </h2>
        <Button variant="ghost" size="sm" onClick={onSeeAll}>
          See all
        </Button>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {items.map((note) => {
          const due = effectiveDue(note.reminder!);
          const overdue = due < now;
          return (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => onOpen(note.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span data-note-color={note.color} className="note-tint-strong size-2 shrink-0 rounded-full" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{note.title.trim() || "Untitled"}</span>
                <span className={cn("shrink-0 text-xs", overdue ? "font-medium text-danger" : "text-muted")}>
                  {overdue ? "Overdue · " : ""}
                  {formatRelative(due, now)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RemindersView({
  groups,
  matches,
  renderCards,
  onNewNote,
}: {
  groups: Record<ReminderGroup, Note[]>;
  matches: (note: Note) => boolean;
  renderCards: (notes: Note[]) => ReactNode;
  onNewNote: () => void;
}) {
  const { permission, request } = useNotificationPermission();
  const filtered = (Object.keys(GROUP_META) as ReminderGroup[]).map((key) => ({ key, notes: groups[key].filter(matches) }));
  const total = filtered.reduce((sum, group) => sum + group.notes.length, 0);

  return (
    <div className="space-y-7">
      {permission === "default" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-4">
          <BellRing className="size-5 shrink-0 text-accent" />
          <p className="min-w-0 flex-1 text-[13px]">
            Turn on browser notifications to get alerted when a reminder is due.
          </p>
          <Button size="sm" variant="primary" onClick={() => void request()}>
            Enable notifications
          </Button>
        </div>
      ) : permission === "denied" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-[13px] text-muted">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          Notifications are blocked for this site. Reminders still show inside the app; allow notifications in your browser’s site settings to get system alerts.
        </div>
      ) : null}

      <p className="text-[12px] leading-relaxed text-faint">
        Reminders fire while this app is open in a browser tab. Missed reminders show as overdue the next time you open it.
      </p>

      {total === 0 ? (
        <EmptyState
          icon={<Bell className="size-6" />}
          title="No reminders"
          description="Open any note and choose “Add reminder” to get notified at a specific time — once, or on a repeating schedule."
          action={
            <Button variant="primary" size="sm" onClick={onNewNote}>
              <Plus className="size-4" />
              New note
            </Button>
          }
        />
      ) : (
        filtered.map(({ key, notes }) =>
          notes.length > 0 ? (
            <section key={key} aria-labelledby={`group-${key}`} data-testid={`reminder-group-${key}`}>
              <h2 id={`group-${key}`} className={cn("mb-2.5 text-[11px] font-semibold uppercase tracking-wide", GROUP_META[key].tone)}>
                {GROUP_META[key].title} · {notes.length}
              </h2>
              {renderCards(notes)}
            </section>
          ) : null,
        )
      )}
    </div>
  );
}

function ViewEmptyState({
  view,
  searching,
  categoryName,
  onClearSearch,
  onNewNote,
}: {
  view: NavView;
  searching: boolean;
  categoryName?: string;
  onClearSearch: () => void;
  onNewNote: () => void;
}) {
  if (searching) {
    return (
      <EmptyState
        icon={<Search className="size-6" />}
        title="No matching notes"
        description="Search looks through titles, note content, checklist items, and category names."
        action={
          <Button size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      />
    );
  }
  const content: Record<NavView, { icon: ReactNode; title: string; description: string; cta: boolean }> = {
    all: { icon: <NotebookText className="size-6" />, title: "Your notebook is empty", description: "Capture ideas, plans, and checklists. Everything saves automatically.", cta: true },
    pinned: { icon: <Pin className="size-6" />, title: "No pinned notes", description: "Pin important notes to keep them at the top of your notebook.", cta: false },
    category: { icon: <Check className="size-6" />, title: `Nothing in ${categoryName ?? "this category"} yet`, description: "New notes created here are filed in this category automatically.", cta: true },
    archive: { icon: <Archive className="size-6" />, title: "Archive is empty", description: "Archive notes you want to keep but don’t need to see every day.", cta: false },
    trash: { icon: <Trash2 className="size-6" />, title: "Trash is empty", description: "Deleted notes stay here until you delete them forever.", cta: false },
    reminders: { icon: <Bell className="size-6" />, title: "No reminders", description: "", cta: true },
  };
  const c = content[view];
  return (
    <EmptyState
      icon={c.icon}
      title={c.title}
      description={c.description}
      action={
        c.cta ? (
          <Button variant="primary" size="sm" onClick={onNewNote}>
            <Plus className="size-4" />
            New note
          </Button>
        ) : undefined
      }
    />
  );
}

function CategoryDialog({
  state,
  onClose,
  onSubmit,
  existingNames,
}: {
  state: { mode: "create" } | { mode: "edit"; category: Category } | null;
  onClose: () => void;
  onSubmit: (name: string, color: NoteColor) => void;
  existingNames: string[];
}) {
  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={state?.mode === "edit" ? "Edit category" : "New category"}
      description="Categories group related notes in the sidebar."
    >
      {state ? (
        <CategoryForm
          key={state.mode === "edit" ? state.category.id : "new"}
          initial={state.mode === "edit" ? state.category : undefined}
          existingNames={existingNames}
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
}

function CategoryForm({
  initial,
  existingNames,
  onCancel,
  onSubmit,
}: {
  initial?: Category;
  existingNames: string[];
  onCancel: () => void;
  onSubmit: (name: string, color: NoteColor) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<NoteColor>(initial?.color ?? "blue");
  const trimmed = name.trim();
  const duplicate = existingNames.includes(trimmed.toLowerCase());
  const invalid = !trimmed || duplicate;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) onSubmit(trimmed, color);
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <label htmlFor="category-name" className="block text-[12px] font-medium text-muted">
          Name
        </label>
        <Input
          id="category-name"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Work"
          aria-invalid={duplicate}
          aria-describedby={duplicate ? "category-error" : undefined}
        />
        {duplicate ? (
          <p id="category-error" className="text-xs text-danger">
            A category with this name already exists.
          </p>
        ) : null}
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[12px] font-medium text-muted">Color</legend>
        <div className="flex flex-wrap gap-2">
          {NOTE_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`${option} category color`}
              aria-pressed={color === option}
              data-note-color={option}
              onClick={() => setColor(option)}
              className={cn(
                "note-tint-strong flex size-8 items-center justify-center rounded-full border border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                color === option && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
              )}
            >
              {color === option ? <Check className="size-3.5" /> : null}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" type="submit" variant="primary" disabled={invalid}>
          {initial ? "Save" : "Create category"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function NoteApp() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <NotesProvider>
          <AppShell />
        </NotesProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
