"use client";

import { useEffect, useRef } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  Copy,
  Flag,
  ListChecks,
  MoreHorizontal,
  Palette,
  Pin,
  RotateCcw,
  Tag,
  Trash2,
  Type,
} from "lucide-react";
import type { Category, Note, Priority } from "@/lib/types";
import { NOTE_COLORS } from "@/lib/types";
import type { NotesAction } from "@/lib/reducer";
import { IconButton } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/overlays";
import { Checklist } from "@/components/checklist";
import { ReminderEditor } from "@/components/reminder-editor";
import { cn, priorityLabel } from "@/lib/utils";
import { formatDateTime } from "@/lib/time";

interface NoteEditorProps {
  note: Note;
  categories: Category[];
  dispatch: (action: NotesAction) => void;
  onClose: () => void;
  onDuplicate: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
}

const PRIORITIES: Priority[] = ["high", "medium", "low"];

export function NoteEditor({
  note,
  categories,
  dispatch,
  onClose,
  onDuplicate,
  onToggleArchive,
  onTrash,
  onRestore,
  onPurge,
}: NoteEditorProps) {
  const id = note.id;
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const readOnly = note.trashed;
  const category = categories.find((c) => c.id === note.categoryId);

  // Focus the title for brand-new empty notes, otherwise the panel itself.
  useEffect(() => {
    if (!note.title && !note.body && note.items.length === 0) titleRef.current?.focus();
    else panelRef.current?.focus();
    // Only when a different note is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Escape closes the editor regardless of where focus is, unless a menu/dialog handles it first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="menu"], [role="dialog"][aria-modal="true"]:not([data-editor])')) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Grow textareas to fit content (title and body).
  useEffect(() => {
    for (const el of [titleRef.current, bodyRef.current]) {
      if (!el) continue;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [note.title, note.body, note.type]);

  const update = (patch: Partial<Note>) => dispatch({ type: "UPDATE_NOTE", id, patch });

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-overlay anim-fade" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        data-editor
        aria-label={`Edit note: ${note.title.trim() || "Untitled"}`}
        data-note-color={note.color}
        className="relative flex h-full w-full flex-col bg-surface shadow-2xl outline-none anim-slide-up md:max-w-2xl md:border-l md:border-border"
      >
        {/* Color wash: tinted header area keeps the card colour visible while editing. */}
        <div className="note-tint pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />

        <header className="relative flex items-center gap-1 px-2 py-2 sm:px-3">
          <IconButton label="Close editor" onClick={onClose}>
            <ArrowLeft className="size-4" />
          </IconButton>
          {note.trashed ? (
            <span className="ml-1 text-[13px] font-medium text-danger">In trash — restore to edit</span>
          ) : note.archived ? (
            <span className="ml-1 text-[13px] text-muted">Archived</span>
          ) : null}

          <div className="ml-auto flex items-center gap-0.5">
            {note.trashed ? (
              <>
                <IconButton label="Restore note" onClick={() => onRestore(id)}>
                  <RotateCcw className="size-4" />
                </IconButton>
                <IconButton label="Delete forever" tone="danger" onClick={() => onPurge(id)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </>
            ) : (
              <>
                {!note.archived ? (
                  <IconButton
                    label={note.pinned ? "Unpin note" : "Pin note"}
                    active={note.pinned}
                    onClick={() => dispatch({ type: "TOGGLE_PIN", id })}
                  >
                    <Pin className={cn("size-4", note.pinned && "fill-current")} />
                  </IconButton>
                ) : null}

                <Menu
                  width="w-[11.5rem]"
                  trigger={(props) => (
                    <IconButton label="Note color" {...props}>
                      <Palette className="size-4" />
                    </IconButton>
                  )}
                >
                  {(close) => (
                    <div className="grid grid-cols-4 gap-1.5 p-1.5" role="group" aria-label="Note colors">
                      {NOTE_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          role="menuitemradio"
                          aria-checked={note.color === color}
                          aria-label={`${color} color`}
                          title={color}
                          data-note-color={color}
                          onClick={() => {
                            dispatch({ type: "SET_COLOR", id, color });
                            close();
                          }}
                          className={cn(
                            "note-tint-strong flex size-8 items-center justify-center rounded-full border border-border-strong transition-transform hover:scale-110",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                          )}
                        >
                          {note.color === color ? <Check className="size-3.5" /> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </Menu>

                <IconButton
                  label={note.archived ? "Unarchive note" : "Archive note"}
                  onClick={() => onToggleArchive(id)}
                >
                  {note.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                </IconButton>

                <Menu
                  trigger={(props) => (
                    <IconButton label="More actions" {...props}>
                      <MoreHorizontal className="size-4" />
                    </IconButton>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem
                        icon={<Copy className="size-3.5" />}
                        onSelect={() => {
                          onDuplicate(id);
                          close();
                        }}
                      >
                        Duplicate
                      </MenuItem>
                      <MenuItem
                        icon={note.type === "checklist" ? <Type className="size-3.5" /> : <ListChecks className="size-3.5" />}
                        onSelect={() => {
                          dispatch({
                            type: "SET_NOTE_TYPE",
                            noteId: id,
                            noteType: note.type === "checklist" ? "text" : "checklist",
                          });
                          close();
                        }}
                      >
                        {note.type === "checklist" ? "Convert checklist to text" : "Add checklist"}
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        danger
                        icon={<Trash2 className="size-3.5" />}
                        onSelect={() => {
                          close();
                          onTrash(id);
                        }}
                      >
                        Move to trash
                      </MenuItem>
                    </>
                  )}
                </Menu>
              </>
            )}
          </div>
        </header>

        <div className="relative flex-1 overflow-y-auto px-5 pb-10 sm:px-8">
          <textarea
            ref={titleRef}
            rows={1}
            value={note.title}
            readOnly={readOnly}
            onChange={(event) => update({ title: event.target.value.replace(/\n/g, " ") })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                bodyRef.current?.focus();
              }
            }}
            placeholder="Title"
            aria-label="Note title"
            className="w-full resize-none overflow-hidden bg-transparent pt-2 text-2xl font-semibold leading-tight tracking-tight outline-none placeholder:text-faint"
          />

          {/* Properties row — Notion-style */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Menu
              align="start"
              trigger={(props) => (
                <button
                  type="button"
                  {...props}
                  disabled={readOnly}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface/70 px-2.5 text-xs text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
                >
                  <Tag className="size-3" />
                  {category ? (
                    <>
                      <span data-note-color={category.color} className="note-tint-strong size-2 rounded-full" />
                      <span className="text-text">{category.name}</span>
                    </>
                  ) : (
                    "Add category"
                  )}
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuLabel>Category</MenuLabel>
                  <MenuItem
                    selected={!note.categoryId}
                    onSelect={() => {
                      dispatch({ type: "SET_CATEGORY", id, categoryId: null });
                      close();
                    }}
                  >
                    No category
                  </MenuItem>
                  {categories.map((c) => (
                    <MenuItem
                      key={c.id}
                      selected={note.categoryId === c.id}
                      icon={<span data-note-color={c.color} className="note-tint-strong size-2.5 rounded-full" />}
                      onSelect={() => {
                        dispatch({ type: "SET_CATEGORY", id, categoryId: c.id });
                        close();
                      }}
                    >
                      {c.name}
                    </MenuItem>
                  ))}
                  {categories.length === 0 ? (
                    <p className="px-2.5 py-1.5 text-xs text-faint">Create categories from the sidebar.</p>
                  ) : null}
                </>
              )}
            </Menu>

            <Menu
              align="start"
              trigger={(props) => (
                <button
                  type="button"
                  {...props}
                  disabled={readOnly}
                  aria-label={`Priority: ${priorityLabel(note.priority)}`}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface/70 px-2.5 text-xs text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
                >
                  <Flag className={cn("size-3", note.priority === "high" && "fill-danger text-danger")} />
                  <span className="text-text">{priorityLabel(note.priority)} priority</span>
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuLabel>Priority</MenuLabel>
                  {PRIORITIES.map((p) => (
                    <MenuItem
                      key={p}
                      selected={note.priority === p}
                      onSelect={() => {
                        dispatch({ type: "SET_PRIORITY", id, priority: p });
                        close();
                      }}
                    >
                      {priorityLabel(p)}
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
          </div>

          <textarea
            ref={bodyRef}
            value={note.body}
            readOnly={readOnly}
            onChange={(event) => update({ body: event.target.value })}
            placeholder={note.type === "checklist" ? "Add a description…" : "Start writing…"}
            aria-label="Note content"
            rows={note.type === "checklist" ? 1 : 6}
            className="mt-5 w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-faint"
          />

          {note.type === "checklist" ? (
            <div className={cn("mt-4", readOnly && "pointer-events-none opacity-60")} aria-disabled={readOnly}>
              <Checklist note={note} dispatch={dispatch} />
            </div>
          ) : !readOnly ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_NOTE_TYPE", noteId: id, noteType: "checklist" })}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <ListChecks className="size-4" />
              Add checklist
            </button>
          ) : null}

          {!readOnly ? (
            <div className="mt-8">
              <ReminderEditor note={note} dispatch={dispatch} />
            </div>
          ) : null}

          <p className="mt-6 text-[11px] text-faint">
            Created {formatDateTime(note.createdAt)} · Edited {formatDateTime(note.updatedAt)} · Saved automatically
          </p>
        </div>
      </div>
    </div>
  );
}
