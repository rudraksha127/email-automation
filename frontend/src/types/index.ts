/**
 * Shared domain types for the Mail Automation PWA.
 * These models are the single source of truth for services, UI and (later) the database schema.
 */

export type MailStatus = "pending" | "forwarded" | "needs_review" | "failed";

export interface MailAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export interface Mail {
  id: string;
  /** Original Gmail message id — used for idempotent processing (backend phase). */
  gmailMessageId: string | null;
  sender: string;
  senderName: string | null;
  subject: string;
  bodyText: string;
  receivedAt: string; // ISO datetime
  status: MailStatus;
  batchId: string | null;
  batchName: string | null;
  /** Number of recipients the mail was forwarded to (after forwarding). */
  recipientCount: number | null;
  failureReason: string | null;
  attachments: MailAttachment[];
  forwardedAt: string | null;
  /** IT department CC used when forwarding (after forwarding). */
  ccEmail: string | null;
}

export interface Batch {
  id: string;
  name: string;
  description: string | null;
  recipientCount: number;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export interface Recipient {
  id: string;
  batchId: string;
  name: string;
  email: string;
  createdAt: string; // ISO datetime
}

export interface AdminUser {
  email: string;
  name: string;
}

export interface AppSettings {
  /** Workspace display name — editable by workspace admins. */
  organizationName: string;
  /** Incoming sender allowlist enforced before any automatic forwarding. */
  allowedSenders: string[];
  /** CC address — added to every forwarded mail. Editable in Settings. */
  ccEmail: string;
  autoForwarding: boolean;
  gmailConnected: boolean;
  gmailAccount: string | null;
  lastSyncedAt: string | null;
}

/** A workspace (organization) the current user belongs to. */
export interface Workspace {
  orgId: string;
  name: string;
  role: "admin" | "member";
}

/** Configurable forwarding rule — evaluated deterministically server-side. */
export interface ForwardingRule {
  id: string;
  name: string;
  priority: number;
  active: boolean;
  senderPattern: string | null;
  subjectKeywords: string[];
  bodyKeywords: string[];
  targetBatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  newMails: number;
  forwardedToday: number;
  needsReview: number;
  totalBatches: number;
}

export interface MailListFilters {
  status: MailStatus | "all";
  batchId: string | "all";
  search: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CsvImportResult {
  validRows: Array<{ name: string; email: string }>;
  invalidRows: Array<{ row: number; name: string; email: string; reason: string }>;
  duplicateRows: Array<{ row: number; name: string; email: string; reason: string }>;
}
