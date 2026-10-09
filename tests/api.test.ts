import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Throw-away DB + poller off BEFORE any app module loads.
const dir = mkdtempSync(join(tmpdir(), "api-test-"));
process.env.PILOT_DB_PATH = join(dir, "test.db");
process.env.PILOT_DISABLE_POLLER = "true";

// In-memory cookie jar standing in for next/headers outside a Next request scope.
const jar = vi.hoisted(() => ({ cookies: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.cookies.has(name) ? { name, value: jar.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => {
      jar.cookies.set(name, value);
    },
    delete: (name: string) => {
      jar.cookies.delete(name);
    },
  }),
}));

// `connection()` needs a Next request store; stub it for direct route calls.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, connection: async () => undefined };
});

type LoginRoute = typeof import("@/app/api/auth/login/route");
type SessionRoute = typeof import("@/app/api/auth/session/route");
type LogoutRoute = typeof import("@/app/api/auth/logout/route");
type ChangePwRoute = typeof import("@/app/api/auth/change-password/route");
type BatchesRoute = typeof import("@/app/api/batches/route");
type BatchRoute = typeof import("@/app/api/batches/[id]/route");
type RecipientsRoute = typeof import("@/app/api/batches/[id]/recipients/route");
type RecipientRoute = typeof import("@/app/api/batches/[id]/recipients/[rid]/route");
type SettingsRoute = typeof import("@/app/api/settings/route");
type MailsRoute = typeof import("@/app/api/mails/route");
type HealthRoute = typeof import("@/app/api/health/route");
type RateLimit = typeof import("@/lib/rateLimit");
type Db = typeof import("@/lib/db");

let login: LoginRoute;
let session: SessionRoute;
let logout: LogoutRoute;
let changePw: ChangePwRoute;
let batches: BatchesRoute;
let batch: BatchRoute;
let recipients: RecipientsRoute;
let recipient: RecipientRoute;
let settings: SettingsRoute;
let mails: MailsRoute;
let health: HealthRoute;
let rateLimit: RateLimit;
let dbMod: Db;

const ADMIN_EMAIL = "admin@fixture.test";
const ADMIN_PASSWORD = "fixture-password-123";

beforeAll(async () => {
  login = await import("@/app/api/auth/login/route");
  session = await import("@/app/api/auth/session/route");
  logout = await import("@/app/api/auth/logout/route");
  changePw = await import("@/app/api/auth/change-password/route");
  batches = await import("@/app/api/batches/route");
  batch = await import("@/app/api/batches/[id]/route");
  recipients = await import("@/app/api/batches/[id]/recipients/route");
  recipient = await import("@/app/api/batches/[id]/recipients/[rid]/route");
  settings = await import("@/app/api/settings/route");
  mails = await import("@/app/api/mails/route");
  health = await import("@/app/api/health/route");
  rateLimit = await import("@/lib/rateLimit");
  dbMod = await import("@/lib/db");
});

afterAll(() => {
  dbMod?.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  jar.cookies.clear();
  rateLimit.rateLimitClear();
});

const req = (path: string, body?: unknown): Request =>
  new Request(`http://test.local${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function loginAs(): Promise<void> {
  const res = await login.POST(req("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }));
  expect(res.status).toBe(200);
  expect(jar.cookies.size).toBeGreaterThan(0);
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */
describe("GET /api/health", () => {
  it("reports ok with no sensitive values", async () => {
    const res = await health.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.database).toBe("ok");
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/password|secret|token/i);
  });
});

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */
describe("authentication", () => {
  it("rejects missing credentials", async () => {
    const res = await login.POST(req("/api/auth/login", {}));
    expect(res.status).toBe(400);
  });

  it("rejects wrong password", async () => {
    const res = await login.POST(
      req("/api/auth/login", { email: ADMIN_EMAIL, password: "nope" })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid email or password/);
  });

  it("returns 429 with Retry-After after repeated failures (brute-force protection)", async () => {
    let last: Response | null = null;
    for (let i = 0; i < 9; i++) {
      last = await login.POST(
        req("/api/auth/login", { email: "victim@fixture.test", password: "wrong" })
      );
      if (last.status === 429) break;
    }
    expect(last).not.toBeNull();
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
    const body = await last!.json();
    expect(body.error).toMatch(/Too many login attempts/);
  });

  it("session requires a cookie and reflects the logged-in admin", async () => {
    expect((await session.GET()).status).toBe(401); // no cookie
    await loginAs();
    const res = await session.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(ADMIN_EMAIL);
  });

  it("logout destroys the session", async () => {
    await loginAs();
    expect((await session.GET()).status).toBe(200);
    expect((await logout.POST()).status).toBe(200);
    expect((await session.GET()).status).toBe(401);
  });

  it("change-password validates the current password and enforces a minimum length", async () => {
    await loginAs();
    const wrong = await changePw.POST(
      req("/api/auth/change-password", { currentPassword: "wrong", newPassword: "long-enough-1" })
    );
    expect(wrong.status).toBe(400);
    const tooShort = await changePw.POST(
      req("/api/auth/change-password", { currentPassword: ADMIN_PASSWORD, newPassword: "short" })
    );
    expect(tooShort.status).toBe(400);
    // Round-trip: change it, verify, change it back.
    const ok = await changePw.POST(
      req("/api/auth/change-password", { currentPassword: ADMIN_PASSWORD, newPassword: "rotated-pass-456" })
    );
    expect(ok.status).toBe(200);
    const back = await changePw.POST(
      req("/api/auth/change-password", { currentPassword: "rotated-pass-456", newPassword: ADMIN_PASSWORD })
    );
    expect(back.status).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/* Authorization on protected routes                                   */
/* ------------------------------------------------------------------ */
describe("route authorization", () => {
  it("protected routes return 401 without a session", async () => {
    expect((await batches.GET()).status).toBe(401);
    expect((await settings.GET()).status).toBe(401);
    expect(
      (await mails.GET(req("/api/mails?status=all"))).status
    ).toBe(401);
  });

  it("unknown session token is rejected (no forged cookies)", async () => {
    jar.cookies.set("ma_session", "forged-token-value");
    expect((await session.GET()).status).toBe(401);
  });
});

/* ------------------------------------------------------------------ */
/* Batch + recipient CRUD                                              */
/* ------------------------------------------------------------------ */
describe("batch CRUD", () => {
  it("lists seeded pilot batches", async () => {
    await loginAs();
    const res = await batches.GET();
    expect(res.status).toBe(200);
    const list = await res.json();
    const ids = list.map((b: { id: string }) => b.id);
    expect(ids).toContain("b2027");
    expect(ids).toContain("b2028");
  });

  it("creates, renames and deletes a batch; validates input", async () => {
    await loginAs();
    // invalid input
    expect((await batches.POST(req("/api/batches", { name: "  " }))).status).toBe(400);
    // create
    const created = await batches.POST(req("/api/batches", { name: "Batch API-Test" }));
    expect(created.status).toBe(201);
    const b = await created.json();
    // duplicate name (case-insensitive)
    const dupe = await batches.POST(req("/api/batches", { name: "batch api-test" }));
    expect(dupe.status).toBe(400);
    // rename
    const renamed = await batch.PUT(req(`/api/batches/${b.id}`, { name: "Batch API-Test 2" }), {
      params: Promise.resolve({ id: b.id }),
    });
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).name).toBe("Batch API-Test 2");
    // recipient CRUD on it
    const added = await recipients.POST(
      req(`/api/batches/${b.id}/recipients`, { name: "R", email: "r@x.com" }),
      { params: Promise.resolve({ id: b.id }) }
    );
    expect(added.status).toBe(201);
    const badEmail = await recipients.POST(
      req(`/api/batches/${b.id}/recipients`, { name: "R2", email: "not-an-email" }),
      { params: Promise.resolve({ id: b.id }) }
    );
    expect(badEmail.status).toBe(400);
    const listed = await recipients.GET(req(`/api/batches/${b.id}/recipients`), {
      params: Promise.resolve({ id: b.id }),
    });
    expect(listed.status).toBe(200);
    expect(await listed.json()).toHaveLength(1);
    // delete blocked while it still has recipients
    const blocked = await batch.DELETE(req(`/api/batches/${b.id}`), {
      params: Promise.resolve({ id: b.id }),
    });
    expect(blocked.status).toBe(400);
    // remove recipient, then delete
    const rlist = await (await recipients.GET(req(`/api/batches/${b.id}/recipients`), {
      params: Promise.resolve({ id: b.id }),
    })).json();
    const removed = await recipient.DELETE(req(`/api/batches/${b.id}/recipients/${rlist[0].id}`), {
      params: Promise.resolve({ id: b.id, rid: rlist[0].id }),
    });
    expect(removed.status).toBe(200);
    const deleted = await batch.DELETE(req(`/api/batches/${b.id}`), {
      params: Promise.resolve({ id: b.id }),
    });
    expect(deleted.status).toBe(200);
    // 404 after deletion
    expect(
      (await batch.GET(req(`/api/batches/${b.id}`), { params: Promise.resolve({ id: b.id }) })).status
    ).toBe(404);
  });
});

/* ------------------------------------------------------------------ */
/* Settings + mails                                                    */
/* ------------------------------------------------------------------ */
describe("settings + mails", () => {
  it("validates CC email and round-trips settings", async () => {
    await loginAs();
    const before = await (await settings.GET()).json();
    const bad = await settings.PUT(req("/api/settings", { ccEmail: "not-an-email" }));
    expect(bad.status).toBe(400);
    const ok = await settings.PUT(req("/api/settings", { ccEmail: "cc2@fixture.test" }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).ccEmail).toBe("cc2@fixture.test");
    // restore
    await settings.PUT(req("/api/settings", { ccEmail: before.ccEmail || "cc@fixture.test" }));
  });

  it("rejects invalid mail status filters and returns a list otherwise", async () => {
    await loginAs();
    expect((await mails.GET(req("/api/mails?status=bogus"))).status).toBe(400);
    const res = await mails.GET(req("/api/mails?status=all"));
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Rate limiter unit behaviour                                         */
/* ------------------------------------------------------------------ */
describe("rateLimit helper", () => {
  it("allows up to the limit then blocks until reset", () => {
    rateLimit.rateLimitClear();
    for (let i = 0; i < 5; i++) expect(rateLimit.rateLimit("k", 5, 60_000).ok).toBe(true);
    expect(rateLimit.rateLimit("k", 5, 60_000).ok).toBe(false);
    rateLimit.rateLimitReset("k");
    expect(rateLimit.rateLimit("k", 5, 60_000).ok).toBe(true);
  });
});
