"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, GripVertical, Plus, X } from "lucide-react";
import type { ChecklistItem, Note } from "@/lib/types";
import type { NotesAction } from "@/lib/reducer";
import { IconButton } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { checklistProgress, cn, createId } from "@/lib/utils";

interface ChecklistProps {
  note: Note;
  dispatch: (action: NotesAction) => void;
}

/**
 * Interactive checklist. Every change dispatches immediately (auto-persisted).
 * Empty rows are kept while being edited and pruned when focus leaves the list.
 */
export function Checklist({ note, dispatch }: ChecklistProps) {
  const noteId = note.id;
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const progress = checklistProgress(note);

  const visible = note.hideCompleted ? note.items.filter((item) => !item.done) : note.items;
  const pending = visible.filter((item) => !item.done);
  const completed = visible.filter((item) => item.done);
  const hiddenCount = note.items.length - visible.length;

  const focusItem = (id: string) => {
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLInputElement>(`[data-item-input="${id}"]`)?.focus();
    });
  };

  const indexOf = (id: string) => note.items.findIndex((item) => item.id === id);

  const move = (id: string, direction: -1 | 1) => {
    // Move relative to neighbours in the same (pending/completed) group so
    // hidden or cross-group items do not make the button appear to do nothing.
    const group = note.items.find((item) => item.id === id)?.done ? completed : pending;
    const position = group.findIndex((item) => item.id === id);
    const target = group[position + direction];
    if (!target) return;
    dispatch({ type: "MOVE_ITEM", noteId, from: indexOf(id), to: indexOf(target.id) });
  };

  const addFromDraft = () => {
    const text = draft.trim();
    if (!text) return;
    dispatch({ type: "ADD_ITEM", noteId, text });
    setDraft("");
  };

  const handleItemKeyDown = (event: KeyboardEvent<HTMLInputElement>, item: ChecklistItem) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const id = createId();
      dispatch({ type: "ADD_ITEM", noteId, text: "", itemId: id, afterId: item.id });
      focusItem(id);
    } else if (event.key === "Backspace" && item.text === "") {
      event.preventDefault();
      const group = item.done ? completed : pending;
      const position = group.findIndex((candidate) => candidate.id === item.id);
      const previous = group[position - 1];
      dispatch({ type: "DELETE_ITEM", noteId, itemId: item.id });
      if (previous) focusItem(previous.id);
      else addRef.current?.focus();
    } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      move(item.id, event.key === "ArrowUp" ? -1 : 1);
      focusItem(item.id);
    }
  };

  const onDrop = (event: DragEvent, targetId: string) => {
    event.preventDefault();
    if (dragId && dragId !== targetId) {
      dispatch({ type: "MOVE_ITEM", noteId, from: indexOf(dragId), to: indexOf(targetId) });
    }
    setDragId(null);
    setOverId(null);
  };

  const renderItem = (item: ChecklistItem, position: number, group: ChecklistItem[]) => (
    <li
      key={item.id}
      onDragOver={(event) => {
        if (!dragId) return;
        event.preventDefault();
        setOverId(item.id);
      }}
      onDragLeave={() => setOverId((current) => (current === item.id ? null : current))}
      onDrop={(event) => onDrop(event, item.id)}
      data-testid="checklist-item"
      className={cn(
        "group/item flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors",
        "hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] focus-within:bg-[color-mix(in_srgb,var(--text)_4%,transparent)]",
        overId === item.id && dragId !== item.id && "ring-2 ring-accent/40",
        dragId === item.id && "opacity-40",
      )}
    >
      <span
        draggable
        onDragStart={(event) => {
          setDragId(item.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", item.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
        aria-hidden
        title="Drag to reorder"
        className="hidden cursor-grab text-faint active:cursor-grabbing sm:flex"
      >
        <GripVertical className="size-4" />
      </span>
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.text.trim() || "Empty item"}
        onClick={() => dispatch({ type: "TOGGLE_ITEM", noteId, itemId: item.id })}
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          item.done ? "border-accent bg-accent text-accent-fg" : "border-border-strong hover:border-accent",
        )}
      >
        {item.done ? <Check className="size-3" strokeWidth={3} /> : null}
      </button>
      <input
        data-item-input={item.id}
        value={item.text}
        onChange={(event) =>
          dispatch({ type: "UPDATE_ITEM", noteId, itemId: item.id, text: event.target.value })
        }
        onKeyDown={(event) => handleItemKeyDown(event, item)}
        aria-label="Checklist item text"
        placeholder="List item"
        className={cn(
          "min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-faint",
          item.done && "text-faint line-through",
        )}
      />
      {/* Always visible on touch screens and keyboard focus; revealed on hover with a mouse. */}
      <div className="flex shrink-0 items-center opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/item:opacity-100 [@media(hover:hover)]:group-focus-within/item:opacity-100">
        <IconButton label="Move item up" size="sm" disabled={position === 0} onClick={() => move(item.id, -1)}>
          <ArrowUp className="size-3.5" />
        </IconButton>
        <IconButton
          label="Move item down"
          size="sm"
          disabled={position === group.length - 1}
          onClick={() => move(item.id, 1)}
        >
          <ArrowDown className="size-3.5" />
        </IconButton>
        <IconButton
          label="Delete item"
          size="sm"
          tone="danger"
          onClick={() => dispatch({ type: "DELETE_ITEM", noteId, itemId: item.id })}
        >
          <X className="size-3.5" />
        </IconButton>
      </div>
    </li>
  );

  return (
    <section
      aria-label="Checklist"
      className="space-y-3"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          dispatch({ type: "PRUNE_EMPTY_ITEMS", noteId });
        }
      }}
    >
      {progress.total > 0 ? (
        <div className="flex items-center gap-3">
          <ProgressBar value={progress.done} max={progress.total} className="flex-1" />
          <span className="shrink-0 text-xs tabular-nums text-muted" data-testid="checklist-progress">
            {progress.done}/{progress.total} done
          </span>
          {progress.done > 0 ? (
            <button
              type="button"
              aria-pressed={note.hideCompleted}
              onClick={() => dispatch({ type: "SET_HIDE_COMPLETED", noteId, hide: !note.hideCompleted })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {note.hideCompleted ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              {note.hideCompleted ? "Show completed" : "Hide completed"}
            </button>
          ) : null}
        </div>
      ) : null}

      <ul ref={listRef} className="space-y-0.5">
        {pending.map((item, index) => renderItem(item, index, pending))}
      </ul>

      <div className="flex items-center gap-2 px-1">
        <Plus className="size-4 shrink-0 text-faint" aria-hidden />
        <input
          ref={addRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addFromDraft();
            }
          }}
          onBlur={addFromDraft}
          aria-label="Add checklist item"
          placeholder="Add item — press Enter"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-faint"
        />
      </div>

      {completed.length > 0 ? (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-faint">
            Completed · {completed.length}
          </p>
          <ul className="space-y-0.5">
            {completed.map((item, index) => renderItem(item, index, completed))}
          </ul>
        </div>
      ) : null}

      {hiddenCount > 0 ? (
        <p className="px-1 text-xs text-faint">
          {hiddenCount} completed {hiddenCount === 1 ? "item" : "items"} hidden
        </p>
      ) : null}
    </section>
  );
}
