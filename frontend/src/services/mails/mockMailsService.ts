import type { Mail } from "@/types";
import type { MailSummary, MailsService } from "./mailsService";
import { applyMailFilters } from "./mailsService";
import { mockDb } from "../mock/mockDb";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toSummary(m: Mail): MailSummary {
  return {
    id: m.id,
    sender: m.sender,
    subject: m.subject,
    receivedAt: m.receivedAt,
    batchId: m.batchId,
    batchName: m.batchName,
    status: m.status,
  };
}

export class MockMailsService implements MailsService {
  async list(filters: Partial<import("@/types").MailListFilters>): Promise<MailSummary[]> {
    await delay(400);
    return applyMailFilters(mockDb.mails.map(toSummary), filters);
  }

  async getById(id: string): Promise<Mail> {
    await delay(350);
    const mail = mockDb.mails.find((m) => m.id === id);
    if (!mail) throw new Error("Mail not found");
    return { ...mail, attachments: mail.attachments.map((a) => ({ ...a })) };
  }

  /** Manual forwarding from the review flow (admin-selected batch, explicit confirm). */
  async forward(id: string, batchId: string): Promise<Mail> {
    await delay(900);
    const mail = mockDb.mails.find((m) => m.id === id);
    if (!mail) throw new Error("Mail not found");
    if (mail.status === "forwarded") throw new Error("This mail has already been forwarded");
    const batch = mockDb.batches.find((b) => b.id === batchId);
    if (!batch) throw new Error("Selected batch no longer exists");
    const recipients = mockDb.recipients[batchId] ?? [];
    if (recipients.length === 0) throw new Error("The selected batch has no recipients");
    mail.status = "forwarded";
    mail.batchId = batch.id;
    mail.batchName = batch.name;
    mail.recipientCount = recipients.length;
    mail.forwardedAt = new Date().toISOString();
    mail.ccEmail = mockDb.settings.ccEmail;
    return { ...mail };
  }

  async markNotRelevant(id: string): Promise<Mail> {
    await delay(500);
    const mail = mockDb.mails.find((m) => m.id === id);
    if (!mail) throw new Error("Mail not found");
    mail.status = "failed";
    mail.failureReason = "Marked as not relevant by admin";
    return { ...mail };
  }

  async retry(id: string): Promise<Mail> {
    await delay(900);
    const mail = mockDb.mails.find((m) => m.id === id);
    if (!mail) throw new Error("Mail not found");
    if (mail.status !== "failed") throw new Error("Only failed mails can be retried");
    mail.status = "forwarded";
    mail.failureReason = null;
    mail.recipientCount = mockDb.recipients[mail.batchId ?? ""]?.length ?? 0;
    mail.forwardedAt = new Date().toISOString();
    mail.ccEmail = mockDb.settings.ccEmail;
    return { ...mail };
  }
}
