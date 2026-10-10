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
import { audit } from "../lib/db";

const router = Router();
let syncInProgress = false;

function getFrontendBaseUrl(): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  if (process.env.CORS_ORIGIN && !process.env.CORS_ORIGIN.includes("*")) {
    const first = process.env.CORS_ORIGIN.split(",")[0]?.trim();
    if (first) return first.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/** GET /api/gmail/connect — start OAuth consent flow */
router.get("/connect", requireWorkspace(true), (req, res) => {
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
});

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
    if (!tokens.refresh_token) {
      return fail("Google did not return a refresh token. Please reconnect with prompt=consent.");
    }
    saveTokens(orgId, account, tokens.access_token, tokens.refresh_token, tokens.expires_in ?? 3600);
    audit(orgId, account, "gmail.oauth_callback", `connected ${account}`);
    res.redirect(302, `${frontendBase}/settings?gmailConnected=1`);
  } catch (e) {
    const safe = e instanceof Error ? e.message.slice(0, 200) : "OAuth connection failed";
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
  if (!getTokens(auth.orgId)?.refresh_token) {
    res.status(409).json({ error: "No Gmail account is connected for this workspace" });
    return;
  }
  syncInProgress = true;
  try {
    const result = await syncGmailInbox(auth.orgId);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Sync failed" });
  } finally {
    syncInProgress = false;
  }
});

export default router;
