"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { paths } from "@/routes/paths";
import { AppLayout } from "@/components/layout";
import { StatusBadge, BatchChip } from "@/components/ui/Badge";
import { LoadingState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ArrowLeftIcon,
  PaperclipIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "@/components/icons";
import { useAsync } from "@/hooks/useAsync";
import { mailsService, batchesService } from "@/services";
import { formatDateTime, formatFileSize, avatarInitial } from "@/utils/format";
import { cn } from "@/utils/cn";

export default function MailDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const mail = useAsync(() => mailsService.getById(id), [id]);
  const batches = useAsync(() => batchesService.list(), []);

  // Review flow state: admin selects a batch, reviews recipient count, confirms.
  const [selectingBatch, setSelectingBatch] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [forwarded, setForwarded] = useState(false);

  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // "Not relevant" flow: confirm, call the existing reject endpoint, reload.
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const selectedBatch = useMemo(
    () => (batches.data ?? []).find((b) => b.id === selectedBatchId) ?? null,
    [batches.data, selectedBatchId]
  );

  const data = mail.data;

  async function confirmForward() {
    if (!selectedBatchId || !data) return;
    setConfirming(true);
    setActionError(null);
    try {
      await mailsService.forward(data.id, selectedBatchId);
      setForwarded(true);
      setSelectingBatch(false);
      mail.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to forward this mail.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleRetry() {
    if (!data) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await mailsService.retry(data.id);
      mail.reload();
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Retry failed. Please try again.");
    } finally {
      setRetrying(false);
    }
  }

  async function handleMarkNotRelevant() {
    if (!data) return;
    setRejecting(true);
    setRejectError(null);
    try {
      await mailsService.markNotRelevant(data.id);
      setConfirmReject(false);
      mail.reload();
    } catch (err) {
      setRejectError(
        err instanceof Error ? err.message : "Unable to update this mail."
      );
    } finally {
      setRejecting(false);
    }
  }

  if (mail.loading) {
    return (
      <AppLayout>
        <LoadingState label="Loading mail…" />
      </AppLayout>
    );
  }

  if (mail.error || !data) {
    return (
      <AppLayout>
        <ErrorState message={mail.error ?? "Mail not found."} onRetry={mail.reload} />
      </AppLayout>
    );
  }

  const isAmbiguous = data.status === "needs_review";
  const isFailed = data.status === "failed";

  return (
    <AppLayout>
      {/* Back */}
      <Link
        href={paths.mails}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Mails
      </Link>

      {/* Mail card */}
      <article className="rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <header className="border-b border-slate-100/90 px-5 py-4">
          <h1 className="text-base font-bold leading-snug tracking-tight text-on-surface">
            {data.subject}
          </h1>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface">
              {avatarInitial(data.sender)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-on-surface">{data.sender}</p>
              <p className="text-[11px] text-on-surface-variant">{formatDateTime(data.receivedAt)}</p>
            </div>
          </div>
        </header>

        {/* Processing info */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-slate-100/90 px-5 py-4 text-xs">
          <div>
            <dt className="font-semibold text-on-surface-variant">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={forwarded ? "forwarded" : data.status} />
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-on-surface-variant">Detected Batch</dt>
            <dd className="mt-1">
              <BatchChip label={data.batchName} />
            </dd>
          </div>
          {data.recipientCount != null ? (
            <div>
              <dt className="font-semibold text-on-surface-variant">Recipients</dt>
              <dd className="mt-1 font-semibold text-on-surface">{data.recipientCount}</dd>
            </div>
          ) : null}
          {data.ccEmail ? (
            <div>
              <dt className="font-semibold text-on-surface-variant">CC</dt>
              <dd className="mt-1 truncate font-medium text-on-surface-variant">{data.ccEmail}</dd>
            </div>
          ) : null}
          {data.forwardedAt ? (
            <div>
              <dt className="font-semibold text-on-surface-variant">Forwarded At</dt>
              <dd className="mt-1 font-medium text-on-surface-variant">{formatDateTime(data.forwardedAt)}</dd>
            </div>
          ) : null}
        </dl>

        {/* Body */}
        {data.bodyHtml ? (
          <div
            className="prose max-w-none px-5 py-4 text-sm leading-relaxed text-on-surface break-words overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
          />
        ) : (
          <div className="whitespace-pre-line px-5 py-4 text-sm leading-relaxed text-on-surface">
            {data.bodyText}
          </div>
        )}

        {/* Attachments */}
        {data.attachments.length > 0 ? (
          <section className="border-t border-slate-100/90 px-5 py-3.5" aria-label="Attachments">
            <h2 className="mb-2 text-xs font-bold text-on-surface">Attachments</h2>
            <ul className="space-y-1.5">
              {data.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-surface-container-low px-3 py-2 text-xs"
                >
                  <PaperclipIcon className="h-4 w-4 shrink-0 text-on-surface-variant" />
                  <span className="min-w-0 flex-1 truncate font-medium text-on-surface">
                    {a.filename}
                  </span>
                  <span className="shrink-0 text-[10px] text-on-surface-variant">
                    {formatFileSize(a.sizeBytes)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Failure reason */}
        {isFailed && data.failureReason ? (
          <section className="border-t border-slate-100/90 px-5 py-3.5">
            <p className="flex items-start gap-2 rounded-xl border border-error/20 bg-error-container px-3 py-2.5 text-xs font-medium text-on-error-container">
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {data.failureReason}
            </p>
            {retryError ? (
              <p role="alert" className="mt-2 text-[11px] font-medium text-error">
                {retryError}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Actions */}
        <footer className="flex gap-2.5 border-t border-slate-100/90 px-5 py-4">
          {isAmbiguous ? (
            <>
              <Button onClick={() => setSelectingBatch(true)} fullWidth>
                Select Batch &amp; Forward
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setRejectError(null);
                  setConfirmReject(true);
                }}
                fullWidth
              >
                Not Relevant
              </Button>
            </>
          ) : null}
          {isFailed ? (
            <Button onClick={handleRetry} loading={retrying} fullWidth>
              Retry Forwarding
            </Button>
          ) : null}
          {data.status === "forwarded" ? (
            <p className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-secondary">
              <CheckCircleIcon className="h-4 w-4" />
              Forwarded to {data.batchName} ({data.recipientCount} recipients)
            </p>
          ) : null}
        </footer>
      </article>

      {/* Review flow: select batch → review recipients → confirm */}
      <Modal
        open={selectingBatch}
        onClose={() => {
          setSelectingBatch(false);
          setActionError(null);
        }}
        title="Select Target Batch"
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setSelectingBatch(false);
                setActionError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              loading={confirming}
              disabled={!selectedBatchId || (selectedBatch?.recipientCount ?? 0) === 0}
              onClick={confirmForward}
            >
              Confirm Forward
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-on-surface-variant">
            This mail could not be assigned automatically. Choose the correct batch, review the
            recipient count, then confirm.
          </p>
          {actionError ? (
            <p role="alert" className="rounded-xl border border-error/20 bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">
              {actionError}
            </p>
          ) : null}
          <ul className="space-y-1.5 pt-1" role="radiogroup" aria-label="Batches">
            {(batches.data ?? []).map((b) => (
              <li key={b.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs transition-colors",
                    selectedBatchId === b.id
                      ? "border-primary bg-primary-fixed/40"
                      : "border-slate-200/80 hover:bg-surface-container-low"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="target-batch"
                      value={b.id}
                      checked={selectedBatchId === b.id}
                      onChange={() => setSelectedBatchId(b.id)}
                      className="h-4 w-4 border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="font-semibold text-on-surface">{b.name}</span>
                  </span>
                  <span className="text-[11px] font-medium text-on-surface-variant">
                    {b.recipientCount} recipients
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {selectedBatch ? (
            <p className="rounded-xl bg-primary-fixed/50 px-3 py-2 text-[11px] font-medium text-on-primary-fixed-variant">
              Forwarding to {selectedBatch.name} → {selectedBatch.recipientCount} recipients
              {selectedBatch.recipientCount === 0 ? " — this batch is empty" : ""}
            </p>
          ) : null}
        </div>
      </Modal>

      {/* Not-relevant confirmation */}
      <Modal
        open={confirmReject}
        onClose={() => {
          setConfirmReject(false);
          setRejectError(null);
        }}
        title="Mark as Not Relevant"
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setConfirmReject(false);
                setRejectError(null);
              }}
            >
              Cancel
            </Button>
            <Button fullWidth loading={rejecting} onClick={handleMarkNotRelevant}>
              Mark Not Relevant
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-on-surface-variant">
          This mail will be taken out of the review queue and kept in history as not relevant. You
          can still retry forwarding it later.
        </p>
        {rejectError ? (
          <p
            role="alert"
            className="mt-2 rounded-xl border border-error/20 bg-error-container px-3 py-2 text-xs font-medium text-on-error-container"
          >
            {rejectError}
          </p>
        ) : null}
      </Modal>

      {/* Success feedback */}
      {forwarded ? (
        <div
          role="status"
          className="fixed inset-x-0 bottom-24 z-40 mx-auto flex w-fit items-center gap-2 rounded-full bg-inverse-surface px-4 py-2.5 text-xs font-semibold text-inverse-on-surface shadow-dialog"
        >
          <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
          Mail forwarded successfully
        </div>
      ) : null}
    </AppLayout>
  );
}
