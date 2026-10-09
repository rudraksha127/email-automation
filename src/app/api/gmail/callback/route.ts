import { exchangeCode, fetchAccountEmail, saveTokens, consumeState } from "@/lib/gmail";
import { audit } from "@/lib/db";

/**
 * GET /api/gmail/callback — OAuth redirect target (server-side only).
 * The organization is derived EXCLUSIVELY from the one-time server-side state
 * record; no tenant identifier from the browser is ever trusted here.
 * Validates state, exchanges the code server-side, verifies which mailbox
 * authorized us, then persists encrypted tokens. Never returns tokens.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const fail = (message: string) =>
    Response.redirect(new URL(`/settings?gmailError=${encodeURIComponent(message)}`, url.origin), 302);

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
    return Response.redirect(new URL("/settings?gmailConnected=1", url.origin), 302);
  } catch (e) {
    const safe = e instanceof Error ? e.message.slice(0, 200) : "OAuth connection failed";
    return fail(safe);
  }
}
