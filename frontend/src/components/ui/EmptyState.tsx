import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { Spinner } from "./Spinner";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Shared empty-state card — clear, professional, actionable. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-bold text-slate-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Full-area loading state used by every list page. */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-slate-400">
      <Spinner />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

/** Full-area error state with an optional retry action. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-100 bg-rose-50/60 px-6 py-10 text-center">
      <p className="text-sm font-bold text-rose-700">Something went wrong</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-rose-600">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200 transition-colors hover:bg-rose-50"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
