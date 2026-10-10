import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { statusLabel } from "@/utils/format";
import type { MailStatus } from "@/types";

/** Pill container for small metadata/status text — matches the approved mockups. */
export function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}

const STATUS_PILL_STYLES: Record<MailStatus, string> = {
  pending: "bg-brand-50 text-brand-700",
  forwarded: "bg-emerald-50 text-emerald-700",
  needs_review: "bg-amber-50 text-amber-700",
  failed: "bg-rose-50 text-rose-700",
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
        "rounded-md border border-slate-200/70 bg-slate-50 font-semibold text-slate-600",
        className
      )}
    >
      {label}
    </Pill>
  );
}
