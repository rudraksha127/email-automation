import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary shadow-xs hover:bg-[#004eaa] active:bg-[#004394] focus-visible:outline-primary",
  secondary:
    "border border-slate-200/80 bg-surface-container-low text-on-surface hover:bg-surface-container active:bg-surface-container-high focus-visible:outline-outline",
  ghost:
    "bg-primary-fixed text-on-primary-fixed hover:bg-primary-fixed/80 active:bg-primary-fixed/90 focus-visible:outline-primary",
  danger:
    "border border-error/20 bg-error-container text-on-error-container hover:bg-error-container/80 active:bg-error-container/90 focus-visible:outline-error",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Shows a spinner and blocks duplicate submissions while true. */
  loading?: boolean;
  fullWidth?: boolean;
}

/** Single button component so every action has identical height, radius and states. */
export function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        fullWidth && "w-full",
        VARIANTS[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
