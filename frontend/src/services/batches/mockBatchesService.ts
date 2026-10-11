import type { Batch } from "@/types";
import type { BatchesService } from "./batchesService";
import { mockDb } from "../mock/mockDb";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const clone = (b: Batch): Batch => ({ ...b });

export class MockBatchesService implements BatchesService {
  async list(): Promise<Batch[]> {
    await delay(400);
    return mockDb.batches
      .map(clone)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(id: string): Promise<Batch> {
    await delay(250);
    const batch = mockDb.batches.find((b) => b.id === id);
    if (!batch) throw new Error("Batch not found");
    return clone(batch);
  }

  async create(input: { name: string; description?: string }): Promise<Batch> {
    await delay(500);
    const name = input.name.trim();
    if (mockDb.batches.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("A batch with this name already exists");
    }
    const batch: Batch = {
      id: `b${Date.now().toString(36)}`,
      name,
      description: input.description?.trim() || null,
      recipientCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockDb.batches.push(batch);
    mockDb.recipients[batch.id] = [];
    return clone(batch);
  }

  async update(id: string, input: { name: string; description?: string }): Promise<Batch> {
    await delay(500);
    const batch = mockDb.batches.find((b) => b.id === id);
    if (!batch) throw new Error("Batch not found");
    const name = input.name.trim();
    if (mockDb.batches.some((b) => b.id !== id && b.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("A batch with this name already exists");
    }
    batch.name = name;
    batch.description = input.description?.trim() || null;
    batch.updatedAt = new Date().toISOString();
    return clone(batch);
  }

  async remove(id: string): Promise<void> {
    await delay(500);
    const index = mockDb.batches.findIndex((b) => b.id === id);
    if (index === -1) throw new Error("Batch not found");
    mockDb.batches.splice(index, 1);
    delete mockDb.recipients[id];
  }

  async bulkImport(
    rows: Array<{ "Batch Name": string; Description?: string; "Student Name"?: string; Email?: string }>
  ): Promise<{ batchesCreated: number; batchesReused: number; recipientsAdded: number; invalidRows: number }> {
    await delay(600);
    const stats = { batchesCreated: 0, batchesReused: 0, recipientsAdded: 0, invalidRows: 0 };
    const batchIdByName = new Map<string, string>();
    for (const row of rows) {
      const batchName = String(row["Batch Name"] ?? "").trim();
      if (!batchName || batchName.length > 80) {
        stats.invalidRows += 1;
        continue;
      }
      const nameKey = batchName.toLowerCase();
      let batchId = batchIdByName.get(nameKey);
      if (!batchId) {
        const existing = mockDb.batches.find((b) => b.name.toLowerCase() === nameKey);
        if (existing) {
          batchId = existing.id;
          stats.batchesReused += 1;
        } else {
          batchId = `b${Date.now().toString(36)}${stats.batchesCreated}`;
          mockDb.batches.push({
            id: batchId,
            name: batchName,
            description: row.Description?.trim() || null,
            recipientCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          mockDb.recipients[batchId] = [];
          stats.batchesCreated += 1;
        }
        batchIdByName.set(nameKey, batchId);
      }
      const studentName = String(row["Student Name"] ?? "").trim();
      const email = String(row.Email ?? "").trim().toLowerCase();
      if (!studentName || !email) continue;
      const list = mockDb.recipients[batchId] ?? [];
      if (list.some((r) => r.email.toLowerCase() === email)) continue;
      list.push({
        id: `r${Date.now().toString(36)}${stats.recipientsAdded}`,
        batchId,
        name: studentName,
        email,
        createdAt: new Date().toISOString(),
      });
      mockDb.recipients[batchId] = list;
      const batch = mockDb.batches.find((b) => b.id === batchId);
      if (batch) batch.recipientCount = list.length;
      stats.recipientsAdded += 1;
    }
    return stats;
  }
}
