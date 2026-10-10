import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Key must be set BEFORE the module loads (memoized on first use).
process.env.GMAIL_TOKEN_KEY = "ab".repeat(32); // 64 hex chars = 32 bytes

type Crypto = typeof import("@/lib/crypto");

let crypto: Crypto;

beforeAll(async () => {
  crypto = await import("@/lib/crypto");
});

afterAll(() => {
  crypto.resetTokenKeyCache();
});

describe("token encryption at rest", () => {
  it("produces the versioned ciphertext format and round-trips", () => {
    const secret = "1//0refresh-token-value";
    const stored = crypto.encryptToken(secret);
    expect(stored).toMatch(/^enc:v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(stored).not.toContain(secret);
    expect(crypto.decryptToken(stored)).toBe(secret);
  });

  it("is non-deterministic (fresh IV per encryption)", () => {
    const a = crypto.encryptToken("same-value");
    const b = crypto.encryptToken("same-value");
    expect(a).not.toBe(b);
    expect(crypto.decryptToken(a)).toBe(crypto.decryptToken(b));
  });

  it("still reads legacy plaintext tokens (pre-encryption rows)", () => {
    expect(crypto.decryptToken("legacy-plaintext-token")).toBe("legacy-plaintext-token");
  });

  it("rejects ciphertext decrypted with a different key", () => {
    const stored = crypto.encryptToken("secret");
    // Simulate key mismatch by corrupting the ciphertext payload.
    const parts = stored.split(":");
    parts[4] = Buffer.from("tampered-data").toString("base64");
    expect(() => crypto.decryptToken(parts.join(":"))).toThrow(/decryption failed/i);
  });

  it("fingerprints never reveal the token", () => {
    const fp = crypto.tokenFingerprint("super-secret-token");
    expect(fp).toHaveLength(12);
    expect(fp).not.toContain("super");
  });
});
