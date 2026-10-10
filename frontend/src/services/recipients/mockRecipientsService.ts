import type { Recipient } from "@/types";
import type { RecipientsService } from "./recipientsService";
import { mockDb } from "../mock/mockDb";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const clone = (r: Recipient): Recipient => ({ ...r });

export class MockRecipientsService implements RecipientsService {
  private listFor(batchId: string): Recipient[] {
    if (!mockDb.recipients[batchId]) mockDb.recipients[batchId] = [];
    return mockDb.recipients[batchId];
  }

  private syncCount(batchId: string): void {
    const batch = mockDb.batches.find((b) => b.id === batchId);
    if (batch) batch.recipientCount = this.listFor(batchId).length;
  }

  async list(batchId: string): Promise<Recipient[]> {
    await delay(350);
    return this.listFor(batchId).map(clone);
  }

  async add(batchId: string, input: { name: string; email: string }): Promise<Recipient> {
    await delay(450);
    const list = this.listFor(batchId);
    const email = input.email.trim().toLowerCase();
    if (list.some((r) => r.email.toLowerCase() === email)) {
      throw new Error("This email already exists in this batch");
    }
    const recipient: Recipient = {
      id: `${batchId}-r${Date.now().toString(36)}`,
      batchId,
      name: input.name.trim(),
      email: input.email.trim(),
      createdAt: new Date().toISOString(),
    };
    list.push(recipient);
    this.syncCount(batchId);
    return clone(recipient);
  }

  async update(batchId: string, id: string, input: { name: string; email: string }): Promise<Recipient> {
    await delay(450);
    const list = this.listFor(batchId);
    const recipient = list.find((r) => r.id === id);
    if (!recipient) throw new Error("Recipient not found");
    const email = input.email.trim().toLowerCase();
    if (list.some((r) => r.id !== id && r.email.toLowerCase() === email)) {
      throw new Error("This email already exists in this batch");
    }
    recipient.name = input.name.trim();
    recipient.email = input.email.trim();
    this.syncCount(batchId);
    return clone(recipient);
  }

  async remove(batchId: string, id: string): Promise<void> {
    await delay(400);
    const list = this.listFor(batchId);
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) throw new Error("Recipient not found");
    list.splice(index, 1);
    this.syncCount(batchId);
  }

  async bulkAdd(input: { batchId: string; rows: Array<{ name: string; email: string }> }): Promise<{ added: number }> {
    await delay(700);
    const list = this.listFor(input.batchId);
    let added = 0;
    for (const row of input.rows) {
      const email = row.email.trim().toLowerCase();
      if (list.some((r) => r.email.toLowerCase() === email)) continue;
      list.push({
        id: `${input.batchId}-r${Date.now().toString(36)}-${added}`,
        batchId: input.batchId,
        name: row.name.trim(),
        email: row.email.trim(),
        createdAt: new Date().toISOString(),
      });
      added += 1;
    }
    this.syncCount(input.batchId);
    return { added };
  }
}
