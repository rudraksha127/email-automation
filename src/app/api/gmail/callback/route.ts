import { exchangeCode, fetchAccountEmail, saveTokens, consumeState, gmailConfig } from "@/lib/gmail";

/**
 * GET /api/gmail/callback — OAuth redirect target (server-side only).
 * Validates state, exchanges the code, verifies the connected account IS the pilot
 * target mailbox, then persists tokens server-side. Never returns tokens to the client.
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
  if (!consumeState(state)) return fail("Invalid or expired OAuth state. Please try connecting again.");

  try {
    const tokens = await exchangeCode(code);
    const account = await fetchAccountEmail(tokens.access_token);
    const cfg = gmailConfig();
    if (account !== cfg.target.toLowerCase()) {
      // Never silently bind a different mailbox than the pilot target.
      return fail(`Connected account ${account} does not match the target mailbox ${cfg.target}.`);
    }
    if (!tokens.refresh_token) {
      return fail("Google did not return a refresh token. Please reconnect with prompt=consent.");
    }
    saveTokens(account, tokens.access_token, tokens.refresh_token, tokens.expires_in ?? 3600);
    return Response.redirect(new URL("/settings?gmailConnected=1", url.origin), 302);
  } catch (e) {
    const safe = e instanceof Error ? e.message.slice(0, 200) : "OAuth connection failed";
    return fail(safe);
  }
}