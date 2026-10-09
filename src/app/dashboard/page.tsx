"use client";


import Link from "next/link";
import { paths } from "@/routes/paths";
import { PageHeading, AppLayout } from "@/components/layout";
import { StatusBadge, BatchChip } from "@/components/ui/Badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/EmptyState";
import { MailIcon, SendIcon, ClockIcon, UsersIcon, ChevronRightIcon } from "@/components/icons";
import { useAsync } from "@/hooks/useAsync";
import { settingsService, mailsService } from "@/services";
import { avatarInitial, formatRelativeTimestamp } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { DashboardStats } from "@/types";
import type { MailSummary } from "@/services/mails/mailsService";

const STAT_META = {
  newMails: { label: "New Mails", icon: MailIcon, tone: "bg-brand-50 text-brand-600", href: paths.mails },
  forwardedToday: { label: "Forwarded Today", icon: SendIcon, tone: "bg-emerald-50 text-emerald-600", href: paths.mails },
  needsReview: { label: "Needs Review", icon: ClockIcon, tone: "bg-amber-50 text-amber-500", href: paths.mails },
  totalBatches: { label: "Total Batches", icon: UsersIcon, tone: "bg-brand-50 text-brand-600", href: paths.batches },
} as const;

function StatCard({
  stat,
  value,
  loading,
}: {
  stat: (typeof STAT_META)[keyof typeof STAT_META];
  value: number | undefined;
  loading: boolean;
}) {
  const Icon = stat.icon;
  return (
    <Link
      href={stat.href}
      className="flex h-[104px] flex-col justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-colors hover:border-slate-200"
    >
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", stat.tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-xl font-black leading-none tracking-tight text-slate-900">
          {loading ? "…" : (value ?? 0)}
        </span>
        <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">{stat.label}</span>
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const stats = useAsync<DashboardStats>(() => settingsService.getDashboardStats(), []);
  const mails = useAsync<MailSummary[]>(() => mailsService.list({ status: "all", batchId: "all", search: "" }), []);

  const recent = (mails.data ?? []).slice(0, 4);

  return (
    <AppLayout>
      <PageHeading title="Dashboard" subtitle="Overview of email automation" />

      {/* Summary grid — click-through to the relevant filtered section */}
      <section aria-label="Summary" className="grid grid-cols-2 gap-3">
        <StatCard stat={STAT_META.newMails} value={stats.data?.newMails} loading={stats.loading} />
        <StatCard stat={STAT_META.forwardedToday} value={stats.data?.forwardedToday} loading={stats.loading} />
        <StatCard stat={STAT_META.needsReview} value={stats.data?.needsReview} loading={stats.loading} />
        <StatCard stat={STAT_META.totalBatches} value={stats.data?.totalBatches} loading={stats.loading} />
      </section>

      {/* Recent emails */}
      <section className="space-y-3 pt-6" aria-label="Recent emails">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-slate-900">Recent Emails</h2>
          <Link
            href={paths.mails}
            className="flex items-center space-x-0.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            <span>View All</span>
            <ChevronRightIcon className="h-3 w-3" />
          </Link>
        </div>

        {stats.error || mails.error ? (
          <ErrorState message={stats.error ?? mails.error ?? ""} onRetry={() => { stats.reload(); mails.reload(); }} />
        ) : stats.loading || mails.loading ? (
          <LoadingState label="Loading dashboard…" />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<MailIcon className="h-6 w-6" />}
            title="No mails yet"
            description="Incoming departmental mails will appear here once processing begins."
          />
        ) : (
          <div className="space-y-2.5">
            {recent.map((m) => (
              <Link
                key={m.id}
                href={paths.mailDetails(m.id)}
                className="flex items-start space-x-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_2px_6px_rgba(0,0,0,0.02)] transition-colors hover:border-slate-200"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                  {avatarInitial(m.sender)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-0.5 flex items-baseline justify-between">
                    <span className="truncate pr-1 text-xs font-bold text-slate-900">{m.sender}</span>
                    <time className="shrink-0 text-[10px] font-medium text-slate-400">
                      {formatRelativeTimestamp(m.receivedAt)}
                    </time>
                  </span>
                  <span className="mb-2 block truncate text-xs font-medium text-slate-500">
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
        )}
      </section>
    </AppLayout>
  );
}
