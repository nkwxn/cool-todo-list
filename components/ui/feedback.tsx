import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "danger" | "warning" | "success";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted border-border",
    accent:
      "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent border-[color-mix(in_srgb,var(--accent)_25%,transparent)]",
    danger:
      "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger border-[color-mix(in_srgb,var(--danger)_25%,transparent)]",
    warning:
      "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-warning border-[color-mix(in_srgb,var(--warning)_28%,transparent)]",
    success:
      "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-success border-[color-mix(in_srgb,var(--success)_25%,transparent)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  className,
  label = "Checklist progress",
}: {
  value: number;
  max: number;
  className?: string;
  label?: string;
}) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={`${label}: ${value} of ${max} done`}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-border", className)}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center anim-fade",
        className,
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border bg-surface text-faint">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-xl bg-surface-2", className)}
    />
  );
}

