"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
  tone: "default" | "danger";
}

interface ToastContextValue {
  pushToast: (
    message: string,
    options?: { action?: ToastAction; tone?: "default" | "danger"; durationMs?: number },
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback<ToastContextValue["pushToast"]>(
    (message, options) => {
      const id = nextId.current++;
      const toast: ToastItem = {
        id,
        message,
        action: options?.action,
        tone: options?.tone ?? "default",
      };
      setToasts((current) => [...current.slice(-2), toast]);
      window.setTimeout(() => dismiss(id), options?.durationMs ?? 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xl anim-toast"
          >
            <span className="flex-1 text-[13px] leading-snug">
              {toast.message}
            </span>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
                className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-accent transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-lg p-1 text-faint transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
