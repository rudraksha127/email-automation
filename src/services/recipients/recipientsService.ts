import type { Recipient } from "@/types";

export interface AddRecipientsInput {
  batchId: string;
  /** Rows validated by parseRecipientsCsv before import is confirmed. */
  rows: Array<{ name: string; email: string }>;
}

export interface RecipientsService {
  list(batchId: string): Promise<Recipient[]>;
  add(batchId: string, input: { name: string; email: string }): Promise<Recipient>;
  update(batchId: string, id: string, input: { name: string; email: string }): Promise<Recipient>;
  remove(batchId: string, id: string): Promise<void>;
  bulkAdd(input: AddRecipientsInput): Promise<{ added: number }>;
}
