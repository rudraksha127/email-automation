import { http } from "../http";
import type { Recipient } from "@/types";
import type { RecipientsService } from "./recipientsService";

export class ApiRecipientsService implements RecipientsService {
  list(batchId: string): Promise<Recipient[]> {
    return http.get<Recipient[]>(`/api/batches/${batchId}/recipients`);
  }
  add(batchId: string, input: { name: string; email: string }): Promise<Recipient> {
    return http.post<Recipient>(`/api/batches/${batchId}/recipients`, input);
  }
  update(batchId: string, id: string, input: { name: string; email: string }): Promise<Recipient> {
    return http.put<Recipient>(`/api/batches/${batchId}/recipients/${id}`, input);
  }
  remove(batchId: string, id: string): Promise<void> {
    return http.delete<void>(`/api/batches/${batchId}/recipients/${id}`);
  }
  bulkAdd(input: { batchId: string; rows: Array<{ name: string; email: string }> }): Promise<{ added: number }> {
    return http.post<{ added: number }>(`/api/batches/${input.batchId}/recipients/import`, {
      rows: input.rows,
    });
  }
}
