import { http } from "../http";
import type { Batch } from "@/types";
import type { BatchesService } from "./batchesService";

export class ApiBatchesService implements BatchesService {
  list(): Promise<Batch[]> {
    return http.get<Batch[]>("/api/batches");
  }
  getById(id: string): Promise<Batch> {
    return http.get<Batch>(`/api/batches/${id}`);
  }
  create(input: { name: string; description?: string }): Promise<Batch> {
    return http.post<Batch>("/api/batches", input);
  }
  update(id: string, input: { name: string; description?: string }): Promise<Batch> {
    return http.put<Batch>(`/api/batches/${id}`, input);
  }
  remove(id: string): Promise<void> {
    return http.delete<void>(`/api/batches/${id}`);
  }
}
