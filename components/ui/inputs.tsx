"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const fieldClasses =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-faint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-transparent";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClasses, "h-10", className)} {...props} />;
}


export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClasses, "h-10 cursor-pointer pr-8", className)} {...props}>
      {children}
    </select>
  );
}


interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            id={`${id}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              selected
                ? "bg-surface-2 text-text shadow-sm"
                : "text-muted hover:text-text",
            )}
          >
            {option.icon}
            {option.label ? (
              <span className="hidden sm:inline">{option.label}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
