/**
 * Shared types and validation for backend.
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
  gmailMessageId: string | null;
  sender: string;
  senderName: string | null;
  subject: string;
  bodyText: string;
  receivedAt: string;
  status: MailStatus;
  batchId: string | null;
  batchName: string | null;
  recipientCount: number | null;
  failureReason: string | null;
  attachments: MailAttachment[];
  forwardedAt: string | null;
  ccEmail: string | null;
}

export interface Batch {
  id: string;
  name: string;
  description: string | null;
  recipientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Recipient {
  id: string;
  batchId: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AppSettings {
  organizationName: string;
  allowedSenders: string[];
  ccEmail: string;
  autoForwarding: boolean;
  gmailConnected: boolean;
  gmailAccount: string | null;
  lastSyncedAt: string | null;
}

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
