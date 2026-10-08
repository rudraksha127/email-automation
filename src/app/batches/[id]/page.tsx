"use client";

import Link from "next/link";
import { use, useMemo, useRef, useState } from "react";
import { paths } from "@/routes/paths";
import { AppLayout, PageHeading } from "@/components/layout";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ArrowLeftIcon,
  PlusIcon,
  SearchIcon,
  EditIcon,
  TrashIcon,
  UploadIcon,
  UserIcon,
} from "@/components/icons";
import { useAsync } from "@/hooks/useAsync";
import { batchesService, recipientsService } from "@/services";
import { avatarInitial } from "@/utils/format";
import { validateRecipientForm } from "@/utils/validation";
import { parseRecipientsCsv } from "@/utils/csv";
import type { Recipient, CsvImportResult } from "@/types";

export default function BatchDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const batch = useAsync(() => batchesService.getById(id), [id]);
  const recipients = useAsync(() => recipientsService.list(id), [id]);

  const [search, setSearch] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  // Add/Edit recipient modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Recipient | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleting, setDeleting] = useState<Recipient | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // CSV import state: parse → review → confirm
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<CsvImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = recipients.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    );
  }, [recipients.data, search]);

  function openAdd() {
    setEditing(null);
    setName("");
    setEmail("");
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(recipient: Recipient) {
    setEditing(recipient);
    setName(recipient.name);
    setEmail(recipient.email);
    setFieldErrors({});
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const existingEmails = (recipients.data ?? [])
      .filter((r) => r.id !== editing?.id)
      .map((r) => r.email);
    const errors = validateRecipientForm(name, email, existingEmails);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      if (editing) {
        await recipientsService.update(id, editing.id, { name, email });
      } else {
        await recipientsService.add(id, { name, email });
      }
      setFormOpen(false);
      recipients.reload();
      batch.reload();
    } catch (err) {
      setFieldErrors({
        email: err instanceof Error ? err.message : "Unable to save the recipient.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await recipientsService.remove(id, deleting.id);
      setDeleting(null);
      recipients.reload();
      batch.reload();
    } catch (err) {
      setDeleting(null);
      setPageError(err instanceof Error ? err.message : "Unable to remove the recipient.");
    } finally {
      setDeletingBusy(false);
    }
  }

  async function handleCsvFile(file: File) {
    setImportResult(null);
    setPageError(null);
    const text = await file.text();
    const result = parseRecipientsCsv(text, recipients.data ?? []);
    setImportPreview(result);
  }

  async function confirmImport() {
    if (!importPreview || importPreview.validRows.length === 0) return;
    setImporting(true);
    try {
      const { added } = await recipientsService.bulkAdd({
        batchId: id,
        rows: importPreview.validRows,
      });
      setImportPreview(null);
      setImportResult(`${added} recipient${added === 1 ? "" : "s"} imported successfully.`);
      recipients.reload();
      batch.reload();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "CSV import failed.");
      setImportPreview(null);
    } finally {
      setImporting(false);
    }
  }

  if (batch.loading) {
    return (
      <AppLayout>
        <LoadingState label="Loading batch…" />
      </AppLayout>
    );
  }

  if (batch.error || !batch.data) {
    return (
      <AppLayout>
        <ErrorState message={batch.error ?? "Batch not found."} onRetry={batch.reload} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link
        href={paths.batches}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Batches
      </Link>

      <div className="flex items-start justify-between">
        <PageHeading
          title={batch.data.name}
          subtitle={`${batch.data.recipientCount} recipients${batch.data.description ? ` • ${batch.data.description}` : ""}`}
        />
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <UploadIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button onClick={openAdd}>
            <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span className="hidden sm:inline">Add Recipient</span>
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label="Upload recipients CSV"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleCsvFile(file);
          e.target.value = "";
        }}
      />

      {importResult ? (
        <p
          role="status"
          className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700"
        >
          {importResult}
        </p>
      ) : null}
      {pageError ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700"
        >
          {pageError}
        </p>
      ) : null}

      {/* Recipient search */}
      <div className="relative mb-3">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search recipients"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
        />
      </div>

      {/* Recipient list */}
      {recipients.error ? (
        <ErrorState message={recipients.error} onRetry={recipients.reload} />
      ) : recipients.loading ? (
        <LoadingState label="Loading recipients…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserIcon className="h-6 w-6" />}
          title={search ? "No matching recipients" : "No recipients yet"}
          description={
            search
              ? "Try a different name or email."
              : "Add recipients individually or upload a CSV file."
          }
          action={
            search ? undefined : (
              <div className="flex gap-2">
                <Button onClick={openAdd}>Add Recipient</Button>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Upload CSV
                </Button>
              </div>
            )
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                {avatarInitial(r.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900">{r.name}</p>
                <p className="truncate text-[11px] text-slate-500">{r.email}</p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(r)}
                aria-label={`Edit ${r.name}`}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-brand-600"
              >
                <EditIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleting(r)}
                aria-label={`Remove ${r.name}`}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add/Edit recipient modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Recipient" : "Add Recipient"}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="recipient-form" loading={saving} fullWidth>
              {editing ? "Save Changes" : "Add Recipient"}
            </Button>
          </>
        }
      >
        <form id="recipient-form" onSubmit={handleSave} noValidate className="space-y-4">
          <div>
            <label htmlFor="r-name" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Student Name
            </label>
            <input
              id="r-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aarav Sharma"
              aria-invalid={!!fieldErrors.name || undefined}
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none ${
                fieldErrors.name ? "border-rose-400" : "border-slate-200 focus:border-brand-600"
              }`}
            />
            {fieldErrors.name ? (
              <p role="alert" className="mt-1 text-[11px] font-medium text-rose-600">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="r-email" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <input
              id="r-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              aria-invalid={!!fieldErrors.email || undefined}
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none ${
                fieldErrors.email ? "border-rose-400" : "border-slate-200 focus:border-brand-600"
              }`}
            />
            {fieldErrors.email ? (
              <p role="alert" className="mt-1 text-[11px] font-medium text-rose-600">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
        </form>
      </Modal>

      {/* Delete recipient confirmation */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remove Recipient"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" fullWidth loading={deletingBusy} onClick={handleDelete}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-slate-600">
          Remove <strong>{deleting?.name}</strong> ({deleting?.email}) from {batch.data.name}?
        </p>
      </Modal>

      {/* CSV import review — admin confirms before anything is written */}
      <Modal
        open={!!importPreview}
        onClose={() => setImportPreview(null)}
        title="Import Recipients"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setImportPreview(null)}>
              Cancel
            </Button>
            <Button
              fullWidth
              loading={importing}
              disabled={!importPreview || importPreview.validRows.length === 0}
              onClick={confirmImport}
            >
              Import {importPreview?.validRows.length ?? 0} Recipients
            </Button>
          </>
        }
      >
        {importPreview ? (
          <div className="space-y-3 text-xs">
            <div className="flex gap-2">
              <span className="flex-1 rounded-xl bg-emerald-50 px-3 py-2 text-center font-semibold text-emerald-700">
                {importPreview.validRows.length} valid
              </span>
              <span className="flex-1 rounded-xl bg-amber-50 px-3 py-2 text-center font-semibold text-amber-700">
                {importPreview.duplicateRows.length} duplicates
              </span>
              <span className="flex-1 rounded-xl bg-rose-50 px-3 py-2 text-center font-semibold text-rose-700">
                {importPreview.invalidRows.length} invalid
              </span>
            </div>

            {importPreview.validRows.length > 0 ? (
              <details className="rounded-xl border border-slate-100 p-2.5" open>
                <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">
                  Valid rows (first 10)
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                  {importPreview.validRows.slice(0, 10).map((r, i) => (
                    <li key={i} className="truncate">
                      {r.name} — {r.email}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {importPreview.duplicateRows.length > 0 ? (
              <details className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5">
                <summary className="cursor-pointer text-[11px] font-semibold text-amber-700">
                  Duplicates (will be skipped)
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] text-amber-700">
                  {importPreview.duplicateRows.map((r) => (
                    <li key={r.row} className="truncate">
                      Row {r.row}: {r.email} — {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {importPreview.invalidRows.length > 0 ? (
              <details className="rounded-xl border border-rose-100 bg-rose-50/50 p-2.5">
                <summary className="cursor-pointer text-[11px] font-semibold text-rose-700">
                  Invalid rows (will be skipped)
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] text-rose-700">
                  {importPreview.invalidRows.map((r) => (
                    <li key={r.row} className="truncate">
                      Row {r.row}: {r.email || r.name || "(empty)"} — {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </AppLayout>
  );
}
