import { requireAdmin } from "@/lib/auth";
import { buildAuthUrl, gmailConfig } from "@/lib/gmail";

/**
 * GET /api/gmail/connect — admin-only entry to the OAuth consent flow.
 * Redirects the browser to Google; no secrets ever touch the client.
 */
export async function GET(): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cfg = gmailConfig();
  if (!cfg.configured) {
    return Response.json(
      { error: "Gmail OAuth is not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET on the server." },
      { status: 503 }
    );
  }
  if (!cfg.target) {
    return Response.json(
      { error: "GMAIL_TARGET_EMAIL is not configured on the server — refusing to start OAuth without a target mailbox." },
      { status: 503 }
    );
  }
  try {
    const { url } = buildAuthUrl();
    return Response.redirect(url, 302);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Unable to start OAuth" }, { status: 500 });
  }
}