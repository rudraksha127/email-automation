/**
 * Batch detection engine — the CORE of the pilot.
 * Inspects BOTH subject and body, tolerates formatting variations,
 * and is deliberately conservative: ambiguous or absent → needs review.
 */

import { PILOT_YEAR_TO_BATCH_ID, type PilotYear } from "./pilotConfig";

export type DetectionOutcome =
  | { kind: "single"; year: PilotYear; batchId: string }
  | { kind: "none" }
  | { kind: "ambiguous"; years: string[] };

const SUPPORTED_YEAR_RE = /\b(2027|2028)\b/g;

// Tolerates "batch 27", "batch-27", "batch of '27", "27 batch", etc.
const SHORT_BATCH_RE = /\b(?:batch[\s\-_/:]*(?:of[\s\-_/:]*)?['’]?|class[\s\-_/:]*(?:of[\s\-_/:]*)?['’]?)(27|28)\b|\b(27|28)[\s\-_/:]*batch\b/gi;

// Also detects other academic graduation years mentioned with batch/class to guard against
// ambiguous multi-batch cross-references (e.g. "Batch 2026 and Batch 2027").
const OTHER_BATCH_RE = /\b(?:batch[\s\-_/:]*(?:of[\s\-_/:]*)?|class[\s\-_/:]*(?:of[\s\-_/:]*)?)(202[0-6]|2029|203[0-5])\b|\b(202[0-6]|2029|203[0-5])[\s\-_/:]*batch\b/gi;

/**
 * Find every distinct batch year mentioned in subject + body.
 * Word boundaries tolerate "Batch 2027", "Batch-2027", "2027 Batch",
 * "batch of 2027", "batch 27", "28 batch", case-insensitively.
 * Longer numbers (e.g. 20270, 12027) do NOT match thanks to \b.
 */
export function findMentionedYears(subject: string, body: string): PilotYear[] {
  const haystack = `${subject ?? ""}\n${body ?? ""}`;
  const found = new Set<PilotYear>();

  // Full 4-digit pilot years
  for (const m of haystack.matchAll(SUPPORTED_YEAR_RE)) {
    found.add(m[1] as PilotYear);
  }

  // Explicit batch qualifiers with 2-digit years
  for (const m of haystack.matchAll(SHORT_BATCH_RE)) {
    const val = (m[1] || m[2])?.toLowerCase();
    if (val === "27") found.add("2027");
    if (val === "28") found.add("2028");
  }

  return [...found].sort();
}

/**
 * Find any other academic years mentioned in a batch context (e.g. Batch 2026).
 */
export function findOtherBatchMentions(subject: string, body: string): string[] {
  const haystack = `${subject ?? ""}\n${body ?? ""}`;
  const other = new Set<string>();
  for (const m of haystack.matchAll(OTHER_BATCH_RE)) {
    const val = m[1] || m[2];
    if (val) other.add(val);
  }
  return [...other].sort();
}

export function detectBatch(subject: string, body: string): DetectionOutcome {
  const supportedYears = findMentionedYears(subject, body);
  const otherYears = findOtherBatchMentions(subject, body);

  // If multiple supported batches or a mix of supported + other batches are found, mark ambiguous
  if (supportedYears.length > 1) {
    return { kind: "ambiguous", years: supportedYears };
  }
  if (supportedYears.length === 1 && otherYears.length > 0) {
    const all = [...new Set([...supportedYears, ...otherYears])].sort();
    return { kind: "ambiguous", years: all };
  }

  if (supportedYears.length === 0) {
    return { kind: "none" };
  }

  const year = supportedYears[0];
  return { kind: "single", year, batchId: PILOT_YEAR_TO_BATCH_ID[year] };
}
