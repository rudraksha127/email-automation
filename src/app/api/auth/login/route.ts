import { checkLogin, createSession, err, json, requireUser } from "@/lib/auth";
import { clientIp, rateLimit, rateLimitReset } from "@/lib/rateLimit";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  if (!email || !password) return err("Email and password are required", 400);

  // Brute-force protection: per-IP+account and per-IP windows.
  const ip = clientIp(req);
  const emailKey = `login:${ip}:${email.toLowerCase()}`;
  const ipKey = `login-ip:${ip}`;
  const perAccount = rateLimit(emailKey, 8, 10 * 60_000);
  const perIp = rateLimit(ipKey, 30, 10 * 60_000);
  if (!perAccount.ok || !perIp.ok) {
    const retryAfter = Math.max(perAccount.retryAfterSec, perIp.retryAfterSec);
    return new Response(
      JSON.stringify({ error: `Too many login attempts. Try again in ${retryAfter} seconds.` }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) } }
    );
  }

  const admin = checkLogin(email, password);
  if (!admin) return err("Invalid email or password", 401);
  rateLimitReset(emailKey); // successful login clears the account window
  await createSession(admin.email);
  return json({ user: admin });
}

export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (!user) return err("Unauthorized", 401);
  return json({ ok: true });
}
