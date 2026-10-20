import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover focus-visible:ring-accent/40",
  secondary:
    "bg-surface-2 text-text border border-border hover:border-border-strong hover:bg-[color-mix(in_srgb,var(--surface-2)_70%,var(--text)_6%)] focus-visible:ring-accent/30",
  ghost:
    "bg-transparent text-muted hover:text-text hover:bg-[color-mix(in_srgb,var(--text)_7%,transparent)] focus-visible:ring-accent/30",
  danger:
    "bg-danger text-white hover:bg-danger-hover focus-visible:ring-danger/40 dark:text-black",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-9.5 px-4 text-sm gap-2 rounded-xl",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: Size;
  active?: boolean;
  tone?: "default" | "danger" | "accent";
  children: ReactNode;
}

const iconSizeClasses: Record<Size, string> = {
  sm: "size-7 rounded-md",
  md: "size-9 rounded-lg",
  lg: "size-10 rounded-xl",
};

const toneClasses = {
  default: "text-muted hover:text-text hover:bg-[color-mix(in_srgb,var(--text)_7%,transparent)]",
  danger:
    "text-muted hover:text-danger hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]",
  accent:
    "text-accent hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]",
};

export function IconButton({
  label,
  size = "md",
  active = false,
  tone = "default",
  className,
  type = "button",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
        "disabled:pointer-events-none disabled:opacity-50",
        iconSizeClasses[size],
        toneClasses[tone],
        active &&
          "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
