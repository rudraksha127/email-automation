import type { Batch } from "@/types";

export interface BatchesService {
  list(): Promise<Batch[]>;
  getById(id: string): Promise<Batch>;
  create(input: { name: string; description?: string }): Promise<Batch>;
  update(id: string, input: { name: string; description?: string }): Promise<Batch>;
  remove(id: string): Promise<void>;
}
