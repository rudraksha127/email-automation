import type { CsvImportResult, Recipient } from "@/types";
import { isValidEmail } from "@/utils/validation";

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
