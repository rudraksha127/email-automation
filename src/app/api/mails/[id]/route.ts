import { err, json, requireAdmin } from "@/lib/auth";
import { getMailRow, mailToApi } from "@/lib/pipeline";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const { id } = await params;
  const row = getMailRow(id);
  if (!row) return err("Mail not found", 404);
  return json(mailToApi(row));
}