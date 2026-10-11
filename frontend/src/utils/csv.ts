import type { CsvImportResult, Recipient } from "@/types";
import { isValidEmail } from "@/utils/validation";

export interface BulkBatchRow {
  "Batch Name": string;
  Description: string;
  "Student Name": string;
  Email: string;
}

interface RawBulkRow {
  "Batch Name"?: string;
  "Description"?: string;
  "Student Name"?: string;
  "Email"?: string;
  batchName?: string;
  description?: string;
  studentName?: string;
  email?: string;
}

/**
 * Parses a bulk batch+recipients CSV with header
 * `Batch Name,Description,Student Name,Email`.
 * Rows sharing a batch name merge into that batch. Detects invalid/duplicate
 * emails per batch for review before upload.
 */
export function parseBulkBatchesCsv(
  csvText: string,
  headers: string[]
): { rows: BulkBatchRow[]; invalid: Array<{ row: number; reason: string }> } {
  const rows: BulkBatchRow[] = [];
  const invalid: Array<{ row: number; reason: string }> = [];

  const idx = (needle: string) =>
    headers.findIndex((h) => h.trim().toLowerCase() === needle.toLowerCase());
  const bIdx = Math.max(idx("Batch Name"), idx("batchname"), idx("batch"));
  const dIdx = idx("Description");
  const nIdx = Math.max(idx("Student Name"), idx("name"));
  const eIdx = Math.max(idx("Email"), idx("student email"));
  if (bIdx === -1 || nIdx === -1 || eIdx === -1) {
    invalid.push({
      row: 0,
      reason: 'CSV must have a header row: "Batch Name","Student Name","Email" (Description optional)',
    });
    return { rows, invalid };
  }

  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const seen = new Map<string, Set<string>>(); // batchKey -> emails

  lines.slice(1).forEach((line, i) => {
    const rowNumber = i + 2;
    const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    const batchName = parts[bIdx] ?? "";
    const description = dIdx >= 0 ? parts[dIdx] ?? "" : "";
    const studentName = parts[nIdx] ?? "";
    const email = parts[eIdx] ?? "".toLowerCase();

    if (!batchName) {
      invalid.push({ row: rowNumber, reason: "Batch Name is missing" });
      return;
    }
    if (batchName.length > 80) {
      invalid.push({ row: rowNumber, reason: "Batch Name must be 80 characters or fewer" });
      return;
    }
    if (studentName && !isValidEmail(email)) {
      invalid.push({ row: rowNumber, reason: `Invalid email format for ${studentName}` });
      return;
    }

    const batchKey = batchName.toLowerCase();
    if (!seen.has(batchKey)) seen.set(batchKey, new Set());
    const emails = seen.get(batchKey)!;
    if (email) {
      if (!isValidEmail(email)) {
        invalid.push({ row: rowNumber, reason: "Invalid email format" });
        return;
      }
      const key = email.toLowerCase();
      if (emails.has(key)) {
        invalid.push({ row: rowNumber, reason: `Duplicate email ${email} inside batch ${batchName}` });
        return;
      }
      emails.add(key);
    }

    rows.push({
      "Batch Name": batchName,
      Description: description,
      "Student Name": studentName,
      Email: email.toLowerCase(),
    });
  });

  return { rows, invalid };
}

/** Generates and downloads the bulk upload CSV template. */
export function downloadBulkBatchesTemplate(): void {
  const lines = [
    "Batch Name,Description,Student Name,Email",
    'Batch 2027,Pilot batch 2027,Rahul Sharma,rahul.sharma@example.test',
    'Batch 2027,Pilot batch 2027,Priya Verma,priya.verma@example.test',
    'Batch 2028,Pilot batch 2028,Aman Patel,aman.patel@example.test',
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bulk-batches-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse a CSV of recipients in the format `Name,Email` (one per line).
 * - Detects invalid emails and duplicate rows/emails.
 * - Does NOT mutate anything: the admin reviews the result and confirms the import.
 */
export function parseRecipientsCsv(
  csvText: string,
  existingRecipients: Recipient[] = []
): CsvImportResult {
  const result: CsvImportResult = {
    validRows: [],
    invalidRows: [],
    duplicateRows: [],
  };

  const existingEmails = new Set(
    existingRecipients.map((r) => r.email.trim().toLowerCase())
  );
  const seenEmails = new Set<string>();

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  lines.forEach((line, index) => {
    const rowNumber = index + 1;
    // Skip a header row like "Name,Email"
    if (rowNumber === 1 && /^name\s*,\s*email$/i.test(line)) return;

    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 2) {
      result.invalidRows.push({
        row: rowNumber,
        name: parts[0] ?? "",
        email: "",
        reason: "Row must contain Name and Email separated by a comma",
      });
      return;
    }

    const [name, email] = parts;
    if (!name) {
      result.invalidRows.push({ row: rowNumber, name, email, reason: "Name is missing" });
      return;
    }
    if (!email || !isValidEmail(email)) {
      result.invalidRows.push({ row: rowNumber, name, email, reason: "Invalid email format" });
      return;
    }

    const emailKey = email.toLowerCase();
    if (seenEmails.has(emailKey)) {
      result.duplicateRows.push({
        row: rowNumber,
        name,
        email,
        reason: "Duplicate email within the uploaded file",
      });
      return;
    }
    if (existingEmails.has(emailKey)) {
      result.duplicateRows.push({
        row: rowNumber,
        name,
        email,
        reason: "Email already exists in this batch",
      });
      return;
    }

    seenEmails.add(emailKey);
    result.validRows.push({ name, email });
  });

  return result;
}
