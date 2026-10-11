"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { paths } from "@/routes/paths";
import { PageHeading, AppLayout } from "@/components/layout";
import { StatusBadge, BatchChip } from "@/components/ui/Badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import {
  SearchIcon,
  ClockIcon,
  CalendarIcon,
  UsersIcon,
  ArrowRightIcon,
  MailIcon,
} from "@/components/icons";
import { useAsync } from "@/hooks/useAsync";
import { useDebounced } from "@/hooks/useDebounced";
import { mailsService, batchesService } from "@/services";
import { http } from "@/services/http";
import { formatRelativeTimestamp, statusLabel } from "@/utils/format";
import { cn } from "@/utils/cn";
import { ALL_STATUSES } from "@/services/mails/mailsService";
import type { MailStatus, Batch } from "@/types";
import type { MailSummary } from "@/services/mails/mailsService";

type StatusFilter = MailStatus | "all";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All Statuses" },
  ...ALL_STATUSES.map((s) => ({ value: s as StatusFilter, label: statusLabel(s) })),
];

const YEAR_OPTIONS = ["all", "2026", "2027", "2028", "2029", "2030"];

export default function HistoryPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [batchId, setBatchId] = useState<string>("all");
  const [year, setYear] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [search, setSearch] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const calendarRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounced(search, 250);

  // Close calendar popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch batches for Section/Batch dropdown
  const batches = useAsync<Batch[]>(() => batchesService.list(), []);

  // Fetch filtered mails
  const mails = useAsync<MailSummary[]>(
    () =>
      mailsService.list({
        status,
        batchId: batchId !== "all" ? batchId : undefined,
        search: debouncedSearch || undefined,
        date: selectedDate || undefined,
        year: year !== "all" ? year : undefined,
      }),
    [status, batchId, debouncedSearch, selectedDate, year]
  );

  async function handleSyncInbox() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await http.post<{ ingested: number; forwarded: number }>(
        "/api/gmail/sync",
        { historical: true }
      );
      setSyncMsg(
        `Sync complete: ${res.ingested} message(s) ingested, ${res.forwarded} forwarded.`
      );
      mails.reload();
      setTimeout(() => setSyncMsg(null), 4000);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
      setTimeout(() => setSyncMsg(null), 4000);
    } finally {
      setSyncing(false);
    }
  }

  function handleResetFilters() {
    setStatus("all");
    setBatchId("all");
    setYear("all");
    setSelectedDate("");
    setSearch("");
  }

  const activeFilterCount =
    (status !== "all" ? 1 : 0) +
    (batchId !== "all" ? 1 : 0) +
    (year !== "all" ? 1 : 0) +
    (selectedDate ? 1 : 0) +
    (search ? 1 : 0);

  return (
    <AppLayout>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <PageHeading
          title="Mail Processing History"
          subtitle="Archive of all forwarded, reviewed, and screened student emails"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            loading={syncing}
            onClick={handleSyncInbox}
            className="shrink-0 text-xs"
            title="Fetch and sync past received emails from connected Gmail"
          >
            <ClockIcon className="h-3.5 w-3.5" />
            <span>Sync Inbox History</span>
          </Button>
        </div>
      </div>

      {syncMsg && (
        <div className="mb-4 rounded-xl border border-primary-200/80 bg-primary-50 px-4 py-2.5 text-xs font-semibold text-primary-800 shadow-xs">
          {syncMsg}
        </div>
      )}

      {/* Filter Control Bar */}
      <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Box */}
          <div className="relative">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Search
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Subject or sender…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 shadow-xs focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Section / Batch Filter */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Section / Batch
            </label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
            >
              <option value="all">All Batches</option>
              {(batches.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.recipientCount})
                </option>
              ))}
            </select>
          </div>

          {/* Graduation Year Filter */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Graduation Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/10 focus:outline-none"
            >
              <option value="all">All Years</option>
              {YEAR_OPTIONS.filter((y) => y !== "all").map((y) => (
                <option key={y} value={y}>
                  Batch {y}
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Date Picker with Hover / Click Popover */}
          <div className="relative" ref={calendarRef}>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Date Filter
            </label>
            <div
              onMouseEnter={() => setCalendarOpen(true)}
              onClick={() => setCalendarOpen((v) => !v)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                selectedDate
                  ? "border-primary-500 bg-primary-50/70 text-primary-900 shadow-xs"
                  : "border-slate-200/80 bg-slate-50/70 text-slate-600 hover:bg-slate-100 shadow-xs"
              )}
            >
              <span className="flex items-center gap-1.5 truncate">
                <CalendarIcon className="h-4 w-4 text-brand-600" />
                {selectedDate
                  ? new Date(selectedDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "All Dates"}
              </span>
              {selectedDate ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDate("");
                  }}
                  className="ml-1 text-[11px] font-bold text-slate-400 hover:text-slate-700"
                >
                  ✕
                </span>
              ) : null}
            </div>

            {/* Mini Calendar Popup */}
            {calendarOpen && (
              <div
                className="absolute right-0 top-full z-40 mt-1 w-64 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card-elevated"
                onMouseLeave={() => setCalendarOpen(false)}
              >
                <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    Select Date
                  </span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setCalendarOpen(false);
                    }}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none"
                  />
                </div>
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      setSelectedDate(today);
                      setCalendarOpen(false);
                    }}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setSelectedDate(d.toISOString().slice(0, 10));
                      setCalendarOpen(false);
                    }}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate("");
                      setCalendarOpen(false);
                    }}
                    className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Clear Filter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Tags & Reset */}
        {activeFilterCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">
              Filtered by <span className="font-bold text-slate-800">{activeFilterCount}</span> criteria
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-bold text-brand-600 hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </section>

      {/* Results Content */}
      {mails.loading ? (
        <LoadingState label="Loading email history…" />
      ) : mails.error ? (
        <ErrorState message={mails.error} onRetry={mails.reload} />
      ) : (mails.data ?? []).length === 0 ? (
        <EmptyState
          icon={<MailIcon className="h-6 w-6" />}
          title="No emails found"
          description={
            activeFilterCount > 0
              ? "No historical records matched your current filters. Try resetting filters."
              : "No emails have been processed or synced into the archive yet. Click 'Sync Inbox History' to import past messages."
          }
          action={
            activeFilterCount > 0 ? (
              <Button variant="secondary" onClick={handleResetFilters}>
                Clear Filters
              </Button>
            ) : (
              <Button onClick={handleSyncInbox} loading={syncing}>
                Sync Inbox History
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-500">
            <span>Showing {(mails.data ?? []).length} email record(s)</span>
          </div>

          <ul className="space-y-2.5">
            {(mails.data ?? []).map((m) => {
              return (
                <li
                  key={m.id}
                  className="group relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition-all hover:border-slate-300 hover:shadow-card-elevated"
                >
                  <Link href={paths.mailDetails(m.id)} className="block">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <StatusBadge status={m.status} />
                          {m.batchName ? (
                            <BatchChip label={m.batchName} />
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">
                              No batch assigned
                            </span>
                          )}
                          {typeof m.recipientCount === "number" && m.recipientCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                              <UsersIcon className="h-3 w-3" />
                              {m.recipientCount} student{m.recipientCount === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1">
                          {m.subject || "(No Subject)"}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500 truncate">
                          From: <span className="font-medium text-slate-700">{m.senderName || m.sender}</span>
                        </p>

                        {m.failureReason && (
                          <p className="mt-1.5 text-xs text-rose-600 font-medium">
                            Reason: {m.failureReason}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex sm:flex-col sm:items-end justify-between items-center text-xs text-slate-400 gap-1 pt-1 sm:pt-0">
                        <time dateTime={m.receivedAt} className="text-[11px] font-semibold text-slate-500">
                          {formatRelativeTimestamp(m.receivedAt)}
                        </time>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          View Details <ArrowRightIcon className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </AppLayout>
  );
}
