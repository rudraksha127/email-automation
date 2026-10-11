import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { statusLabel } from "@/utils/format";
import type { MailStatus } from "@/types";

/** Pill container for small metadata/status text — matches the approved reference. */
export function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide",
        className
      )}
    >
      {children}
    </span>
  );
}

const STATUS_PILL_STYLES: Record<MailStatus, string> = {
  pending: "bg-primary-fixed text-on-primary-fixed",
  forwarded: "bg-secondary-container text-on-secondary-container",
  needs_review: "bg-amber-100 text-amber-900",
  failed: "bg-error-container text-on-error-container",
};

/** Small, meaningful status badge for mail processing states. */
export function StatusBadge({ status, className }: { status: MailStatus; className?: string }) {
  return (
    <Pill className={cn(STATUS_PILL_STYLES[status], className)}>{statusLabel(status)}</Pill>
  );
}

/** Slate chip used for batch names in list rows. */
export function BatchChip({ label, className }: { label?: string | null; className?: string }) {
  if (!label) return <span className="text-[10px] text-slate-300">—</span>;
  return (
    <Pill
      className={cn(
        "rounded-lg border border-slate-200/80 bg-surface-container-low font-semibold text-on-surface-variant",
        className
      )}
    >
      {label}
    </Pill>
  );
}
