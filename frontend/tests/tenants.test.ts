import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "tenant-test-"));
process.env.PILOT_DB_PATH = join(dir, "test.db");
process.env.PILOT_DISABLE_POLLER = "true";
// Deterministic encryption key for token tests (test-only value, 32 bytes hex).
process.env.GMAIL_TOKEN_KEY = "0".repeat(63) + "1";
process.env.GMAIL_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GMAIL_CLIENT_SECRET = "test-client-secret";

// Per-client cookie jars standing in for next/headers outside a Next scope.
const state = vi.hoisted(() => {
  const jars = new Map<string, Map<string, string>>();
  jars.set("default", new Map());
  return { jars, active: "default" };
});

vi.mock("next/headers", () => ({
  cookies: async () => {
    const jar = state.jars.get(state.active)!;
    return {
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
      set: (name: string, value: string) => {
        jar.set(name, value);
      },
      delete: (name: string) => {
        jar.delete(name);
      },
    };
  },
}));

function asClient(name: string): void {
  if (!state.jars.has(name)) state.jars.set(name, new Map());
  state.active = name;
}

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type SessionRoute = typeof import("@/app/api/auth/session/route");
type WorkspaceRoute = typeof import("@/app/api/auth/workspace/route");
type OrgRoute = typeof import("@/app/api/organizations/route");
type MembersRoute = typeof import("@/app/api/organizations/members/route");
type BatchesRoute = typeof import("@/app/api/batches/route");
type BatchRoute = typeof import("@/app/api/batches/[id]/route");
type SettingsRoute = typeof import("@/app/api/settings/route");
type MailsRoute = typeof import("@/app/api/mails/route");
type MailRoute = typeof import("@/app/api/mails/[id]/route");
type ConnectRoute = typeof import("@/app/api/gmail/connect/route");
type Db = typeof import("@/lib/db");
type Gmail = typeof import("@/lib/gmail");
type Pipeline = typeof import("@/lib/pipeline");
type RateLimit = typeof import("@/lib/rateLimit");

let register: RegisterRoute;
let session: SessionRoute;
let workspace: WorkspaceRoute;
let orgs: OrgRoute;
let members: MembersRoute;
let batches: BatchesRoute;
let batch: BatchRoute;
let settings: SettingsRoute;
let mails: MailsRoute;
let mailRoute: MailRoute;
let connect: ConnectRoute;
let db: Db;
let gmail: Gmail;
let pipeline: Pipeline;
let rateLimit: RateLimit;

const req = (path: string, method = "GET", body?: unknown): Request =>
  new Request(`http://test.local${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// Shared fixtures filled during setup.
const A = { email: "usera@fixture.test", password: "password-aaa", orgId: "", batchId: "", mailId: "" };
const B = { email: "userb@fixture.test", password: "password-bbb", orgId: "", batchId: "" };

async function registerUser(u: { email: string; password: string }): Promise<void> {
  const res = await register.POST(req("/api/auth/register", "POST", { email: u.email, password: u.password, name: "Test User" }));
  expect(res.status).toBe(201);
}

async function createAndSwitch(name: string): Promise<string> {
  const created = await orgs.POST(req("/api/organizations", "POST", { name }));
  expect(created.status).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const sw = await workspace.POST(req("/api/auth/workspace", "POST", { orgId: id }));
  expect(sw.status).toBe(200);
  return id;
}

beforeAll(async () => {
  register = await import("@/app/api/auth/register/route");
  session = await import("@/app/api/auth/session/route");
  workspace = await import("@/app/api/auth/workspace/route");
  orgs = await import("@/app/api/organizations/route");
  members = await import("@/app/api/organizations/members/route");
  batches = await import("@/app/api/batches/route");
  batch = await import("@/app/api/batches/[id]/route");
  settings = await import("@/app/api/settings/route");
  mails = await import("@/app/api/mails/route");
  mailRoute = await import("@/app/api/mails/[id]/route");
  connect = await import("@/app/api/gmail/connect/route");
  db = await import("@/lib/db");
  gmail = await import("@/lib/gmail");
  pipeline = await import("@/lib/pipeline");
  rateLimit = await import("@/lib/rateLimit");

  // Client A: workspace W1 with a group + one processed mail.
  asClient("A");
  await registerUser(A);
  A.orgId = await createAndSwitch("Org A Workspace");
  const b = await batches.POST(req("/api/batches", "POST", { name: "Group Alpha" }));
  expect(b.status).toBe(201);
  A.batchId = ((await b.json()) as { id: string }).id;
  const ingested = await pipeline.ingestMessage(A.orgId, {
    gmailMessageId: "mail-tenant-1",
    sender: "someone@fixture.test",
    subject: "no group here",
    body: "",
  });
  A.mailId = String(ingested.mail.id);

  // Client B: workspace W2 with its own group.
  asClient("B");
  await registerUser(B);
  B.orgId = await createAndSwitch("Org B Workspace");
  const b2 = await batches.POST(req("/api/batches", "POST", { name: "Group Beta" }));
  expect(b2.status).toBe(201);
  B.batchId = ((await b2.json()) as { id: string }).id;
});

afterAll(() => {
  db?.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  rateLimit.rateLimitClear();
});

describe("registration and workspace bootstrapping", () => {
  it("new users start with NO workspace until they create or join one", async () => {
    asClient("C");
    await registerUser({ email: "userc@fixture.test", password: "password-ccc" });
    const s = await session.GET();
    expect(s.status).toBe(200);
    const body = await s.json();
    expect(body.orgId).toBeNull();
    expect(body.orgs).toEqual([]);
    // No workspace => protected data endpoints refuse with 401.
    expect((await batches.GET()).status).toBe(401);
    // ...but they can create their own workspace.
    const created = await orgs.POST(req("/api/organizations", "POST", { name: "Org C" }));
    expect(created.status).toBe(201);
    const cOrg = ((await created.json()) as { id: string }).id;
    db.getDb().prepare("DELETE FROM organization_members WHERE org_id=?").run(cOrg);
    db.getDb().prepare("DELETE FROM organizations WHERE id=?").run(cOrg);
    asClient("A");
  });

  it("rejects duplicate registration and weak passwords", async () => {
    asClient("C2");
    const dup = await register.POST(req("/api/auth/register", "POST", { email: A.email, password: "password-xxx" }));
    expect(dup.status).toBe(409);
    const weak = await register.POST(req("/api/auth/register", "POST", { email: "new@fixture.test", password: "short" }));
    expect(weak.status).toBe(400);
    asClient("A");
  });
});

describe("cross-tenant isolation (Organization A vs B)", () => {
  it("A only sees its own groups", async () => {
    asClient("A");
    const list = (await (await batches.GET()).json()) as Array<{ id: string }>;
    expect(list.map((b) => b.id)).toContain(A.batchId);
    expect(list.map((b) => b.id)).not.toContain(B.batchId);
  });

  it("B only sees its own groups", async () => {
    asClient("B");
    const list = (await (await batches.GET()).json()) as Array<{ id: string }>;
    expect(list.map((b) => b.id)).toContain(B.batchId);
    expect(list.map((b) => b.id)).not.toContain(A.batchId);
  });

  it("B cannot read, modify or delete A's group (404, not 403 leakage)", async () => {
    asClient("B");
    expect((await batch.GET(req(`/api/batches/${A.batchId}`), { params: Promise.resolve({ id: A.batchId }) })).status).toBe(404);
    expect((await batch.PUT(req(`/api/batches/${A.batchId}`, "PUT", { name: "Hijacked" }), { params: Promise.resolve({ id: A.batchId }) })).status).toBe(404);
    expect((await batch.DELETE(req(`/api/batches/${A.batchId}`, "DELETE"), { params: Promise.resolve({ id: A.batchId }) })).status).toBe(404);
    // group still intact for A:
    asClient("A");
    const after = await batch.GET(req(`/api/batches/${A.batchId}`), { params: Promise.resolve({ id: A.batchId }) });
    expect(after.status).toBe(200);
    expect(((await after.json()) as { name: string }).name).toBe("Group Alpha");
  });

  it("B cannot read A's mail detail or mail list", async () => {
    asClient("B");
    expect((await mailRoute.GET(req(`/api/mails/${A.mailId}`), { params: Promise.resolve({ id: A.mailId }) })).status).toBe(404);
    const list = (await (await mails.GET(req("/api/mails"))).json()) as Array<{ id: string }>;
    expect(list.map((m) => m.id)).not.toContain(A.mailId);
    asClient("A");
    expect((await mailRoute.GET(req(`/api/mails/${A.mailId}`), { params: Promise.resolve({ id: A.mailId }) })).status).toBe(200);
  });

  it("B cannot switch into A's workspace (membership is the authorization)", async () => {
    asClient("B");
    const sw = await workspace.POST(req("/api/auth/workspace", "POST", { orgId: A.orgId }));
    expect(sw.status).toBe(403);
    // session still bound to B's workspace
    const s = await session.GET();
    expect(((await s.json()) as { orgId: string }).orgId).toBe(B.orgId);
  });

  it("settings changes in A never affect B", async () => {
    asClient("A");
    expect((await settings.PUT(req("/api/settings", "PUT", { ccEmail: "cc-a@fixture.test", organizationName: "Org A Renamed" }))).status).toBe(200);
    asClient("B");
    const s = await settings.GET();
    const body = (await s.json()) as { ccEmail: string; organizationName: string };
    expect(body.ccEmail).not.toBe("cc-a@fixture.test");
    expect(body.organizationName).toBe("Org B Workspace");
  });
});

describe("roles and membership revocation", () => {
  it("invited member can read but cannot mutate configuration", async () => {
    asClient("A");
    const invite = await members.POST(req("/api/organizations/members", "POST", { email: B.email, role: "member" }));
    expect(invite.status).toBe(201);

    asClient("B");
    expect((await workspace.POST(req("/api/auth/workspace", "POST", { orgId: A.orgId }))).status).toBe(200);
    // read OK
    expect((await batches.GET()).status).toBe(200);
    // config mutations require the admin role -> 403
    expect((await batches.POST(req("/api/batches", "POST", { name: "Sneaky" }))).status).toBe(403);
    expect((await settings.PUT(req("/api/settings", "PUT", { ccEmail: "x@fixture.test" }))).status).toBe(403);
    expect((await members.POST(req("/api/organizations/members", "POST", { email: "z@fixture.test", role: "admin" }))).status).toBe(403);
    // Gmail connect requires admin too
    expect((await connect.GET()).status).toBe(403);
  });

  it("revoking membership locks the user out immediately (stale session org)", async () => {
    asClient("A");
    const del = await members.DELETE(req(`/api/organizations/members?email=${B.email}`, "DELETE"));
    expect(del.status).toBe(200);

    asClient("B");
    // B's session still names A's workspace, but membership is gone -> 403
    const res = await batches.GET();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/not a member/i);
    // B can still switch back to their own workspace:
    expect((await workspace.POST(req("/api/auth/workspace", "POST", { orgId: B.orgId }))).status).toBe(200);
    expect((await batches.GET()).status).toBe(200);
    asClient("A");
  });

  it("cannot remove the last administrator", async () => {
    asClient("A");
    const res = await members.DELETE(req(`/api/organizations/members?email=${A.email}`, "DELETE"));
    expect(res.status).toBe(400);
  });
});

describe("Gmail OAuth state + token handling", () => {
  it("OAuth state is single-use, org-bound and rejects forgery", () => {
    const { state: st } = gmail.buildAuthUrl(A.orgId);
    expect(gmail.consumeState("forged-state-value")).toBeNull();
    expect(gmail.consumeState(st)).toBe(A.orgId);
    expect(gmail.consumeState(st)).toBeNull(); // replay rejected
  });

  it("connect flow returns only a consent-screen redirect (admin session)", async () => {
    asClient("A");
    const res = await connect.GET();
    // admin + configured client => 302 to Google's consent screen (member
    // sessions are rejected with 403 in the roles suite above).
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("accounts.google.com");
    expect(res.headers.get("location")).toContain("state=");
    // The redirect URL must never contain client secrets or tokens.
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("test-client-secret");
  });

  it("tokens are encrypted at rest, org-scoped and never in connection info", async () => {
    gmail.saveTokens(A.orgId, "connected-a@fixture.test", "access-plain-a", "refresh-plain-a", 3600);
    const raw = db.getDb().prepare("SELECT refresh_token FROM gmail_tokens WHERE org_id=?").get(A.orgId) as
      { refresh_token: string };
    expect(raw.refresh_token).toMatch(/^enc:v1:/); // encrypted, not plaintext

    const tokens = gmail.getTokens(A.orgId)!;
    expect(tokens.refresh_token).toBe("refresh-plain-a"); // decrypts correctly
    expect(gmail.getTokens(B.orgId)).toBeNull(); // B has no connection

    const info = JSON.stringify(gmail.connectionInfo(A.orgId));
    expect(info).not.toContain("refresh-plain-a");
    expect(info).not.toContain("access-plain-a");
    expect(info).not.toContain("enc:v1");
  });

  it("allowlist API validation is enforced server-side", async () => {
    asClient("A");
    const bad = await settings.PUT(req("/api/settings", "PUT", { allowedSenders: ["not-an-email"] }));
    expect(bad.status).toBe(400);
    const ok = await settings.PUT(req("/api/settings", "PUT", { allowedSenders: ["one@fixture.test", "Two@Fixture.test"] }));
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { allowedSenders: string[] };
    expect(body.allowedSenders.sort()).toEqual(["one@fixture.test", "two@fixture.test"]);
    // B is unaffected
    asClient("B");
    const s = (await settings.GET()).json() as Promise<{ allowedSenders: string[] }>;
    expect((await s).allowedSenders).not.toContain("one@fixture.test");
    asClient("A");
  });
});
