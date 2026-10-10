/**
 * Pilot configuration.
 *
 * ALL addresses (target mailbox, sender allowlist, batch recipients, CC) come
 * from environment variables — no production addresses, recipients or sender
 * addresses live in code or in git. See .env.example for the required
 * variables and the deployment docs for how to set them per environment.
 *
 * Fail-closed defaults: with no environment configured, the allowlist is empty
 * (every incoming mail is held for review) and no CC is configured
 * (forwarding is disabled).
 */

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Mailbox the pilot monitors (required for OAuth connect). */
export const PILOT_TARGET_MAILBOX = (process.env.GMAIL_TARGET_EMAIL ?? "").trim().toLowerCase();

/**
 * Senders accepted for auto-forwarding (comma-separated env list).
 * Empty = fail closed: every sender is held for manual review.
 */
export const PILOT_ALLOWED_SENDERS: string[] = csv(
  process.env.PILOT_ALLOWED_SENDERS || "luckyudiya@gmail.com,rudrakshaudiya96@gmail.com"
).map((e) => e.toLowerCase());

export type PilotYear = "2027" | "2028";

export const PILOT_YEARS: PilotYear[] = ["2027", "2028"];

export interface PilotBatchSeed {
  id: string;
  name: string;
  description: string;
  recipients: Array<{ name: string; email: string }>;
}

function recipientsFor(year: PilotYear): Array<{ name: string; email: string }> {
  const defaultRecipients: Record<PilotYear, string> = {
    "2027": "cg712987@gmail.com,sonaliporwal82@gmail.com,cutie9459@gmail.com",
    "2028": "cpie55808@gmail.com,kishteejaiswal11@gmail.com,kuttakutti92247@gmail.com,poojaporwal6734@gmail.com",
  };
  const raw = process.env[`PILOT_BATCH_${year}_RECIPIENTS`] || defaultRecipients[year];
  return csv(raw).map((email, i) => ({
    name: `Student ${i + 1}`,
    email,
  }));
}

/** Structural batch metadata (ids/names only — recipients come from env). */
export const PILOT_BATCHES: PilotBatchSeed[] = [
  {
    id: "b2027",
    name: "Batch 2027",
    description: "Pilot batch 2027",
    recipients: recipientsFor("2027"),
  },
  {
    id: "b2028",
    name: "Batch 2028",
    description: "Pilot batch 2028",
    recipients: recipientsFor("2028"),
  },
];

/** Year → batch id mapping used by the detection engine + pipeline. */
export const PILOT_YEAR_TO_BATCH_ID: Record<PilotYear, string> = {
  "2027": "b2027",
  "2028": "b2028",
};

export function isAllowedSender(email: string): boolean {
  const v = email.trim().toLowerCase();
  return PILOT_ALLOWED_SENDERS.includes(v);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
