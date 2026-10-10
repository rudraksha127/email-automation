import type { AppSettings, Batch, Mail, Recipient } from "@/types";
import { PILOT_BATCHES, PILOT_TARGET_MAILBOX } from "@/lib/pilotConfig";

/**
 * Isolated in-memory store representing the exact pilot environment.
 * All demo/mock records have been completely purged in favor of the real pilot specifications.
 */

const now = new Date().toISOString();

export const mockBatches: Batch[] = PILOT_BATCHES.map((b) => ({
  id: b.id,
  name: b.name,
  description: b.description,
  recipientCount: b.recipients.length,
  createdAt: now,
  updatedAt: now,
}));

export const mockRecipients: Record<string, Recipient[]> = Object.fromEntries(
  PILOT_BATCHES.map((b) => [
    b.id,
    b.recipients.map((r) => ({
      id: `${b.id}-${r.email.toLowerCase()}`,
      batchId: b.id,
      name: r.name,
      email: r.email,
      createdAt: now,
    })),
  ])
);

export const mockMails: Mail[] = [];

export const mockSettings: AppSettings = {
  organizationName: "Demo Workspace",
  allowedSenders: ["sender.a@fixture.test", "sender.b@fixture.test"],
  ccEmail: process.env.PILOT_CC_EMAIL ?? "",
  autoForwarding: true,
  gmailConnected: false,
  gmailAccount: PILOT_TARGET_MAILBOX || null,
  lastSyncedAt: null,
};

/** Mutable in-memory store used by tests and mock services. */
export const mockDb = {
  batches: [...mockBatches],
  recipients: { ...mockRecipients },
  mails: [] as Mail[],
  settings: { ...mockSettings },
};

/** Admin account structure (fixture credentials — tests only, never production). */
export const MOCK_ADMIN = {
  email: process.env.PILOT_ADMIN_EMAIL ?? "admin@fixture.test",
  password: process.env.PILOT_ADMIN_PASSWORD ?? "fixture-password-123",
  name: "Department Admin",
};
