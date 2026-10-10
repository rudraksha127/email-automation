import { err, json, requireUser } from "@/lib/auth";
import { getDb, hashPassword, verifyPassword } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (!user) return err("Unauthorized", 401);

  // Limit current-password guesses even from an authenticated session.
  const rl = rateLimit(`pwchange:${clientIp(req)}`, 10, 5 * 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: "Too many password change attempts. Try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    currentPassword?: string; newPassword?: string;
  } | null;
  const cur = String(body?.currentPassword ?? "");
  const next = String(body?.newPassword ?? "");
  if (!cur || !next) return err("Current and new passwords are required", 400);
  if (next.length < 8) return err("New password must be at least 8 characters", 400);
  const row = getDb().prepare("SELECT password_hash,salt FROM admins WHERE email=?").get(user.email) as
    | { password_hash: string; salt: string } | undefined;
  if (!row || !verifyPassword(cur, row.password_hash, row.salt)) {
    return err("Current password is incorrect", 400);
  }
  const { hash, salt } = hashPassword(next);
  getDb().prepare("UPDATE admins SET password_hash=?,salt=? WHERE email=?").run(hash, salt, user.email);
  return json({ ok: true });
}
