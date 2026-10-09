import { err, json, requireAdmin } from "@/lib/auth";

export async function GET(): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  return json({ user: admin });
}
