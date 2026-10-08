import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700 active:bg-brand-800 focus-visible:outline-brand-600",
  secondary:
    "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-slate-400",
  ghost: "bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-100 focus-visible:outline-brand-500",
  danger:
    "border border-rose-300 bg-white text-rose-600 hover:bg-rose-50 active:bg-rose-100 focus-visible:outline-rose-400",
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
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
