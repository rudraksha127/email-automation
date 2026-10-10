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
}
