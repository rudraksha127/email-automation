/**
 * Server-side encryption for OAuth tokens at rest (AES-256-GCM).
 *
 * Key resolution order:
 *   1. GMAIL_TOKEN_KEY env var — REQUIRED in production (64 hex chars preferred;
 *      any non-empty passphrase is stretched with scrypt, but a random 32-byte
 *      hex key is recommended: `openssl rand -hex 32`).
 *   2. Dev/test fallback: auto-generated key file under the data directory
 *      (gitignored). Production refuses the file fallback so an ephemeral disk
 *      cannot silently mint an undecryptable key after redeploy.
 *
 * Ciphertext format: `enc:v1:<iv_b64>:<tag_b64>:<ct_b64>`.
 * Legacy plaintext (no `enc:v1:` prefix) is still readable so tokens written
 * before encryption existed keep working until their next refresh.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const PREFIX = "enc:v1:";
let cachedKey: Buffer | null = null;

function deriveKey(secret: string): Buffer {
  // 64 hex chars → used directly as a 32-byte key; anything else is stretched.
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, "hex");
  return scryptSync(secret, "mail-automation-token-v1", 32);
}

function devKeyFile(): string {
  const dbPath = process.env.PILOT_DB_PATH ?? join(process.cwd(), "data", "pilot.db");
  return join(dirname(dbPath), ".token.key");
}

/**
 * Returns the encryption key, or null when none is available.
 * In production a missing GMAIL_TOKEN_KEY is a hard configuration error
 * surfaced by callers (tokens are never saved with a fallback key there).
 */
export function getTokenKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  const envKey = (process.env.GMAIL_TOKEN_KEY ?? "").trim();
  if (envKey) {
    cachedKey = deriveKey(envKey);
    return cachedKey;
  }
  if (process.env.NODE_ENV === "production") return null;
  // Dev/test: persist a generated key next to the database.
  try {
    const file = devKeyFile();
    if (existsSync(file)) {
      const raw = readFileSync(file, "utf8").trim();
      if (raw) {
        cachedKey = deriveKey(raw);
        return cachedKey;
      }
    }
    const generated = randomBytes(32).toString("hex");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, generated, { mode: 0o600 });
    cachedKey = deriveKey(generated);
    return cachedKey;
  } catch {
    return null;
  }
}

export function tokenEncryptionReady(): boolean {
  return getTokenKey() !== null;
}

/** Test helper — clear the memoized key (e.g. after changing env in a test). */
export function resetTokenKeyCache(): void {
  cachedKey = null;
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getTokenKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "GMAIL_TOKEN_KEY is not configured — refusing to store OAuth tokens unencrypted in production."
      );
    }
    return plaintext; // test/dev without key storage: keep working, never logged
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptToken(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const key = getTokenKey();
  if (!key) {
    throw new Error(
      "GMAIL_TOKEN_KEY is not configured — cannot decrypt stored OAuth tokens. Set the key to the value used when the tokens were saved."
    );
  }
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(":");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64!, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64!, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB64!, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Token decryption failed — GMAIL_TOKEN_KEY does not match the key used to encrypt stored tokens.");
  }
}

/** Stable non-reversible fingerprint for logging/identification (never the token). */
export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}
