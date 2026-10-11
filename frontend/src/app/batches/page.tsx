"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { paths } from "@/routes/paths";
import { PageHeading, AppLayout } from "@/components/layout";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  GraduationCapIcon,
  PlusIcon,
  UsersIcon,
  EditIcon,
  TrashIcon,
  ChevronRightIcon,
  UploadIcon,
} from "@/components/icons";
import { useAsync } from "@/hooks/useAsync";
import { batchesService } from "@/services";
import type { BulkImportResult } from "@/services/batches/batchesService";
import { formatRecipientCount } from "@/utils/format";
import { validateBatchForm } from "@/utils/validation";
import {
  parseBulkBatchesCsv,
  downloadBulkBatchesTemplate,
  type BulkBatchRow,
} from "@/utils/csv";
import type { Batch } from "@/types";

export default function BatchesPage() {
  const batches = useAsync(() => batchesService.list(), []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Batch | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Bulk upload state: file → parsed preview → confirm → result
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [bulkPreview, setBulkPreview] = useState<{
    rows: BulkBatchRow[];
    invalid: Array<{ row: number; reason: string }>;
  } | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);

  function handleBulkFile(file: File) {
    setBulkResult(null);
    void file.text().then((text) => {
      const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
      const headers = firstLine.split(",").map((h) => h.trim().replace(/"/g, ""));
      const parsed = parseBulkBatchesCsv(text, headers);
      setBulkResult(null);
      setBulkPreview(parsed);
    });
  }

  async function confirmBulkImport() {
    if (!bulkPreview || bulkPreview.rows.length === 0) return;
    setBulkImporting(true);
    try {
      const result = await batchesService.bulkImport(bulkPreview.rows);
      setBulkPreview(null);
      setBulkResult(result);
      batches.reload();
    } catch (err) {
      setBulkResult(null);
      setApiError(err instanceof Error ? err.message : "Bulk upload failed.");
      setBulkPreview(null);
    } finally {
      setBulkImporting(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setName("");
    setDescription("");
    setFieldError(null);
    setApiError(null);
    setFormOpen(true);
  }

  function openEdit(batch: Batch) {
    setEditing(batch);
    setName(batch.name);
    setDescription(batch.description ?? "");
    setFieldError(null);
    setApiError(null);
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    const names = (batches.data ?? []).map((b) => b.name);
    const errors = validateBatchForm(name, names, editing?.id);
    const nameError = errors.name;
    if (nameError) {
      setFieldError(nameError);
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await batchesService.update(editing.id, { name, description });
      } else {
        await batchesService.create({ name, description });
      }
      setFormOpen(false);
      batches.reload();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Unable to save the batch.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await batchesService.remove(deleting.id);
      setDeleting(null);
      batches.reload();
    } catch (err) {
      setDeleting(null);
      setApiError(err instanceof Error ? err.message : "Unable to delete the batch.");
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex items-start justify-between">
        <PageHeading title="Batches" subtitle="Manage batch recipients" />
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => bulkFileRef.current?.click()}
            className="shrink-0"
          >
            <UploadIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Bulk Upload</span>
          </Button>
          <Button onClick={openAdd} className="shrink-0">
            <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add Batch
          </Button>
        </div>
      </div>

      <input
        ref={bulkFileRef}
        type="file"
        accept=".csv,text/csv,.xls,.xlsx"
        className="hidden"
        aria-label="Upload batches CSV"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleBulkFile(file);
          e.target.value = "";
        }}
      />

      {bulkResult ? (
        <div
          role="status"
          className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700"
        >
          <p className="font-semibold">Bulk upload complete</p>
          <p className="mt-0.5">
            {bulkResult.batchesCreated} batch(es) created • {bulkResult.batchesReused} existing
            reused • {bulkResult.recipientsAdded} recipients imported
            {bulkResult.invalidRows > 0 ? ` • ${bulkResult.invalidRows} invalid rows skipped` : ""}
          </p>
        </div>
      ) : null}

      {apiError ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700"
        >
          {apiError}
        </p>
      ) : null}

      {batches.error ? (
        <ErrorState message={batches.error} onRetry={batches.reload} />
      ) : batches.loading ? (
        <LoadingState label="Loading batches…" />
      ) : (batches.data ?? []).length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-6 w-6" />}
          title="No batches yet"
          description="Create your first batch to start organizing recipients."
          action={<Button onClick={openAdd}>Add Batch</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {(batches.data ?? []).map((batch) => (
            <article
              key={batch.id}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-all hover:border-slate-200"
            >
              <div className="flex items-center justify-between pb-3.5">
                <div className="flex min-w-0 items-center space-x-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                    <GraduationCapIcon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900">{batch.name}</h3>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                      {formatRecipientCount(batch.recipientCount)}
                      {batch.description ? (
                        <>
                          <span className="mx-1">•</span>
                          {batch.description}
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                <Link
                  href={paths.batchDetails(batch.id)}
                  aria-label={`Open ${batch.name}`}
                  className="pl-2 text-slate-400 hover:text-slate-600"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100/90 pt-3">
                <Link
                  href={paths.batchDetails(batch.id)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-50/70 px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100/80"
                >
                  <UsersIcon className="h-3.5 w-3.5" />
                  <span>View Recipients</span>
                </Link>
                <button
                  type="button"
                  onClick={() => openEdit(batch)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200/50 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <EditIcon className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDeleting(batch)}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                <span>Delete Batch</span>
              </button>
            </article>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Batch" : "Add Batch"}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="batch-form" loading={saving} fullWidth>
              {editing ? "Save Changes" : "Create Batch"}
            </Button>
          </>
        }
      >
        <form id="batch-form" onSubmit={handleSave} noValidate className="space-y-4">
          {apiError ? (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {apiError}
            </p>
          ) : null}
          <div>
            <label htmlFor="batch-name" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Batch Name
            </label>
            <input
              id="batch-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Batch 2026"
              aria-invalid={!!fieldError || undefined}
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none ${
                fieldError ? "border-rose-400" : "border-slate-200 focus:border-brand-600"
              }`}
            />
            {fieldError ? (
              <p role="alert" className="mt-1 text-[11px] font-medium text-rose-600">
                {fieldError}
              </p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="batch-desc"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="batch-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. IT Department – Final Year"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
            />
          </div>
        </form>
      </Modal>

      {/* Bulk upload preview modal */}
      <Modal
        open={!!bulkPreview}
        onClose={() => setBulkPreview(null)}
        title="Bulk Upload Preview"
      >
        {bulkPreview && bulkPreview.invalid.length > 0 && bulkPreview.rows.length === 0 ? (
          <div className="space-y-3 text-xs">
            <p className="font-semibold text-rose-700">
              No valid rows found — please fix the file and try again.
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg bg-rose-50 p-2.5 text-rose-700">
              {bulkPreview.invalid.slice(0, 10).map((r) => (
                <p key={`${r.row}-${r.reason}`}>
                  • Row {r.row}: {r.reason}
                </p>
              ))}
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={downloadBulkBatchesTemplate}>
                Download Template
              </Button>
              <Button variant="secondary" onClick={() => setBulkPreview(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : bulkPreview ? (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                {bulkPreview.rows.length} valid rows
              </span>
              {bulkPreview.invalid.length > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                  {bulkPreview.invalid.length} invalid (will be skipped)
                </span>
              )}
              <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                {new Set(bulkPreview.rows.map((r) => r["Batch Name"].toLowerCase())).size} batches
              </span>
            </div>
            {bulkPreview.invalid.length > 0 && (
              <div className="max-h-28 overflow-y-auto rounded-lg bg-amber-50 p-2.5 text-amber-700">
                {bulkPreview.invalid.slice(0, 8).map((r) => (
                  <p key={`${r.row}-${r.reason}`}>
                    • Row {r.row}: {r.reason}
                  </p>
                ))}
              </div>
            )}
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {bulkPreview.rows.slice(0, 20).map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr] gap-2 px-2.5 py-1.5">
                  <span className="font-semibold text-slate-800">{r["Batch Name"]}</span>
                  <span className="text-slate-700">{r["Student Name"] || "—"}</span>
                  <span className="truncate text-slate-500">{r.Email || "batch only"}</span>
                </div>
              ))}
              {bulkPreview.rows.length > 20 && (
                <p className="px-2.5 py-1.5 text-slate-400">
                  …and {bulkPreview.rows.length - 20} more rows
                </p>
              )}
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={downloadBulkBatchesTemplate}>
                Template
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setBulkPreview(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmBulkImport}
                  disabled={bulkPreview.rows.length === 0}
                  loading={bulkImporting}
                >
                  Import {bulkPreview.rows.length} Rows
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Delete confirmation — destructive action needs an explicit confirm */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete Batch"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" fullWidth loading={deletingBusy} onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-slate-600">
          Are you sure you want to delete <strong>{deleting?.name}</strong>? Its recipient list will
          also be removed. This action cannot be undone.
        </p>
      </Modal>
    </AppLayout>
  );
}
