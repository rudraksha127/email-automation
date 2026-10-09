import { createSession, err, json } from "@/lib/auth";
import { getDb, hashPassword, nowIso } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { isValidEmail } from "@/utils/validation";

/**
 * POST /api/auth/register — create a user account.
 * Registration grants NO workspace privileges: the new user starts with zero
 * memberships and can only create their own workspace or be invited to one.
 */
export async function POST(req: Request): Promise<Response> {
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 15 * 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: "Too many attempts. Try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSec) } }
    );
  }
  const body = (await req.json().catch(() => null)) as {
    email?: string; password?: string; name?: string;
  } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const name = String(body?.name ?? "").trim().slice(0, 60);
  if (!email || !password) return err("Email and password are required", 400);
  if (!isValidEmail(email)) return err("Enter a valid email address", 400);
  if (password.length < 8) return err("Password must be at least 8 characters", 400);

  const d = getDb();
  const existing = d.prepare("SELECT 1 FROM admins WHERE email=?").get(email);
  if (existing) return err("An account with this email already exists", 409);

  const { hash, salt } = hashPassword(password);
  try {
    d.prepare("INSERT INTO admins(email,name,password_hash,salt,created_at) VALUES(?,?,?,?,?)").run(
      email, name || email.split("@")[0] || "User", hash, salt, nowIso()
    );
  } catch {
    return err("An account with this email already exists", 409);
  }
  await createSession(email); // binds a workspace only if the user has exactly one
  return json({ user: { email, name: name || email.split("@")[0] } }, 201);
}
