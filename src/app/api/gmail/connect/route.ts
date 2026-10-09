import { err, json, requireOrg } from "@/lib/auth";
import { buildAuthUrl, gmailConfig } from "@/lib/gmail";
import { tokenEncryptionReady } from "@/lib/crypto";

/**
 * GET /api/gmail/connect — admin-only entry to the OAuth consent flow for the
 * ACTIVE workspace. The org binding is written into the server-side state
 * record here; the callback never accepts an org from the browser.
 */
export async function GET(): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const cfg = gmailConfig();
  if (!cfg.configured) {
    return json(
      { error: "Gmail OAuth is not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET on the server." },
      503
    );
  }
  if (!tokenEncryptionReady() && process.env.NODE_ENV === "production") {
    return json(
      { error: "GMAIL_TOKEN_KEY is not configured on the server — refusing to store OAuth tokens unencrypted." },
      503
    );
  }
  try {
    const { url } = buildAuthUrl(auth.orgId);
    return Response.redirect(url, 302);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unable to start OAuth" }, 500);
  }
}
