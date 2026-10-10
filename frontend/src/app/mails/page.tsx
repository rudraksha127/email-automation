"use client";


import Link from "next/link";
import { useState } from "react";
import { paths } from "@/routes/paths";
import { PageHeading, AppLayout } from "@/components/layout";
import { StatusBadge, BatchChip } from "@/components/ui/Badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/EmptyState";
import { SearchIcon, MailIcon } from "@/components/icons";
import { useAsync } from "@/hooks/useAsync";
import { useDebounced } from "@/hooks/useDebounced";
import { mailsService } from "@/services";
import { avatarInitial, formatRelativeTimestamp, statusLabel } from "@/utils/format";
import { cn } from "@/utils/cn";
import { ALL_STATUSES } from "@/services/mails/mailsService";
import type { MailStatus } from "@/types";
import type { MailSummary } from "@/services/mails/mailsService";

type StatusFilter = MailStatus | "all";

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  ...ALL_STATUSES.map((s) => ({ value: s as StatusFilter, label: statusLabel(s) })),
];

export default function MailsPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // One API call per typing pause instead of one per keystroke.
  const debouncedSearch = useDebounced(search, 300);

  const mails = useAsync<MailSummary[]>(
    () => mailsService.list({ status, search: debouncedSearch }),
    [status, debouncedSearch]
  );

  return (
    <AppLayout>
      <PageHeading title="Mails" subtitle="All incoming department emails" />

      {/* Search + status filter pills */}
      <section className="mb-3 space-y-2">
        <div className="flex items-center justify-between">
          <nav aria-label="Status filters" className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                aria-pressed={status === f.value}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition active:scale-95",
                  status === f.value
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                )}
              >
                {f.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            aria-label="Toggle search"
            aria-expanded={showSearch}
            onClick={() => {
              setShowSearch((s) => !s);
              if (showSearch) setSearch("");
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-200/60"
          >
            <SearchIcon className="h-5 w-5" />
          </button>
        </div>

        {showSearch ? (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <SearchIcon className="h-4 w-4" />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by sender or subject"
              aria-label="Search mails"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
            />
          </div>
        ) : null}
      </section>

      {/* Mail list */}
      {mails.error ? (
        <ErrorState message={mails.error} onRetry={mails.reload} />
      ) : mails.loading ? (
        <LoadingState label="Loading mails…" />
      ) : (mails.data ?? []).length === 0 ? (
        <EmptyState
          icon={<MailIcon className="h-6 w-6" />}
          title={search || status !== "all" ? "No matching mails" : "No mails yet"}
          description={
            search || status !== "all"
              ? "Try a different search or filter."
              : "Incoming departmental mails will appear here once processing begins."
          }
        />
      ) : (
        <>
          {/* Mobile / tablet: approved card list */}
          <div className="space-y-2.5 lg:hidden">
            {(mails.data ?? []).map((m) => (
              <Link
                key={m.id}
                href={paths.mailDetails(m.id)}
                className="flex items-start space-x-3 rounded-2xl border border-slate-100/80 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-200"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-slate-100 text-xs font-semibold text-slate-700">
                  {avatarInitial(m.sender)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-0.5 flex items-baseline justify-between">
                    <span className="truncate pr-2 text-xs font-bold text-slate-900">{m.sender}</span>
                    <time className="shrink-0 text-[10px] font-medium text-slate-400">
                      {formatRelativeTimestamp(m.receivedAt)}
                    </time>
                  </span>
                  <span className="mb-2.5 block truncate text-xs font-medium text-slate-600">
                    {m.subject}
                  </span>
                  <span className="flex items-center justify-between">
                    <BatchChip label={m.batchName} />
                    <StatusBadge status={m.status} />
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {/* Desktop: data table per the Stitch mails-directory reference */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs lg:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/60 text-[11px] font-medium text-slate-400">
                  <th scope="col" className="py-3 px-4">Sender</th>
                  <th scope="col" className="min-w-[260px] py-3 px-4">Subject &amp; Excerpt</th>
                  <th scope="col" className="py-3 px-3">Group</th>
                  <th scope="col" className="py-3 px-3">Status</th>
                  <th scope="col" className="py-3 px-3">Received</th>
                  <th scope="col" className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(mails.data ?? []).map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-slate-100 text-[11px] font-semibold text-slate-700">
                          {avatarInitial(m.sender)}
                        </span>
                        <span className="truncate text-xs font-semibold text-slate-900">{m.sender}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-600">
                      <span className="block truncate">{m.subject}</span>
                    </td>
                    <td className="py-3 px-3"><BatchChip label={m.batchName} /></td>
                    <td className="py-3 px-3"><StatusBadge status={m.status} /></td>
                    <td className="whitespace-nowrap py-3 px-3 text-[11px] font-medium text-slate-400">
                      {formatRelativeTimestamp(m.receivedAt)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={paths.mailDetails(m.id)}
                        className="rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 transition-transform active:scale-95"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
