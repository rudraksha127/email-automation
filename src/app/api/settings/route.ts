import { err, json, requireAdmin } from "@/lib/auth";
import { nowIso } from "@/lib/db";
import { loadSettings, setSetting } from "@/lib/settings";
import { isValidEmail } from "@/utils/validation";
import type { AppSettings } from "@/types";

export async function GET(): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  return json(loadSettings());
}

export async function PUT(req: Request): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const body = (await req.json().catch(() => null)) as Partial<AppSettings> | null;
  if (!body) return err("Invalid request body", 400);
  if (body.ccEmail !== undefined) {
    const email = String(body.ccEmail).trim();
    if (!isValidEmail(email)) return err("Enter a valid CC email address", 400);
    setSetting("ccEmail", email);
  }
  if (body.autoForwarding !== undefined) {
    setSetting("autoForwarding", body.autoForwarding ? "1" : "0");
  }
  // gmailConnected/gmailAccount/lastSyncedAt are server-managed via OAuth — ignore client writes.
  setSetting("updatedAt", nowIso());
  return json(loadSettings());
}