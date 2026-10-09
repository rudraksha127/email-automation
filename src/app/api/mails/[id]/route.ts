import { err, json, requireOrg } from "@/lib/auth";
import { getOrgMailRow, mailToApi } from "@/lib/pipeline";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  // Cross-tenant ids behave exactly like nonexistent ids (404).
  const row = getOrgMailRow(auth.orgId, id);
  if (!row) return err("Mail not found", 404);
  return json(mailToApi(row));
}
