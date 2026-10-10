import { http } from "../http";
import type { Mail } from "@/types";
import type { MailSummary, MailsService } from "./mailsService";

/** Real API-backed mails service (activated when backend endpoints exist). */
export class ApiMailsService implements MailsService {
  list(filters: Partial<import("@/types").MailListFilters>): Promise<MailSummary[]> {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (filters.batchId && filters.batchId !== "all") params.set("batchId", filters.batchId);
    if (filters.search) params.set("search", filters.search);
    const qs = params.toString();
    return http.get<MailSummary[]>(`/api/mails${qs ? `?${qs}` : ""}`);
  }

  getById(id: string): Promise<Mail> {
    return http.get<Mail>(`/api/mails/${id}`);
  }

  forward(id: string, batchId: string): Promise<Mail> {
    return http.post<Mail>(`/api/mails/${id}/forward`, { batchId });
  }

  markNotRelevant(id: string): Promise<Mail> {
    return http.post<Mail>(`/api/mails/${id}/reject`, {});
  }

  retry(id: string): Promise<Mail> {
    return http.post<Mail>(`/api/mails/${id}/retry`, {});
  }
}
