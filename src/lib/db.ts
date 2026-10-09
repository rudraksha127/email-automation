/**
 * SQLite persistence (Node built-in node:sqlite, zero new deps).
 * File DB: ./data/pilot.db (gitignored). UNIQUE gmail ids, FKs, indexes.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { PILOT_BATCHES } from "./pilotConfig";

const DB_PATH = process.env.PILOT_DB_PATH ?? join(process.cwd(), "data", "pilot.db");

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
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

function migrate(d: DatabaseSync): void {
  d.exec(`CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`);
  d.exec(`CREATE TABLE IF NOT EXISTS recipients (
    id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    name TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(batch_id, email)
  );`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_recipients_batch ON recipients(batch_id);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);`);
  d.exec(`CREATE TABLE IF NOT EXISTS mails (
    id TEXT PRIMARY KEY, gmail_message_id TEXT UNIQUE,
    sender TEXT NOT NULL, sender_name TEXT, subject TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '', received_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','forwarded','needs_review','failed')),
    batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
    batch_name TEXT, recipient_count INTEGER, failure_reason TEXT,
    forwarded_at TEXT, cc_email TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`);
  d.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mails_gmail ON mails(gmail_message_id);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_mails_status ON mails(status);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_mails_batch ON mails(batch_id);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_mails_received ON mails(received_at DESC);`);
  d.exec(`CREATE TABLE IF NOT EXISTS forward_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, gmail_message_id TEXT UNIQUE NOT NULL,
    mail_id TEXT NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    recipient_count INTEGER NOT NULL, cc_email TEXT,
    provider TEXT NOT NULL DEFAULT 'gmail', status TEXT NOT NULL DEFAULT 'sent',
    error TEXT, created_at TEXT NOT NULL
  );`);
  d.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_fwd_gmail ON forward_logs(gmail_message_id);`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_fwd_mail ON forward_logs(mail_id);`);
  d.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  d.exec(`CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL
  );`);
  d.exec(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, admin_email TEXT NOT NULL REFERENCES admins(email) ON DELETE CASCADE,
    created_at TEXT NOT NULL, expires_at TEXT NOT NULL
  );`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_email);`);
  d.exec(`CREATE TABLE IF NOT EXISTS gmail_tokens (
    id INTEGER PRIMARY KEY CHECK(id = 1), account_email TEXT,
    access_token TEXT, refresh_token TEXT, expiry_ms INTEGER, updated_at TEXT NOT NULL
  );`);
  d.exec(`CREATE TABLE IF NOT EXISTS gmail_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  d.exec(`CREATE TABLE IF NOT EXISTS mail_attachments (
    id TEXT PRIMARY KEY, mail_id TEXT NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
    filename TEXT NOT NULL, mime TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes INTEGER NOT NULL DEFAULT 0, gmail_attachment_id TEXT,
    data_b64 TEXT
  );`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_attachments_mail ON mail_attachments(mail_id);`);
}

function getSetting(d: DatabaseSync, key: string, fallback = ""): string {
  const row = d.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string } | undefined;
  return row?.value ?? fallback;
}

function setSetting(d: DatabaseSync, key: string, value: string): void {
  d.prepare(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, value);
}

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

function seed(d: DatabaseSync): void {
  const now = new Date().toISOString();
  for (const b of PILOT_BATCHES) {
    d.prepare(
      "INSERT INTO batches(id,name,description,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, updated_at=excluded.updated_at"
    ).run(b.id, b.name, b.description, now, now);
    for (const r of b.recipients) {
      const id = `${b.id}-${r.email.toLowerCase()}`;
      d.prepare(
        "INSERT INTO recipients(id,batch_id,name,email,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email"
      ).run(id, b.id, r.name, r.email.trim(), now);
    }
  }

  // One-time legacy cleanup (old demo/mock fixtures). Runs at most once per
  // database, guarded by a settings flag — admin-created batches/recipients
  // and real mail records are NEVER deleted on subsequent restarts.
  if (getSetting(d, "seedCleanupDone") !== "1") {
    d.prepare("DELETE FROM batches WHERE id NOT IN ('b2027','b2028')").run();
    const approved27 = PILOT_BATCHES.find((b) => b.id === "b2027")!.recipients.map((r) => r.email.toLowerCase());
    const approved28 = PILOT_BATCHES.find((b) => b.id === "b2028")!.recipients.map((r) => r.email.toLowerCase());
    // Only reconcile recipients against a NON-EMPTY approved list — an
    // unconfigured environment must never be treated as "delete everything".
    if (approved27.length > 0) {
      d.prepare(
        `DELETE FROM recipients WHERE batch_id='b2027' AND lower(email) NOT IN (${approved27.map(() => "?").join(",")})`
      ).run(...approved27);
    }
    if (approved28.length > 0) {
      d.prepare(
        `DELETE FROM recipients WHERE batch_id='b2028' AND lower(email) NOT IN (${approved28.map(() => "?").join(",")})`
      ).run(...approved28);
    }
    d.prepare(
      "DELETE FROM mails WHERE sender LIKE '%@company.com' OR sender LIKE '%@partner.com' OR sender LIKE '%@techsolutions.in' OR sender LIKE 'demo%' OR id LIKE 'm1%' OR id LIKE 'm2%' OR id LIKE 'm3%' OR id LIKE 'm4%' OR id LIKE 'm5%' OR id LIKE 'm6%' OR id LIKE 'm7%'"
    ).run();
    setSetting(d, "seedCleanupDone", "1");
  }

  // CC defaults from environment; when unset it stays empty and forwarding
  // is disabled until configured in Settings (fail-closed).
  const ccEnv = (process.env.PILOT_CC_EMAIL ?? "").trim();
  if (!getSetting(d, "ccEmail") && ccEnv) setSetting(d, "ccEmail", ccEnv);
  if (!getSetting(d, "autoForwarding")) setSetting(d, "autoForwarding", "1");
  if (!getSetting(d, "gmailConnected")) setSetting(d, "gmailConnected", "0");
  // Admin seed: credentials come from env. Production refuses to boot with
  // missing/weak defaults; dev generates a random password and prints it once.
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
    d.prepare("INSERT INTO admins(email,name,password_hash,salt) VALUES(?,?,?,?)").run(
      adminEmail, "Department Admin", hash, salt
    );
  }
}

export interface BatchWithCount {
  id: string; name: string; description: string | null;
  recipientCount: number; createdAt: string; updatedAt: string;
}

export function listBatchesWithCounts(): BatchWithCount[] {
  const d = getDb();
  const rows = d.prepare(
    "SELECT b.id,b.name,b.description,b.created_at,b.updated_at,COUNT(r.id) AS rc FROM batches b LEFT JOIN recipients r ON r.batch_id=b.id GROUP BY b.id ORDER BY b.name ASC"
  ).all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id), name: String(r.name),
    description: (r.description as string | null) ?? null,
    recipientCount: Number(r.rc ?? 0),
    createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  }));
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

