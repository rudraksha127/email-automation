import type { Mail, MailListFilters, MailStatus } from "@/types";

export interface MailSummary {
  id: string;
  sender: string;
  subject: string;
  receivedAt: string;
  batchId: string | null;
  batchName: string | null;
  status: MailStatus;
}

export interface MailsService {
  list(filters: Partial<MailListFilters>): Promise<MailSummary[]>;
  getById(id: string): Promise<Mail>;
  forward(id: string, batchId: string): Promise<Mail>;
  markNotRelevant(id: string): Promise<Mail>;
  retry(id: string): Promise<Mail>;
}

export const ALL_STATUSES: MailStatus[] = ["pending", "forwarded", "needs_review", "failed"];

/** Shared filtering logic — used by the mock service and unit-tested directly. */
export function applyMailFilters(mails: MailSummary[], filters: Partial<MailListFilters>): MailSummary[] {
  let out = [...mails];
  if (filters.status && filters.status !== "all") {
    out = out.filter((m) => m.status === filters.status);
  }
  if (filters.batchId && filters.batchId !== "all") {
    out = out.filter((m) => m.batchId === filters.batchId);
  }
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (m) => m.subject.toLowerCase().includes(q) || m.sender.toLowerCase().includes(q)
    );
  }
  let result = out.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  if (filters.limit) {
    result = result.slice(filters.offset || 0, (filters.offset || 0) + filters.limit);
  }
  return result;
}
