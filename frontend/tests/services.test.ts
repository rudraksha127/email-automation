import { describe, it, expect, beforeEach } from "vitest";
import { applyMailFilters } from "@/services/mails/mailsService";
import type { MailSummary } from "@/services/mails/mailsService";
import { MockBatchesService } from "@/services/batches/mockBatchesService";
import { MockRecipientsService } from "@/services/recipients/mockRecipientsService";
import { MockMailsService } from "@/services/mails/mockMailsService";
import { MockSettingsService } from "@/services/settings/mockSettingsService";
import { MockAuthService } from "@/services/auth/mockAuthService";
import { mockDb } from "@/services/mock/mockDb";

function summary(partial: Partial<MailSummary>): MailSummary {
  return {
    id: "m",
    sender: "s@x.com",
    subject: "Subject",
    receivedAt: "2026-10-01T10:00:00Z",
    batchId: null,
    batchName: null,
    status: "pending",
    ...partial,
  };
}

describe("applyMailFilters", () => {
  const mails: MailSummary[] = [
    summary({ id: "1", subject: "Campus Hiring", sender: "a@x.com", status: "forwarded", batchId: "b2025", batchName: "Batch 2025", receivedAt: "2026-10-02T10:00:00Z" }),
    summary({ id: "2", subject: "Internship", sender: "b@x.com", status: "needs_review" }),
    summary({ id: "3", subject: "Workshop", sender: "c@x.com", status: "failed", batchId: "b2023", batchName: "Batch 2023" }),
  ];

  it("filters by status", () => {
    const out = applyMailFilters(mails, { status: "forwarded" });
    expect(out.map((m) => m.id)).toEqual(["1"]);
  });

  it("filters by batch", () => {
    const out = applyMailFilters(mails, { batchId: "b2023" });
    expect(out.map((m) => m.id)).toEqual(["3"]);
  });

  it("searches subject and sender case-insensitively", () => {
    expect(applyMailFilters(mails, { search: "campus" }).map((m) => m.id)).toEqual(["1"]);
    expect(applyMailFilters(mails, { search: "B@X" }).map((m) => m.id)).toEqual(["2"]);
  });

  it("sorts newest first", () => {
    const out = applyMailFilters(mails, {});
    expect(out[0].id).toBe("1");
  });
});

describe("MockBatchesService", () => {
  it("creates, updates and rejects duplicate names", async () => {
    const svc = new MockBatchesService();
    const created = await svc.create({ name: "Batch 2099", description: "Test" });
    expect(created.recipientCount).toBe(0);

    await expect(svc.create({ name: "batch 2099" })).rejects.toThrow(/already exists/);

    const updated = await svc.update(created.id, { name: "Batch 2098" });
    expect(updated.name).toBe("Batch 2098");

    await svc.remove(created.id);
    await expect(svc.getById(created.id)).rejects.toThrow(/not found/);
  });
});

describe("MockRecipientsService", () => {
  it("adds, rejects duplicates, updates and removes", async () => {
    const batches = new MockBatchesService();
    const batch = await batches.create({ name: "Batch T" });
    const svc = new MockRecipientsService();

    const r = await svc.add(batch.id, { name: "A", email: "a@x.com" });
    await expect(svc.add(batch.id, { name: "B", email: "A@X.com" })).rejects.toThrow(/already exists/);

    const updated = await svc.update(batch.id, r.id, { name: "A2", email: "a2@x.com" });
    expect(updated.email).toBe("a2@x.com");

    await svc.remove(batch.id, r.id);
    expect(await svc.list(batch.id)).toHaveLength(0);
  });

  it("bulkAdd skips existing emails and syncs counts", async () => {
    const batches = new MockBatchesService();
    const batch = await batches.create({ name: "Batch B" });
    const svc = new MockRecipientsService();

    await svc.add(batch.id, { name: "Existing", email: "dup@x.com" });
    const { added } = await svc.bulkAdd({
      batchId: batch.id,
      rows: [
        { name: "N1", email: "n1@x.com" },
        { name: "N2", email: "dup@x.com" },
        { name: "N3", email: "n3@x.com" },
      ],
    });
    expect(added).toBe(2);
    const after = await batches.getById(batch.id);
    expect(after.recipientCount).toBe(3);
  });
});

describe("MockMailsService forwarding", () => {
  beforeEach(() => {
    mockDb.mails = [
      {
        id: "m1",
        gmailMessageId: "g-1001",
        sender: "sender.a@fixture.test",
        senderName: "Lucky Udiya",
        subject: "Pilot 2027",
        bodyText: "Batch 2027",
        receivedAt: new Date().toISOString(),
        status: "forwarded",
        batchId: "b2027",
        batchName: "Batch 2027",
        recipientCount: 3,
        failureReason: null,
        attachments: [],
        forwardedAt: new Date().toISOString(),
        ccEmail: "cc@fixture.test",
      },
      {
        id: "m2",
        gmailMessageId: "g-1002",
        sender: "sender.b@fixture.test",
        senderName: "Rudraksh Udiya",
        subject: "Review mail",
        bodyText: "General mail",
        receivedAt: new Date().toISOString(),
        status: "needs_review",
        batchId: null,
        batchName: null,
        recipientCount: null,
        failureReason: "No supported batch detected",
        attachments: [],
        forwardedAt: null,
        ccEmail: null,
      },
      {
        id: "m3",
        gmailMessageId: "g-1003",
        sender: "sender.a@fixture.test",
        senderName: "Lucky Udiya",
        subject: "Pilot 2028",
        bodyText: "Batch 2028",
        receivedAt: new Date().toISOString(),
        status: "forwarded",
        batchId: "b2028",
        batchName: "Batch 2028",
        recipientCount: 4,
        failureReason: null,
        attachments: [],
        forwardedAt: new Date().toISOString(),
        ccEmail: "cc@fixture.test",
      },
    ];
  });

  it("rejects double forwarding (duplicate protection)", async () => {
    const svc = new MockMailsService();
    await expect(svc.forward("m3", "b2028")).rejects.toThrow(/already been forwarded/);
  });

  it("rejects forwarding to an empty batch and records CC", async () => {
    const batches = new MockBatchesService();
    const empty = await batches.create({ name: "Empty Batch" });
    const svc = new MockMailsService();
    await expect(svc.forward("m2", empty.id)).rejects.toThrow(/no recipients/);
  });

  it("retry only applies to failed mails", async () => {
    const svc = new MockMailsService();
    await expect(svc.retry("m1")).rejects.toThrow(/failed/);
  });
});

describe("MockSettingsService dashboard stats", () => {
  it("derives stats from mock data without fake numbers", async () => {
    const svc = new MockSettingsService();
    const stats = await svc.getDashboardStats();
    expect(stats.totalBatches).toBeGreaterThan(0);
    expect(stats.newMails).toBeGreaterThanOrEqual(0);
    expect(stats.needsReview).toBeGreaterThanOrEqual(0);
  });
});

describe("MockAuthService", () => {
  it("rejects invalid credentials", async () => {
    const svc = new MockAuthService();
    await expect(svc.login({ email: "wrong@x.com", password: "bad" })).rejects.toThrow(
      /Invalid email or password/
    );
  });
});
