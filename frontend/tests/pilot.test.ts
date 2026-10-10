import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the test DB at a throw-away file BEFORE the db module loads.
const dir = mkdtempSync(join(tmpdir(), "pilot-test-"));
process.env.PILOT_DB_PATH = join(dir, "test.db");
process.env.PILOT_DISABLE_POLLER = "true";

type Pipeline = typeof import("@/lib/pipeline");
type Db = typeof import("@/lib/db");

let pipeline: Pipeline;
let dbMod: Db;

const ORG = "org_default"; // seeded default workspace (fixture env config)

beforeAll(async () => {
  pipeline = await import("@/lib/pipeline");
  dbMod = await import("@/lib/db");
});

afterAll(() => {
  dbMod?.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  const d = dbMod.getDb();
  d.exec("DELETE FROM forward_logs; DELETE FROM mails; DELETE FROM forwarding_rules;");
  d.prepare("DELETE FROM settings WHERE org_id=? AND key='ccEmail'").run(ORG);
  dbMod.setSetting(ORG, "ccEmail", "cc@fixture.test");
  dbMod.setSetting(ORG, "autoForwarding", "1");
});

describe("seed data (default workspace)", () => {
  it("creates exactly two fixture groups with 3 and 4 recipients", () => {
    const batches = dbMod.listBatchesWithCounts(ORG).sort((a, b) => a.id.localeCompare(b.id));
    expect(batches.map((b) => b.id)).toEqual(["b2027", "b2028"]);
    expect(batches.find((b) => b.id === "b2027")?.recipientCount).toBe(3);
    expect(batches.find((b) => b.id === "b2028")?.recipientCount).toBe(4);
  });

  it("stores only the fixture recipient addresses from env config", () => {
    const d = dbMod.getDb();
    const r27 = (d.prepare("SELECT email FROM recipients WHERE batch_id='b2027'").all() as Array<{ email: string }>)
      .map((r) => r.email).sort();
    expect(r27).toEqual(["r2027a@fixture.test", "r2027b@fixture.test", "r2027c@fixture.test"]);
  });

  it("seeds the default workspace, its admin membership and the allowlist", () => {
    const d = dbMod.getDb();
    expect(dbMod.getOrg(ORG)).toBeTruthy();
    const orgs = dbMod.listUserOrgs("admin@fixture.test");
    expect(orgs.some((o) => o.orgId === ORG && o.role === "admin")).toBe(true);
    const senders = d.prepare("SELECT sender_email FROM sender_rules WHERE org_id=?").all(ORG) as Array<{ sender_email: string }>;
    expect(senders.map((s) => s.sender_email)).toEqual(
      expect.arrayContaining(["sender.a@fixture.test", "sender.b@fixture.test"])
    );
    // no demo mails on a fresh DB
    const mailCount = (d.prepare("SELECT COUNT(*) c FROM mails").get() as { c: number }).c;
    expect(mailCount).toBe(0);
  });
});

function ingest(orgId: string, gmailId: string, sender: string, subject: string, body: string) {
  return pipeline.ingestMessage(orgId, {
    gmailMessageId: gmailId, sender, senderName: null, subject, body,
  });
}

describe("ingest pipeline safety", () => {
  it("no group mentioned -> needs_review, not forwarded", async () => {
    const { mail, action } = await ingest(ORG, "g-d", "sender.a@fixture.test", "Hello", "Just a normal mail.");
    expect(action).toBe("needs_review");
    expect(mail.status).toBe("needs_review");
    expect(String(mail.failureReason)).toMatch(/No configured group/);
  });

  it("both groups mentioned -> needs_review, NO auto-forward", async () => {
    const { mail, action } = await ingest(
      ORG, "g-e", "sender.b@fixture.test",
      "Opportunity for Batch 2027 and Batch 2028", ""
    );
    expect(action).toBe("needs_review");
    const d = dbMod.getDb();
    expect(d.prepare("SELECT COUNT(*) c FROM forward_logs").get()).toEqual({ c: 0 });
    expect(mail.status).toBe("needs_review");
  });

  it("unauthorized sender -> held for review, NEVER auto-forwarded", async () => {
    const { mail, action } = await ingest(ORG, "g-c", "stranger@elsewhere.test", "Internship - Batch 2027", "Apply now.");
    expect(action).toBe("unauthorized_held");
    expect(mail.status).toBe("needs_review");
    expect(String(mail.failureReason)).toMatch(/Unauthorized sender/);
    const d = dbMod.getDb();
    expect(d.prepare("SELECT COUNT(*) c FROM forward_logs").get()).toEqual({ c: 0 });
  });

  it("normalizes sender formatting like '\"Name\" <sender.a@fixture.test>'", async () => {
    const { mail } = await ingest(
      ORG, "g-norm", '"Lucky Udiya" <sender.a@fixture.test>', "Opportunity - Batch 2027", "Details"
    );
    expect(mail.sender).toBe("sender.a@fixture.test");
  });

  it("duplicate gmail id within org -> duplicate_ignored, no second row", async () => {
    const first = await ingest(ORG, "g-f", "sender.a@fixture.test", "Update - Batch 2027", "Details.");
    const second = await ingest(ORG, "g-f", "sender.a@fixture.test", "Update - Batch 2027", "Details.");
    expect(second.action).toBe("duplicate_ignored");
    expect(second.mail.id).toBe(first.mail.id);
    const d = dbMod.getDb();
    expect(d.prepare("SELECT COUNT(*) c FROM mails WHERE org_id=? AND gmail_message_id='g-f'").get(ORG)).toEqual({ c: 1 });
  });
});

describe("forwarding + duplicate protection (mocked Gmail API)", () => {
  let sendCalls: Array<{ url: string; body: unknown }>;

  beforeAll(() => {
    const d = dbMod.getDb();
    d.prepare(
      "INSERT INTO gmail_tokens(org_id,account_email,access_token,refresh_token,expiry_ms,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(org_id) DO UPDATE SET expiry_ms=excluded.expiry_ms, access_token=excluded.access_token"
    ).run(ORG, "connected@fixture.test", "fake-access-token", "fake-refresh", Date.now() + 3600_000, new Date().toISOString());
  });

  beforeEach(() => {
    sendCalls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/messages/send")) {
          sendCalls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
          return new Response(JSON.stringify({ id: `sent-${sendCalls.length}` }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      })
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("TEST A: group-2027 mail forwards to exactly the 3 recipients with CC", async () => {
    const { mail, action } = await ingest(
      ORG, "g-a", "sender.a@fixture.test", "Internship Opportunity - Batch 2027", "For Batch 2027 students."
    );
    expect(action).toBe("forwarded");
    expect(mail.status).toBe("forwarded");
    expect(mail.batchId).toBe("b2027");
    expect(mail.recipientCount).toBe(3);
    expect(mail.ccEmail).toBe("cc@fixture.test");
    expect(sendCalls).toHaveLength(1);
    const raw = String((sendCalls[0]!.body as { raw: string }).raw);
    const mime = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    expect(mime).toContain("r2027a@fixture.test");
    expect(mime).toContain("Cc: cc@fixture.test");
    expect(mime).not.toContain("r2028a@fixture.test"); // other group must NOT receive it
    const log = dbMod.getDb().prepare(
      "SELECT status, recipient_count FROM forward_logs WHERE org_id=? AND gmail_message_id='g-a'"
    ).get(ORG) as Record<string, unknown>;
    expect(log.status).toBe("sent");
    expect(Number(log.recipient_count)).toBe(3);
  });

  it("TEST B: group-2028 mail forwards to exactly the 4 recipients", async () => {
    const { mail, action } = await ingest(
      ORG, "g-b", "sender.b@fixture.test", "Important update for 2028 batch", ""
    );
    expect(action).toBe("forwarded");
    expect(mail.batchId).toBe("b2028");
    expect(mail.recipientCount).toBe(4);
    const raw = String((sendCalls[0]!.body as { raw: string }).raw);
    const mime = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    for (const addr of ["r2028a@fixture.test", "r2028b@fixture.test", "r2028c@fixture.test", "r2028d@fixture.test"]) {
      expect(mime).toContain(addr);
    }
    expect(mime).not.toContain("r2027a@fixture.test");
  });

  it("disables forwarding when CC is not configured", async () => {
    const d = dbMod.getDb();
    d.prepare("DELETE FROM settings WHERE org_id=? AND key='ccEmail'").run(ORG);
    try {
      const { mail, action } = await ingest(ORG, "g-nocc", "sender.a@fixture.test", "Internship - Batch 2027", "Body");
      expect(action).toBe("failed");
      expect(mail.status).toBe("failed");
      expect(String(mail.failureReason)).toMatch(/CC is not configured/);
      expect(sendCalls).toHaveLength(0);
    } finally {
      dbMod.setSetting(ORG, "ccEmail", "cc@fixture.test");
    }
  });

  it("holds mail when auto-forwarding is disabled", async () => {
    dbMod.setSetting(ORG, "autoForwarding", "0");
    try {
      const { action } = await ingest(ORG, "g-auto", "sender.a@fixture.test", "Update - Batch 2027", "");
      expect(action).toBe("pending_manual");
      expect(sendCalls).toHaveLength(0);
    } finally {
      dbMod.setSetting(ORG, "autoForwarding", "1");
    }
  });

  it("TEST F: re-processing the same gmail id NEVER sends a second time", async () => {
    await ingest(ORG, "g-f2", "sender.a@fixture.test", "Notice - Batch 2027", "");
    expect(sendCalls).toHaveLength(1);
    const again = await ingest(ORG, "g-f2", "sender.a@fixture.test", "Notice - Batch 2027", "");
    expect(again.action).toBe("duplicate_ignored");
    expect(sendCalls).toHaveLength(1);
    const row = pipeline.getMailByGmail(ORG, "g-f2")!;
    const redelivered = await pipeline.deliverStoredMail(row, "b2027", true);
    expect(String(redelivered.status)).toBe("forwarded");
    expect(sendCalls).toHaveLength(1); // no second delivery
  });

  it("TEST G: Gmail failure -> failed + retryable + exactly one successful delivery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/messages/send")) {
          sendCalls.push({ url, body: {} });
          if (sendCalls.length === 1) return new Response("quota exceeded", { status: 429 });
          return new Response(JSON.stringify({ id: "sent-after-retry" }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      })
    );

    const { mail, action } = await ingest(ORG, "g-g", "sender.a@fixture.test", "Placement - Batch 2027", "");
    expect(action).toBe("failed");
    expect(mail.status).toBe("failed");
    expect(mail.batchId).toBe("b2027"); // group preserved for retry

    const row = pipeline.getMailRow(String(mail.id))!;
    const retried = await pipeline.deliverStoredMail(row, "b2027", true);
    expect(retried.status).toBe("forwarded");
    expect(sendCalls).toHaveLength(2);

    // Third attempt must be a no-op:
    const third = await pipeline.deliverStoredMail(pipeline.getMailRow(String(mail.id))!, "b2027", true);
    expect(String(third.status)).toBe("forwarded");
    expect(sendCalls).toHaveLength(2);

    const logs = dbMod.getDb().prepare(
      "SELECT status FROM forward_logs WHERE org_id=? AND gmail_message_id='g-g'"
    ).all(ORG) as Array<{ status: string }>;
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("sent_manual");
  });

  it("group without recipients -> needs_review, no send", async () => {
    const d = dbMod.getDb();
    d.prepare(
      "INSERT INTO batches(id,org_id,name,created_at,updated_at) VALUES('b-empty',?, 'Empty Group', ?, ?)"
    ).run(ORG, new Date().toISOString(), new Date().toISOString());
    const { mail, action } = await ingest(ORG, "g-empty", "sender.a@fixture.test", "Update - Empty Group", "");
    expect(action).toBe("needs_review");
    expect(String(mail.failureReason)).toMatch(/no recipients/i);
    expect(sendCalls).toHaveLength(0);
    d.prepare("DELETE FROM batches WHERE id='b-empty'").run();
  });
});

describe("tenant isolation inside the pipeline", () => {
  beforeEach(() => {
    // This describe may trigger forwarding — always stub the Gmail API so no
    // real message can ever leave the test process.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ id: "sent-stub" }), { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mail rows, idempotency and batch ownership are organization-scoped", async () => {
    const other = dbMod.createOrganization("Other Workspace", "admin@fixture.test");
    try {
      // Same gmail id in another org is a DIFFERENT message (different mailbox).
      const a = await ingest(ORG, "g-iso", "sender.a@fixture.test", "Hello", "no group");
      const b = await ingest(other.id, "g-iso", "sender.a@fixture.test", "Hello", "no group");
      expect(b.action).not.toBe("duplicate_ignored");
      expect(b.mail.id).not.toBe(a.mail.id);
      // Scoped lookups:
      expect(pipeline.getMailByGmail(ORG, "g-iso")?.id).toBe(a.mail.id);
      expect(pipeline.getMailByGmail(other.id, "g-iso")?.id).toBe(b.mail.id);
      // Cross-tenant row fetch returns undefined (routes answer 404):
      expect(pipeline.getOrgMailRow(other.id, String(a.mail.id))).toBeUndefined();
      expect(pipeline.getOrgMailRow(ORG, String(a.mail.id))).toBeTruthy();

      // Delivering with a batch of a DIFFERENT organization is refused
      // (fails before any network send — no real email can go out).
      const row = pipeline.getOrgMailRow(ORG, String(a.mail.id))!;
      const foreignBatchRow = { ...row, org_id: other.id };
      const refused = await pipeline.deliverStoredMail(foreignBatchRow, "b2027", true);
      expect(String(refused.failure_reason)).toMatch(/does not belong to this workspace/);
      expect(refused.status).toBe("needs_review");
    } finally {
      dbMod.getDb().prepare("DELETE FROM organization_members WHERE org_id=?").run(other.id);
      dbMod.getDb().prepare("DELETE FROM organizations WHERE id=?").run(other.id);
    }
  });

  it("alreadyDelivered is scoped per organization", async () => {
    await ingest(ORG, "g-idem", "sender.a@fixture.test", "Notice - Batch 2027", "");
    expect(pipeline.alreadyDelivered(ORG, "g-idem")).toBe(true);
    expect(pipeline.alreadyDelivered("org_someone_else", "g-idem")).toBe(false);
  });
});
