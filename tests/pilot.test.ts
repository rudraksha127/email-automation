import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the pilot DB at a throw-away file BEFORE the db module loads.
const dir = mkdtempSync(join(tmpdir(), "pilot-test-"));
process.env.PILOT_DB_PATH = join(dir, "test.db");
process.env.PILOT_DISABLE_POLLER = "true";

type Pipeline = typeof import("@/lib/pipeline");
type Db = typeof import("@/lib/db");
type Detection = typeof import("@/lib/batchDetection");

let pipeline: Pipeline;
let dbMod: Db;
let detection: Detection;

beforeAll(async () => {
  pipeline = await import("@/lib/pipeline");
  dbMod = await import("@/lib/db");
  detection = await import("@/lib/batchDetection");
});

afterAll(() => {
  dbMod?.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  const d = dbMod.getDb();
  d.exec("DELETE FROM forward_logs; DELETE FROM mails;");
});

/* ------------------------------------------------------------------ */
/* Batch detection engine (Sections 8/9 requirements)                  */
/* ------------------------------------------------------------------ */
describe("batch detection engine", () => {
  it("detects from subject — 'Internship Opportunity - Batch 2027'", () => {
    expect(detection.detectBatch("Internship Opportunity - Batch 2027", "")).toEqual({
      kind: "single",
      year: "2027",
      batchId: "b2027",
    });
  });

  it("detects from subject — 'Important update for 2028 batch'", () => {
    expect(detection.detectBatch("Important update for 2028 batch", "")).toEqual({
      kind: "single",
      year: "2028",
      batchId: "b2028",
    });
  });

  it("detects from body only", () => {
    const a = detection.detectBatch("Opportunity", "This opportunity is specifically for students from Batch 2027.");
    expect(a).toEqual({ kind: "single", year: "2027", batchId: "b2027" });
    const b = detection.detectBatch("Opportunity", "Eligible students are from the 2028 batch.");
    expect(b).toEqual({ kind: "single", year: "2028", batchId: "b2028" });
  });

  it("tolerates formatting variations", () => {
    for (const phrase of [
      "Batch 2027",
      "Batch-2027",
      "2027 Batch",
      "2027 batch",
      "batch of 2027",
      "BATCH 2027",
      "Batch 27",
      "28 batch",
      "batch of '27",
      "Batch-28",
    ]) {
      const res = detection.detectBatch(phrase, "");
      expect(res.kind, `phrase: ${phrase}`).toBe("single");
    }
  });

  it("does NOT match longer numbers (20270, 12027)", () => {
    expect(detection.detectBatch("Batch 20270", "").kind).toBe("none");
    expect(detection.detectBatch("ref 12027", "").kind).toBe("none");
  });

  it("returns 'none' when no supported batch mentioned", () => {
    expect(detection.detectBatch("Weekly newsletter", "No dates here.")).toEqual({ kind: "none" });
  });

  it("returns 'ambiguous' when BOTH batches mentioned — never auto-picks", () => {
    const out = detection.detectBatch("Opportunity for Batch 2027 and Batch 2028", "");
    expect(out.kind).toBe("ambiguous");
    if (out.kind === "ambiguous") expect(out.years).toEqual(["2027", "2028"]);
  });

  it("returns 'ambiguous' when an unsupported batch is mentioned alongside a supported batch", () => {
    const out = detection.detectBatch("Notice for Batch 2026 and Batch 2027", "");
    expect(out.kind).toBe("ambiguous");
    if (out.kind === "ambiguous") {
      expect(out.years).toContain("2026");
      expect(out.years).toContain("2027");
    }
  });
});

/* ------------------------------------------------------------------ */
/* Pilot data (Sections 3 + 21)                                        */
/* ------------------------------------------------------------------ */
describe("pilot seed data", () => {
  it("creates exactly Batch 2027 with 3 recipients and Batch 2028 with 4", () => {
    const batches = dbMod.listBatchesWithCounts().sort((a, b) => a.id.localeCompare(b.id));
    expect(batches.map((b) => b.id)).toEqual(["b2027", "b2028"]);
    expect(batches.find((b) => b.id === "b2027")?.recipientCount).toBe(3);
    expect(batches.find((b) => b.id === "b2028")?.recipientCount).toBe(4);
  });

  it("stores the EXACT approved recipient addresses", () => {
    const d = dbMod.getDb();
    const r27 = (
      d.prepare("SELECT email FROM recipients WHERE batch_id='b2027'").all() as Array<{ email: string }>
    )
      .map((r) => r.email)
      .sort();
    const r28 = (
      d.prepare("SELECT email FROM recipients WHERE batch_id='b2028'").all() as Array<{ email: string }>
    )
      .map((r) => r.email)
      .sort();
    expect(r27).toEqual(["r2027a@fixture.test", "r2027b@fixture.test", "r2027c@fixture.test"]);
    expect(r28).toEqual([
      "r2028a@fixture.test",
      "r2028b@fixture.test",
      "r2028c@fixture.test",
      "r2028d@fixture.test",
    ]);
  });

  it("seeds NO demo batches/mails", () => {
    const d = dbMod.getDb();
    const mailCount = (d.prepare("SELECT COUNT(*) c FROM mails").get() as { c: number }).c;
    expect(mailCount).toBe(0);
    const names = dbMod.listBatchesWithCounts().map((b) => b.name);
    expect(names.every((n) => n === "Batch 2027" || n === "Batch 2028")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Ingest pipeline: allowlist + detection + review (Sections 4/9/16)   */
/* ------------------------------------------------------------------ */
function ingest(gmailId: string, sender: string, subject: string, body: string) {
  return pipeline.ingestMessage({ gmailMessageId: gmailId, sender, senderName: null, subject, body });
}

describe("ingest pipeline safety", () => {
  it("TEST D: no batch mentioned → needs_review, not forwarded", async () => {
    const { mail, action } = await ingest("g-d", "sender.a@fixture.test", "Hello", "Just a normal mail.");
    expect(action).toBe("needs_review");
    expect(mail.status).toBe("needs_review");
    expect(String(mail.failureReason)).toMatch(/No supported batch/);
  });

  it("TEST E: both 2027 and 2028 → needs_review, NO auto-forward", async () => {
    const { mail, action } = await ingest(
      "g-e",
      "sender.b@fixture.test",
      "Opportunity for Batch 2027 and Batch 2028",
      ""
    );
    expect(action).toBe("needs_review");
    expect(mail.status).toBe("needs_review");
    const d = dbMod.getDb();
    expect(d.prepare("SELECT COUNT(*) c FROM forward_logs").get()).toEqual({ c: 0 });
  });

  it("TEST C: unauthorized sender → held for review, NEVER auto-forwarded", async () => {
    const { mail, action } = await ingest("g-c", "stranger@elsewhere.test", "Internship - Batch 2027", "Apply now.");
    expect(action).toBe("unauthorized_held");
    expect(mail.status).toBe("needs_review");
    expect(String(mail.failureReason)).toMatch(/Unauthorized sender/);
    const d = dbMod.getDb();
    expect(d.prepare("SELECT COUNT(*) c FROM forward_logs").get()).toEqual({ c: 0 });
  });

  it("normalizes sender formatting like 'Lucky Udiya <sender.a@fixture.test>'", async () => {
    const { mail } = await ingest(
      "g-norm",
      '"Lucky Udiya" <sender.a@fixture.test>',
      "Opportunity - Batch 2027",
      "Details"
    );
    expect(mail.sender).toBe("sender.a@fixture.test");
  });

  it("TEST F (part 1): duplicate gmail id → duplicate_ignored, no second row", async () => {
    const first = await ingest("g-f", "sender.a@fixture.test", "Update - Batch 2027", "Details.");
    const second = await ingest("g-f", "sender.a@fixture.test", "Update - Batch 2027", "Details.");
    expect(second.action).toBe("duplicate_ignored");
    expect(second.mail.id).toBe(first.mail.id);
    const d = dbMod.getDb();
    expect(d.prepare("SELECT COUNT(*) c FROM mails WHERE gmail_message_id='g-f'").get()).toEqual({ c: 1 });
  });
});

/* ------------------------------------------------------------------ */
/* Forwarding idempotency with a mocked Gmail API (Sections 10/12/13)  */
/* ------------------------------------------------------------------ */
describe("forwarding + duplicate protection (mocked Gmail API)", () => {
  let sendCalls: Array<{ url: string; body: unknown }>;

  beforeAll(() => {
    // Fake but structurally valid token with far-future expiry so refresh never triggers.
    const d = dbMod.getDb();
    d.prepare(
      "INSERT INTO gmail_tokens(id,account_email,access_token,refresh_token,expiry_ms,updated_at) VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET expiry_ms=excluded.expiry_ms, access_token=excluded.access_token"
    ).run(
      "target@fixture.test",
      "fake-access-token",
      "fake-refresh",
      Date.now() + 3600_000,
      new Date().toISOString()
    );
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

  it("TEST A: 2027 mail → forwards to exactly the 3 batch-2027 recipients with CC", async () => {
    const { mail, action } = await ingest(
      "g-a",
      "sender.a@fixture.test",
      "Internship Opportunity - Batch 2027",
      "For Batch 2027 students."
    );
    expect(action).toBe("forwarded");
    expect(mail.status).toBe("forwarded");
    expect(mail.batchId).toBe("b2027");
    expect(mail.recipientCount).toBe(3);
    expect(mail.ccEmail).toBe("cc@fixture.test");
    expect(sendCalls).toHaveLength(1);
    const raw = String((sendCalls[0].body as { raw: string }).raw);
    const mime = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    expect(mime).toContain("r2027a@fixture.test");
    expect(mime).toContain("r2027b@fixture.test");
    expect(mime).toContain("r2027c@fixture.test");
    expect(mime).toContain("Cc: cc@fixture.test");
    expect(mime).not.toContain("r2028a@fixture.test"); // 2028 recipient must NOT receive it
    const d = dbMod.getDb();
    const log = d.prepare("SELECT * FROM forward_logs WHERE gmail_message_id='g-a'").get() as Record<
      string,
      unknown
    >;
    expect(log.status).toBe("sent");
    expect(Number(log.recipient_count)).toBe(3);
  });

  it("TEST B: 2028 mail → forwards to exactly the 4 batch-2028 recipients", async () => {
    const { mail, action } = await ingest(
      "g-b",
      "sender.b@fixture.test",
      "Important update for 2028 batch",
      ""
    );
    expect(action).toBe("forwarded");
    expect(mail.batchId).toBe("b2028");
    expect(mail.recipientCount).toBe(4);
    expect(sendCalls).toHaveLength(1);
    const raw = String((sendCalls[0].body as { raw: string }).raw);
    const mime = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    for (const addr of [
      "r2028a@fixture.test",
      "r2028b@fixture.test",
      "r2028c@fixture.test",
      "r2028d@fixture.test",
    ]) {
      expect(mime).toContain(addr);
    }
    expect(mime).not.toContain("r2027a@fixture.test"); // 2027 recipient must NOT receive it
  });

  it("disables forwarding if IT Company CC is not configured", async () => {
    const d = dbMod.getDb();
    d.prepare("DELETE FROM settings WHERE key='ccEmail'").run();
    try {
      const { mail, action } = await ingest(
        "g-nocc",
        "sender.a@fixture.test",
        "Internship - Batch 2027",
        "Body"
      );
      expect(action).toBe("failed");
      expect(mail.status).toBe("failed");
      expect(String(mail.failureReason)).toMatch(/IT Company CC is not configured/);
      expect(sendCalls).toHaveLength(0);
    } finally {
      d.prepare("INSERT INTO settings(key,value) VALUES('ccEmail','cc@fixture.test')").run();
    }
  });

  it("TEST F: re-processing the same gmail id NEVER sends a second time", async () => {
    await ingest("g-f2", "sender.a@fixture.test", "Notice - Batch 2027", "");
    expect(sendCalls).toHaveLength(1);
    // Simulate a poll/retry/restart re-ingesting the same message:
    const again = await ingest("g-f2", "sender.a@fixture.test", "Notice - Batch 2027", "");
    expect(again.action).toBe("duplicate_ignored");
    expect(sendCalls).toHaveLength(1); // still exactly one Gmail send
    // And a manual re-forward of the already-forwarded mail is a no-op:
    const row = pipeline.getMailByGmail("g-f2")!;
    const redelivered = await pipeline.deliverStoredMail(row, "b2027", true);
    expect(String(redelivered.status)).toBe("forwarded");
    expect(sendCalls).toHaveLength(1); // no second delivery
  });

  it("TEST G: Gmail failure → failed + retryable + no duplicate delivery", async () => {
    // First send fails, subsequent sends succeed.
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

    const { mail, action } = await ingest("g-g", "sender.a@fixture.test", "Placement - Batch 2027", "");
    expect(action).toBe("failed");
    expect(mail.status).toBe("failed");
    expect(String(mail.failureReason)).toBeTruthy();
    expect(mail.batchId).toBe("b2027"); // batch preserved for retry

    // Retry (as the API route does): only failed log rows may be re-opened.
    const row = pipeline.getMailRow(String(mail.id))!;
    const retried = await pipeline.deliverStoredMail(row, "b2027", true);
    expect(retried.status).toBe("forwarded");
    expect(sendCalls).toHaveLength(2); // 1 failed attempt + exactly 1 successful delivery

    // Third attempt must be a no-op:
    const third = await pipeline.deliverStoredMail(pipeline.getMailRow(String(mail.id))!, "b2027", true);
    expect(String(third.status)).toBe("forwarded");
    expect(sendCalls).toHaveLength(2);

    const d = dbMod.getDb();
    const logs = d
      .prepare("SELECT status FROM forward_logs WHERE gmail_message_id='g-g'")
      .all() as Array<{ status: string }>;
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("sent_manual");
  });
});