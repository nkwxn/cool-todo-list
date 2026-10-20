"use client";

import { memo } from "react";
import { Archive, ArchiveRestore, Bell, Flag, Pin, Repeat, RotateCcw, Trash2 } from "lucide-react";
import type { Category, Note, ViewMode } from "@/lib/types";
import { IconButton } from "@/components/ui/button";
import { Badge, ProgressBar } from "@/components/ui/feedback";
import { checklistProgress, cn } from "@/lib/utils";
import { formatRelative, formatUpdated } from "@/lib/time";
import { effectiveDue, reminderGroup } from "@/lib/reminders";

interface NoteCardProps {
  note: Note;
  category?: Category;
  view: ViewMode;
  now: number;
  onOpen: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
}

/**
 * The card is an <article> containing one full-size "open" button plus
 * sibling action buttons, so no interactive element is nested in another.
 */
export const NoteCard = memo(function NoteCard({
  note,
  category,
  view,
  now,
  onOpen,
  onTogglePin,
  onToggleArchive,
  onTrash,
  onRestore,
}: NoteCardProps) {
  const progress = checklistProgress(note);
  const title = note.title.trim() || "Untitled";
  const visibleItems = (note.hideCompleted ? note.items.filter((item) => !item.done) : note.items).filter(
    (item) => item.text.trim(),
  );
  const group = note.reminder && now ? reminderGroup(note, now) : null;
  const isList = view === "list";

  return (
    <article
      data-note-color={note.color}
      data-testid="note-card"
      aria-label={title}
      className={cn(
        "group relative flex rounded-2xl border border-border note-tint transition-[box-shadow,border-color] duration-150",
        "hover:border-border-strong hover:shadow-[0_4px_16px_-6px_rgb(var(--shadow-color)/0.18)]",
        "focus-within:border-border-strong",
        isList ? "flex-row items-center gap-4 px-4 py-3" : "flex-col p-4",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(note.id)}
        aria-label={`Open note: ${title}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      />

      <div className={cn("pointer-events-none relative min-w-0 flex-1", !isList && "space-y-2.5 pr-6")}>
        <div className="flex items-center gap-2">
          {note.priority === "high" ? (
            <Flag className="size-3.5 shrink-0 fill-danger text-danger" aria-label="High priority" />
          ) : null}
          <h3 className={cn("min-w-0 font-semibold leading-snug", isList ? "truncate text-sm" : "line-clamp-2 text-[15px]")}>
            {title}
          </h3>
        </div>

        {!isList && note.body.trim() ? (
          <p className="line-clamp-5 whitespace-pre-line text-[13px] leading-relaxed text-muted">{note.body.trim()}</p>
        ) : null}

        {!isList && visibleItems.length > 0 ? (
          <ul className="space-y-1">
            {visibleItems.slice(0, 5).map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-[13px]">
                <span
                  aria-hidden
                  className={cn(
                    "mt-[3px] size-3 shrink-0 rounded-[3px] border",
                    item.done ? "border-accent bg-accent" : "border-border-strong",
                  )}
                />
                <span className={cn("line-clamp-1", item.done ? "text-faint line-through" : "text-muted")}>
                  {item.text}
                </span>
              </li>
            ))}
            {visibleItems.length > 5 ? (
              <li className="pl-5 text-xs text-faint">+{visibleItems.length - 5} more</li>
            ) : null}
          </ul>
        ) : null}

        {progress.total > 0 ? (
          <div className={cn("flex items-center gap-2", isList && "mt-1 max-w-56")}>
            <ProgressBar value={progress.done} max={progress.total} className="flex-1" />
            <span className="text-[11px] tabular-nums text-faint">
              {progress.done}/{progress.total}
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
          {note.reminder && group ? (
            <Badge tone={group === "overdue" ? "danger" : group === "done" ? "neutral" : "accent"}>
              <Bell className="size-3" />
              {group === "done" ? "Done" : formatRelative(effectiveDue(note.reminder), now)}
              {note.reminder.recurrence !== "none" ? <Repeat className="size-3" aria-label="Repeats" /> : null}
            </Badge>
          ) : null}
          {category ? (
            <Badge>
              <span data-note-color={category.color} className="note-tint-strong size-2 rounded-full" aria-hidden />
              {category.name}
            </Badge>
          ) : null}
          {progress.total > 0 && progress.done < progress.total ? (
            <span>{progress.total - progress.done} open</span>
          ) : null}
          <span className="ml-auto">{now ? formatUpdated(note.updatedAt, now) : null}</span>
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none flex shrink-0 items-center gap-0.5 [&_button]:pointer-events-auto",
          isList ? "relative" : "absolute right-2 top-2 w-7 flex-col",
          // Always visible on touch; on mouse devices revealed on hover/focus.
          "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100",
          note.pinned && "[@media(hover:hover)]:opacity-100",
        )}
      >
        {note.trashed ? (
          <IconButton label={`Restore ${title}`} size="sm" onClick={() => onRestore(note.id)}>
            <RotateCcw className="size-3.5" />
          </IconButton>
        ) : (
          <>
            {!note.archived ? (
              <IconButton
                label={note.pinned ? `Unpin ${title}` : `Pin ${title}`}
                size="sm"
                active={note.pinned}
                onClick={() => onTogglePin(note.id)}
              >
                <Pin className={cn("size-3.5", note.pinned && "fill-current")} />
              </IconButton>
            ) : null}
            <span className={cn("contents", note.pinned && "[@media(hover:hover)]:[&>*]:opacity-0 [@media(hover:hover)]:group-hover:[&>*]:opacity-100 [@media(hover:hover)]:group-focus-within:[&>*]:opacity-100")}>
              <IconButton
                label={note.archived ? `Unarchive ${title}` : `Archive ${title}`}
                size="sm"
                onClick={() => onToggleArchive(note.id)}
              >
                {note.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
              </IconButton>
              <IconButton label={`Move ${title} to trash`} size="sm" tone="danger" onClick={() => onTrash(note.id)}>
                <Trash2 className="size-3.5" />
              </IconButton>
            </span>
          </>
        )}
      </div>
    </article>
  );
});
