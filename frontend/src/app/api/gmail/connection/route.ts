import { err, json, requireOrg } from "@/lib/auth";
import { disconnectGmail, connectionInfo } from "@/lib/gmail";

/**
 * DELETE /api/gmail/connection — disconnect the ACTIVE workspace's mailbox:
 * best-effort revocation at Google + local token deletion. Admin only.
 */
export async function DELETE(): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  await disconnectGmail(auth.orgId, auth.email);
  return json(connectionInfo(auth.orgId));
}
