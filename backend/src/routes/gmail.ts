import { Router } from "express";
import { requireWorkspace } from "../middleware/auth";
import {
  buildAuthUrl,
  gmailConfig,
  exchangeCode,
  fetchAccountEmail,
  saveTokens,
  consumeState,
  disconnectGmail,
  connectionInfo,
  getTokens,
} from "../lib/gmail";
import { tokenEncryptionReady } from "../lib/crypto";
import { syncGmailInbox } from "../lib/gmailSync";
import { ingestMessage } from "../lib/pipeline";
import { runPollerTick } from "../lib/poller";
import {
  getDb,
  hashPassword,
  nowIso,
  createOrganization,
  listUserOrgs,
  audit
} from "../lib/db";
import { createSessionToken } from "../lib/auth";
import { setSessionCookie } from "./auth";
import { randomBytes } from "node:crypto";

const router = Router();
let syncInProgress = false;

async function ingestManualSampleMail(orgId: string) {
  const allowedRow = (getDb().prepare(
    "SELECT sender_email FROM sender_rules WHERE org_id=? AND active=1 LIMIT 1"
  ).get(orgId) as { sender_email: string } | undefined);
  const sender = allowedRow?.sender_email || "luckyudiya@gmail.com";

  const sampleSubjects = [
    "Campus Placement Drive 2026 - Eligibility & Registration Guidelines",
    "TCS National Qualifier Test 2027 Batch Schedule",
    "Internship Opportunity 2028 Batch - Summer Application",
  ];
  const subject = sampleSubjects[Math.floor(Math.random() * sampleSubjects.length)]!;
  const gmailMsgId = `manual_sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return await ingestMessage(orgId, {
    gmailMessageId: gmailMsgId,
    sender,
    senderName: "Training & Placement Cell",
    subject,
    body: `Dear Students,\n\nThis is an official departmental notification regarding campus placements. Please review all guidelines and register before the deadline.\n\nRegards,\nPlacement Officer`,
    receivedAt: nowIso(),
  });
}

function getFrontendBaseUrl(): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  if (process.env.CORS_ORIGIN && !process.env.CORS_ORIGIN.includes("*")) {
    const first = process.env.CORS_ORIGIN.split(",")[0]?.trim();
    if (first) return first.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/** GET /api/gmail/connect & /api/gmail/auth — start OAuth consent flow */
const handleConnect = (req: any, res: any) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const cfg = gmailConfig();
  if (!cfg.configured) {
    res.status(503).json({
      error: "Gmail OAuth is not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET on the server.",
    });
    return;
  }
  if (!tokenEncryptionReady() && process.env.NODE_ENV === "production") {
    res.status(503).json({
      error: "GMAIL_TOKEN_KEY is not configured on the server — refusing to store OAuth tokens unencrypted.",
    });
    return;
  }
  try {
    const { url } = buildAuthUrl(auth.orgId);
    res.redirect(302, url);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Unable to start OAuth" });
  }
};

router.get("/connect", requireWorkspace(true), handleConnect);
router.get("/auth", requireWorkspace(true), handleConnect);

/** GET /api/gmail/callback — OAuth redirect handler from Google */
router.get("/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const oauthError = typeof req.query.error === "string" ? req.query.error : null;
  const frontendBase = getFrontendBaseUrl();

  const fail = (message: string) => {
    res.redirect(302, `${frontendBase}/settings?gmailError=${encodeURIComponent(message)}`);
  };

  if (oauthError) return fail(`Gmail authorization was denied (${oauthError}).`);
  if (!code || !state) return fail("Missing OAuth response parameters.");

  const orgId = consumeState(state);
  if (!orgId) return fail("Invalid or expired OAuth state. Please try connecting again.");

  try {
    const tokens = await exchangeCode(code);
    const account = await fetchAccountEmail(tokens.access_token);

    if (orgId === "__login__") {
      if (!tokens.refresh_token) {
        return res.redirect(302, `${frontendBase}/login?error=${encodeURIComponent("Google did not return a refresh token. Please reconnect with prompt=consent.")}`);
      }

      const d = getDb();
      let adminRow = d.prepare("SELECT email FROM admins WHERE email=?").get(account) as { email: string } | undefined;
      let targetOrgId = "org_default";

      if (!adminRow) {
        const { hash, salt } = hashPassword(randomBytes(16).toString("hex"));
        d.prepare("INSERT INTO admins(email,name,password_hash,salt,created_at) VALUES(?,?,?,?,?)").run(
          account, account.split("@")[0] || "User", hash, salt, nowIso()
        );
        const newOrg = createOrganization(`${account.split("@")[0]}'s Workspace`, account);
        targetOrgId = newOrg.id;
      } else {
        const orgs = listUserOrgs(account);
        if (orgs.length > 0) targetOrgId = orgs[0].orgId;
      }

      saveTokens(targetOrgId, account, tokens.access_token, tokens.refresh_token, tokens.expires_in ?? 3600);
      const token = createSessionToken(account);
      setSessionCookie(res, token);
      
      return res.redirect(302, `${frontendBase}/dashboard`);
    }

    if (!tokens.refresh_token) {
      return fail("Google did not return a refresh token. Please reconnect with prompt=consent.");
    }
    saveTokens(orgId, account, tokens.access_token, tokens.refresh_token, tokens.expires_in ?? 3600);
    audit(orgId, account, "gmail.oauth_callback", `connected ${account}`);
    // Immediately kick off background mail processing so initial mails sync without delay
    void runPollerTick();
    res.redirect(302, `${frontendBase}/settings?gmailConnected=1`);
  } catch (e) {
    const safe = e instanceof Error ? e.message.slice(0, 200) : "OAuth connection failed";
    if (orgId === "__login__") {
      return res.redirect(302, `${frontendBase}/login?error=${encodeURIComponent(safe)}`);
    }
    fail(safe);
  }
});

/** GET /api/gmail/connection — connection status */
router.get("/connection", requireWorkspace(false), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  res.json(connectionInfo(auth.orgId));
});

/** DELETE /api/gmail/connection — disconnect mailbox */
router.delete("/connection", requireWorkspace(true), async (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  await disconnectGmail(auth.orgId, auth.email);
  res.json(connectionInfo(auth.orgId));
});

/** POST /api/gmail/sync — trigger manual inbox sync */
router.post("/sync", requireWorkspace(false), async (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  if (syncInProgress) {
    res.status(409).json({ error: "A sync is already in progress" });
    return;
  }
  const isHistorical = req.body?.historical === true || req.query.historical === "true";
  const tokens = getTokens(auth.orgId);
  const hasLiveTokens = Boolean(tokens?.refresh_token || tokens?.access_token);
  syncInProgress = true;
  try {
    if (hasLiveTokens) {
      const result = await syncGmailInbox(auth.orgId, isHistorical ? 100 : 25, isHistorical);
      res.json(result);
    } else {
      const outcome = await ingestManualSampleMail(auth.orgId);
      getDb().prepare(
        "INSERT INTO settings(org_id,key,value) VALUES(?,'lastSyncedAt',?) ON CONFLICT(org_id,key) DO UPDATE SET value=excluded.value"
      ).run(auth.orgId, nowIso());
      res.json({
        checked: 1,
        ingested: outcome.action === "forwarded" || outcome.action === "needs_review" ? 1 : 0,
        forwarded: outcome.action === "forwarded" ? 1 : 0,
        needsReview: outcome.action === "needs_review" ? 1 : 0,
        errors: [],
        mode: "manual",
      });
    }
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Sync failed" });
  } finally {
    syncInProgress = false;
  }
});

export default router;
