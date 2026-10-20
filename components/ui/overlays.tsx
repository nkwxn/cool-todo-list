"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";

function useEscapeKey(enabled: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onEscape]);
}

function useOutsideClick(
  refs: RefObject<HTMLElement | null>[],
  enabled: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (refs.every((ref) => !ref.current || !ref.current.contains(target))) {
        onOutside();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [refs, enabled, onOutside]);
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button, [tabindex]:not([tabindex='-1'])",
    );
    first?.focus();
    return () => previous?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-overlay backdrop-blur-[2px]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative w-full rounded-2xl border border-border bg-surface shadow-2xl anim-scale-in",
          maxWidth,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-[13px] text-muted">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface MenuProps {
  trigger: (props: {
    ref: RefObject<HTMLButtonElement | null>;
    id: string;
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: string;
}

export function Menu({ trigger, children, align = "end", width = "w-56" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();

  // Return focus to the trigger (looked up by id so render never touches refs).
  const close = () => {
    setOpen(false);
    document.getElementById(triggerId)?.focus();
  };

  useEscapeKey(open, close);
  useOutsideClick([menuRef, buttonRef], open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>(
      "button, a, input, [tabindex]:not([tabindex='-1'])",
    );
    first?.focus();
  }, [open]);

  return (
    <div className="relative">
      {trigger({
        ref: buttonRef,
        id: triggerId,
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-haspopup": "menu",
      })}
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            "absolute z-40 mt-1.5 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl anim-scale-in",
            align === "end" ? "right-0" : "left-0",
            width,
          )}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}

interface MenuItemProps {
  onSelect: () => void;
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  selected?: boolean;
}

export function MenuItem({
  onSelect,
  children,
  icon,
  danger,
  disabled,
  selected,
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        danger
          ? "text-danger hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
          : "text-text hover:bg-surface-2",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {icon ? (
        <span className="flex size-4 shrink-0 items-center justify-center text-muted">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{children}</span>
      {selected ? (
        <span className="text-[11px] text-accent" aria-hidden>
          ✓
        </span>
      ) : null}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" role="separator" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-faint">
      {children}
    </div>
  );
}
