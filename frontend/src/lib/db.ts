/**
 * SQLite persistence (Node built-in node:sqlite, zero new deps).
 * File DB: ./data/pilot.db (gitignored). WAL mode, FKs on.
 *
 * Multi-tenant schema (v2):
 *   organizations -> organization_members -> [batches -> recipients],
 *   sender_rules, forwarding_rules, organization settings, connected gmail
 *   accounts (gmail_tokens), processed mails, forwarding attempts, audit_events.
 *
 * Legacy single-tenant databases are upgraded in place inside a transaction
 * with a pre-migration file backup; ALL existing rows are preserved and
 * assigned to the default workspace (org_default). Nothing is deleted.
 */
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { PILOT_BATCHES } from "./pilotConfig";

const DB_PATH = process.env.PILOT_DB_PATH ?? join(process.cwd(), "data", "pilot.db");
const DEFAULT_ORG_ID = "org_default";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");

  const legacy = tableExists(db, "batches") && !tableExists(db, "organizations");
  if (legacy) backupDatabase(db);

  db.exec("PRAGMA foreign_keys = OFF;");
  try {
    createTables(db);
    if (legacy) upgradeLegacy(db);
    createIndexes(db);
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(
      "INSERT INTO app_meta(key,value) VALUES('schema_version','2') ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    );
  } catch (e) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      /* noop */
    }
    try {
      db.exec("PRAGMA foreign_keys = ON;");
    } catch {
      /* noop */
    }
    try {
      db.close();
    } catch {
      /* noop */
    }
    db = null;
    throw e;
  }
  seed(db);
  return db;
}

export function closeDb(): void {
  try {
    db?.close();
  } catch {
    /* noop */
  }
  db = null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function tableExists(d: DatabaseSync, name: string): boolean {
  return Boolean(
    d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name)
  );
}

function hasColumn(d: DatabaseSync, table: string, column: string): boolean {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function backupDatabase(d: DatabaseSync): void {
  try {
    d.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const target = `${DB_PATH}.bak-v1-${ts}`;
    copyFileSync(DB_PATH, target);
    console.log(`[pilot] pre-migration backup written: ${target}`);
  } catch (e) {
    console.warn("[pilot] pre-migration backup failed:", e instanceof Error ? e.message : e);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

/* ------------------------------------------------------------------ */
/* Schema — table creation (idempotent, safe on legacy + fresh)        */
/* ------------------------------------------------------------------ */

function createTables(d: DatabaseSync): void {
  d.exec(`CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS organization_members (
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    admin_email TEXT NOT NULL REFERENCES admins(email) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('admin','member')),
    created_at TEXT NOT NULL,
    PRIMARY KEY(org_id, admin_email)
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, admin_email TEXT NOT NULL REFERENCES admins(email) ON DELETE CASCADE,
    org_id TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL, description TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(org_id, name)
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS recipients (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL DEFAULT '' REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(batch_id, email)
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS sender_rules (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sender_email TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    UNIQUE(org_id, sender_email)
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS forwarding_rules (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    sender_pattern TEXT,
    subject_keywords TEXT NOT NULL DEFAULT '',
    body_keywords TEXT NOT NULL DEFAULT '',
    target_batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS settings (
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL, value TEXT NOT NULL,
    PRIMARY KEY(org_id, key)
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS mails (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL DEFAULT '' REFERENCES organizations(id) ON DELETE CASCADE,
    gmail_message_id TEXT,
    sender TEXT NOT NULL, sender_name TEXT, subject TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '', received_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','forwarded','needs_review','failed')),
    batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
    batch_name TEXT, recipient_count INTEGER, failure_reason TEXT,
    forwarded_at TEXT, cc_email TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS forward_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL DEFAULT '' REFERENCES organizations(id) ON DELETE CASCADE,
    gmail_message_id TEXT NOT NULL,
    mail_id TEXT NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    recipient_count INTEGER NOT NULL, cc_email TEXT,
    provider TEXT NOT NULL DEFAULT 'gmail', status TEXT NOT NULL DEFAULT 'sent',
    error TEXT, created_at TEXT NOT NULL,
    UNIQUE(org_id, gmail_message_id)
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS gmail_tokens (
    org_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    account_email TEXT, access_token TEXT, refresh_token TEXT,
    expiry_ms INTEGER, updated_at TEXT NOT NULL
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS gmail_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);

  d.exec(`CREATE TABLE IF NOT EXISTS mail_attachments (
    id TEXT PRIMARY KEY, mail_id TEXT NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
    filename TEXT NOT NULL, mime TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes INTEGER NOT NULL DEFAULT 0, gmail_attachment_id TEXT,
    data_b64 TEXT
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT, actor TEXT,
    action TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL
  );`);

  d.exec(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
}

/* ------------------------------------------------------------------ */
/* Indexes (only after legacy upgrade added its columns)               */
/* ------------------------------------------------------------------ */

function createIndexes(d: DatabaseSync): void {
  d.exec("CREATE INDEX IF NOT EXISTS idx_members_user ON organization_members(admin_email);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_email);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_batches_org ON batches(org_id);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_recipients_batch ON recipients(batch_id);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_recipients_org ON recipients(org_id);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_sender_rules_org ON sender_rules(org_id);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_rules_org ON forwarding_rules(org_id);");
  d.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_mails_gmail ON mails(org_id, gmail_message_id);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_mails_org ON mails(org_id);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_mails_status ON mails(org_id, status);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_mails_batch ON mails(batch_id);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_mails_received ON mails(org_id, received_at DESC);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_fwd_mail ON forward_logs(mail_id);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_fwd_org ON forward_logs(org_id);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_attachments_mail ON mail_attachments(mail_id);");
  d.exec("CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events(org_id, created_at DESC);");
}

/* ------------------------------------------------------------------ */
/* Legacy upgrade (single-tenant -> multi-tenant)                      */
/* ------------------------------------------------------------------ */

function count(d: DatabaseSync, table: string): number {
  return Number((d.prepare(`SELECT COUNT(*) c FROM ${table}`).get() as { c: number }).c);
}

function assertCount(d: DatabaseSync, table: string, expected: number, label: string): void {
  const actual = count(d, table);
  if (actual !== expected) {
    throw new Error(`Migration aborted: ${label} count mismatch (${expected} -> ${actual})`);
  }
}

/**
 * In-transaction upgrade of a legacy single-tenant database.
 * Rows are COPIED into re-created tables (never dropped wholesale) and every
 * record is assigned to the default workspace. FKs are disabled around the
 * table swaps so DROP TABLE never cascades into dependent data.
 * Runs entirely inside BEGIN...COMMIT; any error rolls back.
 */
function upgradeLegacy(d: DatabaseSync): void {
  const now = nowIso();
  d.exec("BEGIN;");
  try {
    d.prepare("INSERT OR IGNORE INTO organizations(id,name,created_at,updated_at) VALUES(?,?,?,?)").run(
      DEFAULT_ORG_ID,
      (process.env.DEFAULT_ORG_NAME ?? "Main Workspace").trim() || "Main Workspace",
      now, now
    );

    if (!hasColumn(d, "admins", "created_at")) {
      d.exec("ALTER TABLE admins ADD COLUMN created_at TEXT NOT NULL DEFAULT '';");
    }

    /* batches — rebuild for UNIQUE(org_id, name) */
    const legacyBatches = count(d, "batches");
    d.exec(`CREATE TABLE batches_v2 (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL, description TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(org_id, name)
    );`);
    d.prepare(
      "INSERT INTO batches_v2(id,org_id,name,description,created_at,updated_at) SELECT id,?,name,description,created_at,updated_at FROM batches"
    ).run(DEFAULT_ORG_ID);
    d.exec("DROP TABLE batches;");
    d.exec("ALTER TABLE batches_v2 RENAME TO batches;");
    assertCount(d, "batches", legacyBatches, "batches");

    /* recipients — add org_id column */
    if (!hasColumn(d, "recipients", "org_id")) {
      d.exec("ALTER TABLE recipients ADD COLUMN org_id TEXT NOT NULL DEFAULT '';");
    }
    d.prepare("UPDATE recipients SET org_id=?").run(DEFAULT_ORG_ID);

    /* settings — org-scoped PK */
    const legacySettings = count(d, "settings");
    d.exec(`CREATE TABLE settings_v2 (
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      key TEXT NOT NULL, value TEXT NOT NULL,
      PRIMARY KEY(org_id, key)
    );`);
    d.prepare("INSERT INTO settings_v2(org_id,key,value) SELECT ?,key,value FROM settings").run(DEFAULT_ORG_ID);
    d.exec("DROP TABLE settings;");
    d.exec("ALTER TABLE settings_v2 RENAME TO settings;");
    assertCount(d, "settings", legacySettings, "settings");

    /* mails — rebuild for UNIQUE(org_id, gmail_message_id) */
    const legacyMails = count(d, "mails");
    d.exec(`CREATE TABLE mails_v2 (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      gmail_message_id TEXT,
      sender TEXT NOT NULL, sender_name TEXT, subject TEXT NOT NULL DEFAULT '',
      body_text TEXT NOT NULL DEFAULT '', received_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','forwarded','needs_review','failed')),
      batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
      batch_name TEXT, recipient_count INTEGER, failure_reason TEXT,
      forwarded_at TEXT, cc_email TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );`);
    d.prepare(
      `INSERT INTO mails_v2(id,org_id,gmail_message_id,sender,sender_name,subject,body_text,received_at,
        status,batch_id,batch_name,recipient_count,failure_reason,forwarded_at,cc_email,created_at,updated_at)
       SELECT id,?,gmail_message_id,sender,sender_name,subject,body_text,received_at,
        status,batch_id,batch_name,recipient_count,failure_reason,forwarded_at,cc_email,created_at,updated_at
       FROM mails`
    ).run(DEFAULT_ORG_ID);
    d.exec("DROP TABLE mails;");
    d.exec("ALTER TABLE mails_v2 RENAME TO mails;");
    assertCount(d, "mails", legacyMails, "mails");

    /* forward_logs — rebuild for UNIQUE(org_id, gmail_message_id) + org column */
    const legacyFwd = count(d, "forward_logs");
    d.exec(`CREATE TABLE forward_logs_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      gmail_message_id TEXT NOT NULL,
      mail_id TEXT NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
      batch_id TEXT NOT NULL REFERENCES batches(id),
      recipient_count INTEGER NOT NULL, cc_email TEXT,
      provider TEXT NOT NULL DEFAULT 'gmail', status TEXT NOT NULL DEFAULT 'sent',
      error TEXT, created_at TEXT NOT NULL,
      UNIQUE(org_id, gmail_message_id)
    );`);
    d.prepare(
      `INSERT INTO forward_logs_v2(org_id,gmail_message_id,mail_id,batch_id,recipient_count,cc_email,provider,status,error,created_at)
       SELECT ?,gmail_message_id,mail_id,batch_id,recipient_count,cc_email,provider,status,error,created_at
       FROM forward_logs`
    ).run(DEFAULT_ORG_ID);
    d.exec("DROP TABLE forward_logs;");
    d.exec("ALTER TABLE forward_logs_v2 RENAME TO forward_logs;");
    assertCount(d, "forward_logs", legacyFwd, "forward_logs");

    /* gmail_tokens — rebuild keyed by org */
    d.exec(`CREATE TABLE gmail_tokens_v2 (
      org_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      account_email TEXT, access_token TEXT, refresh_token TEXT,
      expiry_ms INTEGER, updated_at TEXT NOT NULL
    );`);
    d.prepare(
      `INSERT INTO gmail_tokens_v2(org_id,account_email,access_token,refresh_token,expiry_ms,updated_at)
       SELECT ?,account_email,access_token,refresh_token,expiry_ms,updated_at FROM gmail_tokens WHERE id=1`
    ).run(DEFAULT_ORG_ID);
    d.exec("DROP TABLE gmail_tokens;");
    d.exec("ALTER TABLE gmail_tokens_v2 RENAME TO gmail_tokens;");

    /* sessions — add org column */
    if (!hasColumn(d, "sessions", "org_id")) {
      d.exec("ALTER TABLE sessions ADD COLUMN org_id TEXT;");
    }

    /* every existing user becomes an admin of the default workspace */
    d.prepare(
      `INSERT OR IGNORE INTO organization_members(org_id,admin_email,role,created_at)
       SELECT ?,email,'admin',? FROM admins`
    ).run(DEFAULT_ORG_ID, now);

    d.exec("COMMIT;");
    console.log("[pilot] multi-tenant migration complete — existing data assigned to the default workspace");
  } catch (e) {
    d.exec("ROLLBACK;");
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

export function hashPassword(password: string, salt = randomUUID().replace(/-/g, "")): {
  hash: string; salt: string;
} {
  return { hash: scryptSync(password, salt, 64).toString("hex"), salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const attempt = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (attempt.length !== expected.length) return false;
  return timingSafeEqual(attempt, expected);
}

/* ------------------------------------------------------------------ */
/* Settings / audit                                                    */
/* ------------------------------------------------------------------ */

export function getSetting(orgId: string, key: string, fallback = ""): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE org_id=? AND key=?").get(orgId, key) as
    | { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(orgId: string, key: string, value: string): void {
  getDb().prepare(
    "INSERT INTO settings(org_id,key,value) VALUES(?,?,?) ON CONFLICT(org_id,key) DO UPDATE SET value=excluded.value"
  ).run(orgId, key, value);
}

export function audit(orgId: string | null, actor: string, action: string, detail?: string): void {
  try {
    getDb().prepare(
      "INSERT INTO audit_events(org_id,actor,action,detail,created_at) VALUES(?,?,?,?,?)"
    ).run(orgId, actor, action, (detail ?? "").slice(0, 300), nowIso());
  } catch {
    /* auditing must never break the main flow */
  }
}

/* ------------------------------------------------------------------ */
/* Seed (idempotent, org-scoped)                                       */
/* ------------------------------------------------------------------ */

function seed(d: DatabaseSync): void {
  const now = nowIso();

  // Default workspace always exists (fresh installs + upgrades).
  d.prepare(
    "INSERT OR IGNORE INTO organizations(id,name,created_at,updated_at) VALUES(?,?,?,?)"
  ).run(
    DEFAULT_ORG_ID,
    (process.env.DEFAULT_ORG_NAME ?? "Main Workspace").trim() || "Main Workspace",
    now, now
  );

  // Optional first-boot bootstrap of the default workspace from env
  // (values live in .env.local / host env config — never in code).
  for (const b of PILOT_BATCHES) {
    d.prepare(
      `INSERT INTO batches(id,org_id,name,description,created_at,updated_at) VALUES(?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, updated_at=excluded.updated_at`
    ).run(b.id, DEFAULT_ORG_ID, b.name, b.description, now, now);
    for (const r of b.recipients) {
      const id = `${b.id}-${r.email.toLowerCase()}`;
      d.prepare(
        `INSERT INTO recipients(id,batch_id,org_id,name,email,created_at) VALUES(?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email`
      ).run(id, b.id, DEFAULT_ORG_ID, r.name, r.email.trim(), now);
    }
  }

  // NOTE: no automatic record deletion anywhere — all historic demo-data
  // cleanup happened in earlier releases; per current rules existing records
  // are never removed without an explicit, reviewed migration.

  // Sender allowlist bootstrap (only when the org has none yet).
  const allowRaw = (process.env.PILOT_ALLOWED_SENDERS || "luckyudiya@gmail.com,rudrakshaudiya96@gmail.com").trim();
  if (allowRaw) {
    const hasRules = d.prepare("SELECT 1 FROM sender_rules WHERE org_id=? LIMIT 1").get(DEFAULT_ORG_ID);
    if (!hasRules) {
      const ins = d.prepare(
        "INSERT OR IGNORE INTO sender_rules(id,org_id,sender_email,active,created_at) VALUES(?,?,?,1,?)"
      );
      for (const s of allowRaw.split(",")) {
        const email = s.trim().toLowerCase();
        if (email) ins.run(uid("sr"), DEFAULT_ORG_ID, email, now);
      }
    }
  }

  // CC defaults: fallback to institutional middleware address
  const ccEnv = (process.env.PILOT_CC_EMAIL || "rudraksha240036@acropolis.in").trim();
  if (!getSetting(DEFAULT_ORG_ID, "ccEmail") && ccEnv) setSetting(DEFAULT_ORG_ID, "ccEmail", ccEnv);
  if (!getSetting(DEFAULT_ORG_ID, "autoForwarding")) setSetting(DEFAULT_ORG_ID, "autoForwarding", "1");
  if (!getSetting(DEFAULT_ORG_ID, "gmailConnected")) setSetting(DEFAULT_ORG_ID, "gmailConnected", "0");

  // Default Forwarding Rules bootstrap
  const hasForwardingRules = d.prepare("SELECT 1 FROM forwarding_rules WHERE org_id=? LIMIT 1").get(DEFAULT_ORG_ID);
  if (!hasForwardingRules) {
    const insRule = d.prepare(
      `INSERT INTO forwarding_rules(id,org_id,name,priority,active,subject_keywords,body_keywords,target_batch_id,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?)`
    );
    insRule.run(uid("fr"), DEFAULT_ORG_ID, "Batch 2027 Routing Rule", 10, 1, "2027,batch 2027,3rd year", "2027,batch 2027,3rd year", "b2027", now, now);
    insRule.run(uid("fr"), DEFAULT_ORG_ID, "Batch 2028 Routing Rule", 10, 1, "2028,batch 2028,2nd year", "2028,batch 2028,2nd year", "b2028", now, now);
  }

  // Admin account: credentials from env; production fails fast if missing.
  const envEmail = (process.env.PILOT_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const envPass = process.env.PILOT_ADMIN_PASSWORD ?? "";
  const adminEmail = envEmail || "admin@example.test";
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  const existing = d.prepare("SELECT email FROM admins WHERE email=?").get(adminEmail) as
    | { email: string } | undefined;
  if (!existing) {
    if (process.env.NODE_ENV === "production" && !isBuild && (!envEmail || !envPass)) {
      throw new Error(
        "PILOT_ADMIN_EMAIL and PILOT_ADMIN_PASSWORD must be set in production (see .env.example)."
      );
    }
    let password = envPass;
    if (!password) {
      password = randomBytes(12).toString("base64url");
      console.warn(
        `[pilot] PILOT_ADMIN_PASSWORD not set — seeded dev admin '${adminEmail}' with a generated password. ` +
          `Set PILOT_ADMIN_EMAIL/PASSWORD in .env.local (see .env.example).`
      );
    }
    const { hash, salt } = hashPassword(password);
    d.prepare("INSERT INTO admins(email,name,password_hash,salt,created_at) VALUES(?,?,?,?,?)").run(
      adminEmail, "Department Admin", hash, salt, now
    );
  }
  // Guarantee every user belongs to at least the default workspace.
  d.prepare(
    "INSERT OR IGNORE INTO organization_members(org_id,admin_email,role,created_at) VALUES(?,?,?,?)"
  ).run(DEFAULT_ORG_ID, adminEmail, "admin", now);
}

/* ------------------------------------------------------------------ */
/* Organizations / membership                                          */
/* ------------------------------------------------------------------ */

export interface OrgRow {
  id: string; name: string; created_at: string; updated_at: string;
}
export interface Membership {
  orgId: string; name: string; role: "admin" | "member";
}

export function getOrg(orgId: string): OrgRow | undefined {
  return getDb().prepare("SELECT * FROM organizations WHERE id=?").get(orgId) as OrgRow | undefined;
}

export function listUserOrgs(email: string): Membership[] {
  const rows = getDb().prepare(
    `SELECT o.id, o.name, m.role FROM organization_members m
     JOIN organizations o ON o.id = m.org_id
     WHERE m.admin_email=? ORDER BY o.created_at ASC`
  ).all(email.toLowerCase()) as Array<{ id: string; name: string; role: "admin" | "member" }>;
  return rows.map((r) => ({ orgId: r.id, name: r.name, role: r.role }));
}

export function membershipOf(orgId: string, email: string): { role: "admin" | "member" } | undefined {
  return getDb().prepare(
    "SELECT role FROM organization_members WHERE org_id=? AND admin_email=?"
  ).get(orgId, email.toLowerCase()) as { role: "admin" | "member" } | undefined;
}

export function createOrganization(name: string, ownerEmail: string): OrgRow {
  const d = getDb();
  const id = uid("org");
  const now = nowIso();
  d.prepare("INSERT INTO organizations(id,name,created_at,updated_at) VALUES(?,?,?,?)").run(
    id, name, now, now
  );
  d.prepare(
    "INSERT INTO organization_members(org_id,admin_email,role,created_at) VALUES(?,?,?,?)"
  ).run(id, ownerEmail.toLowerCase(), "admin", now);
  return getOrg(id)!;
}

export function addMember(orgId: string, email: string, role: "admin" | "member"): void {
  getDb().prepare(
    "INSERT INTO organization_members(org_id,admin_email,role,created_at) VALUES(?,?,?,?)"
  ).run(orgId, email.toLowerCase(), role, nowIso());
}

export function removeMember(orgId: string, email: string): void {
  getDb().prepare(
    "DELETE FROM organization_members WHERE org_id=? AND admin_email=?"
  ).run(orgId, email.toLowerCase());
}

export function adminCount(orgId: string): number {
  const row = getDb().prepare(
    "SELECT COUNT(*) c FROM organization_members WHERE org_id=? AND role='admin'"
  ).get(orgId) as { c: number };
  return Number(row.c);
}

/** Orgs with an active Gmail connection (used by the background poller). */
export function listConnectedOrgs(): string[] {
  const rows = getDb().prepare(
    "SELECT org_id FROM gmail_tokens WHERE refresh_token IS NOT NULL"
  ).all() as Array<{ org_id: string }>;
  return rows.map((r) => r.org_id);
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export interface BatchWithCount {
  id: string; name: string; description: string | null;
  recipientCount: number; createdAt: string; updatedAt: string;
}

export function listBatchesWithCounts(orgId: string): BatchWithCount[] {
  const rows = getDb().prepare(
    `SELECT b.id,b.name,b.description,b.created_at,b.updated_at,COUNT(r.id) AS rc
     FROM batches b LEFT JOIN recipients r ON r.batch_id=b.id
     WHERE b.org_id=? GROUP BY b.id ORDER BY b.name ASC`
  ).all(orgId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id), name: String(r.name),
    description: (r.description as string | null) ?? null,
    recipientCount: Number(r.rc ?? 0),
    createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  }));
}

export { DEFAULT_ORG_ID };
