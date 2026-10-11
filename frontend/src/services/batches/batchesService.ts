import type { Batch } from "@/types";

export interface BulkImportResult {
  batchesCreated: number;
  batchesReused: number;
  recipientsAdded: number;
  invalidRows: number;
}

export interface BatchesService {
  list(): Promise<Batch[]>;
  getById(id: string): Promise<Batch>;
  create(input: { name: string; description?: string }): Promise<Batch>;
  update(id: string, input: { name: string; description?: string }): Promise<Batch>;
  remove(id: string): Promise<void>;
  bulkImport(rows: Array<{ "Batch Name": string; Description?: string; "Student Name"?: string; Email?: string }>): Promise<BulkImportResult>;
}
