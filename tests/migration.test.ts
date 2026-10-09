import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Phase K: safe migration of an existing single-tenant (v1) database.
 * A v1 database is constructed with the ORIGINAL schema + rows, then opened
 * through the app's getDb() — which must back it up, upgrade it in place and
 * preserve every record under the default workspace.
 */
const dir = mkdtempSync(join(tmpdir(), "migration-test-"));
const dbPath = join(dir, "legacy.db");
process.env.PILOT_DB_PATH = dbPath;
process.env.PILOT_DISABLE_POLLER = "true";

type Db = typeof import("@/lib/db");
let dbMod: Db;

function buildLegacyDatabase(): void {
  const d = new DatabaseSync(dbPath);
  d.exec("PRAGMA journal_mode = WAL;");
  // --- original v1 schema (as shipped before multi-tenancy) ---
  d.exec(`CREATE TABLE batches (
    id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`);
  d.exec(`CREATE TABLE recipients (
    id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    name TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(batch_id, email)
  );`);
  d.exec(`CREATE TABLE mails (
    id TEXT PRIMARY KEY, gmail_message_id TEXT UNIQUE,
    sender TEXT NOT NULL, sender_name TEXT, subject TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '', received_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','forwarded','needs_review','failed')),
    batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
    batch_name TEXT, recipient_count INTEGER, failure_reason TEXT,
    forwarded_at TEXT, cc_email TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`);
  d.exec(`CREATE TABLE forward_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, gmail_message_id TEXT UNIQUE NOT NULL,
    mail_id TEXT NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    recipient_count INTEGER NOT NULL, cc_email TEXT,
    provider TEXT NOT NULL DEFAULT 'gmail', status TEXT NOT NULL DEFAULT 'sent',
    error TEXT, created_at TEXT NOT NULL
  );`);
  d.exec(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  d.exec(`CREATE TABLE admins (
    email TEXT PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL
  );`);
  d.exec(`CREATE TABLE sessions (
    token TEXT PRIMARY KEY, admin_email TEXT NOT NULL REFERENCES admins(email) ON DELETE CASCADE,
    created_at TEXT NOT NULL, expires_at TEXT NOT NULL
  );`);
  d.exec(`CREATE TABLE gmail_tokens (
    id INTEGER PRIMARY KEY CHECK(id = 1), account_email TEXT,
    access_token TEXT, refresh_token TEXT, expiry_ms INTEGER, updated_at TEXT NOT NULL
  );`);
  d.exec(`CREATE TABLE gmail_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  d.exec(`CREATE TABLE mail_attachments (
    id TEXT PRIMARY KEY, mail_id TEXT NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
    filename TEXT NOT NULL, mime TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes INTEGER NOT NULL DEFAULT 0, gmail_attachment_id TEXT, data_b64 TEXT
  );`);

  const now = "2026-01-01T00:00:00.000Z";
  d.prepare("INSERT INTO batches(id,name,description,created_at,updated_at) VALUES(?,?,?,?,?)")
    .run("legacy-b1", "Legacy Batch", "pre-migration", now, now);
  d.prepare("INSERT INTO recipients(id,batch_id,name,email,created_at) VALUES(?,?,?,?,?)")
    .run("legacy-r1", "legacy-b1", "Student", "legacy-student@example.com", now);
  d.prepare(
    `INSERT INTO mails(id,gmail_message_id,sender,subject,body_text,received_at,status,batch_id,batch_name,recipient_count,cc_email,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run("legacy-m1", "legacy-gmail-1", "old@sender.test", "Legacy subject", "body", now, "forwarded", "legacy-b1", "Legacy Batch", 1, "cc@old.test", now, now);
  d.prepare(
    `INSERT INTO forward_logs(gmail_message_id,mail_id,batch_id,recipient_count,cc_email,provider,status,created_at)
     VALUES(?,?,?,?,?,?,?,?)`
  ).run("legacy-gmail-1", "legacy-m1", "legacy-b1", 1, "cc@old.test", "gmail", "sent", now);
  d.prepare("INSERT INTO settings(key,value) VALUES('ccEmail','cc@old.test')").run();
  d.prepare("INSERT INTO settings(key,value) VALUES('autoForwarding','1')").run();
  d.prepare("INSERT INTO admins(email,name,password_hash,salt) VALUES('old@admin.test','Old Admin','aa','bb')").run();
  d.prepare(
    "INSERT INTO gmail_tokens(id,account_email,access_token,refresh_token,expiry_ms,updated_at) VALUES(1,?,?,?,?,?)"
  ).run("old@mailbox.test", "plain-access", "plain-refresh", Date.now() + 3600_000, now);
  d.close();
}

beforeAll(async () => {
  buildLegacyDatabase();
  dbMod = await import("@/lib/db");
});

afterAll(() => {
  dbMod?.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("legacy -> multi-tenant migration", () => {
  it("creates a pre-migration backup file", () => {
    dbMod.getDb(); // triggers migration on first open
    const backups = readdirSync(dir).filter((f) => f.includes(".bak-v1-"));
    expect(backups.length).toBeGreaterThanOrEqual(1);
    expect(existsSync(join(dir, backups[0]!))).toBe(true);
  });

  it("preserves every legacy record and assigns it to the default workspace", () => {
    const d = dbMod.getDb();
    expect(dbMod.getOrg("org_default")).toBeTruthy();
    const batches = d.prepare("SELECT id, org_id FROM batches").all() as Array<{ id: string; org_id: string }>;
    // Legacy rows are preserved; env-configured fixture groups may be added
    // by the idempotent first-boot bootstrap — never removed.
    expect(batches).toHaveLength(3);
    expect(batches).toContainEqual({ id: "legacy-b1", org_id: "org_default" });
    for (const b of batches) expect(b.org_id).toBe("org_default");

    const recipients = d.prepare("SELECT email, org_id FROM recipients WHERE email='legacy-student@example.com'").all() as Array<{ email: string; org_id: string }>;
    expect(recipients).toHaveLength(1);
    expect(recipients[0]!.org_id).toBe("org_default");

    const mails = d.prepare("SELECT id, org_id, status FROM mails").all() as Array<Record<string, unknown>>;
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ id: "legacy-m1", org_id: "org_default", status: "forwarded" });

    const fwd = d.prepare("SELECT gmail_message_id, org_id, status FROM forward_logs").all() as Array<Record<string, unknown>>;
    expect(fwd).toHaveLength(1);
    expect(fwd[0]).toMatchObject({ gmail_message_id: "legacy-gmail-1", org_id: "org_default", status: "sent" });

    const settings = d.prepare("SELECT org_id, value FROM settings WHERE key='ccEmail'").get() as
      { org_id: string; value: string };
    expect(settings).toMatchObject({ org_id: "org_default", value: "cc@old.test" });
  });

  it("migrates the Gmail connection to the default workspace (tokens still present)", () => {
    const d = dbMod.getDb();
    const row = d.prepare("SELECT org_id, account_email FROM gmail_tokens WHERE org_id='org_default'").get() as
      { org_id: string; account_email: string } | undefined;
    expect(row?.account_email).toBe("old@mailbox.test");
  });

  it("makes legacy users administrators of the default workspace", () => {
    const orgs = dbMod.listUserOrgs("old@admin.test");
    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({ orgId: "org_default", role: "admin" });
  });

  it("enforces per-workspace uniqueness AFTER migration (same name in another org is fine)", () => {
    const d = dbMod.getDb();
    const other = dbMod.createOrganization("Second Org", "old@admin.test");
    try {
      // Same group name in a DIFFERENT workspace: allowed now.
      d.prepare(
        "INSERT INTO batches(id,org_id,name,description,created_at,updated_at) VALUES(?,?,?,?,?,?)"
      ).run("dup-name", other.id, "Legacy Batch", null, new Date().toISOString(), new Date().toISOString());
      // Same name in the SAME workspace: still rejected.
      expect(() =>
        d.prepare(
          "INSERT INTO batches(id,org_id,name,description,created_at,updated_at) VALUES(?,?,?,?,?,?)"
        ).run("dup-name-2", "org_default", "Legacy Batch", null, new Date().toISOString(), new Date().toISOString())
      ).toThrow();
      // Per-org gmail id uniqueness:
      d.prepare(
        "INSERT INTO forward_logs(org_id,gmail_message_id,mail_id,batch_id,recipient_count,cc_email,created_at) VALUES(?,?,?,?,?,?,?)"
      ).run(other.id, "legacy-gmail-1", "legacy-m1", "legacy-b1", 1, null, new Date().toISOString());
      expect(() =>
        d.prepare(
          "INSERT INTO forward_logs(org_id,gmail_message_id,mail_id,batch_id,recipient_count,cc_email,created_at) VALUES(?,?,?,?,?,?,?)"
        ).run(other.id, "legacy-gmail-1", "legacy-m1", "legacy-b1", 1, null, new Date().toISOString())
      ).toThrow();
    } finally {
      d.prepare("DELETE FROM organization_members WHERE org_id=?").run(other.id);
      d.prepare("DELETE FROM organizations WHERE id=?").run(other.id);
    }
  });

  it("is idempotent — reopening the migrated DB performs no further changes", () => {
    dbMod.closeDb();
    const again = dbMod.getDb(); // re-open: no throw, data intact
    const count = (again.prepare("SELECT COUNT(*) c FROM batches").get() as { c: number }).c;
    expect(count).toBe(3);
    const legacy = again.prepare("SELECT id FROM batches WHERE id='legacy-b1'").get();
    expect(legacy).toBeTruthy();
    const versions = again.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get() as
      { value: string } | undefined;
    expect(versions?.value).toBe("2");
  });
});
