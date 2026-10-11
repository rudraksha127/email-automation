import { err, json, requireOrg } from "@/lib/auth";
import { getDb, nowIso, uid, audit } from "@/lib/db";
import { isValidEmail } from "@/utils/validation";

interface ImportRow {
  "Batch Name"?: string;
  Description?: string;
  "Student Name"?: string;
  Email?: string;
  batchName?: string;
  description?: string;
  studentName?: string;
  email?: string;
}

/**
 * POST /api/batches/import — bulk-create batches (+ their recipients) from
 * one uploaded CSV: Batch Name,Description,Student Name,Email
 * Rows with the same batch name are merged into that batch. Existing batches
 * are reused (recipients added to them); duplicate recipients are skipped.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);

  const body = (await req.json().catch(() => null)) as { rows?: ImportRow[] } | null;
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows || rows.length === 0) return err("rows array is required", 400);
  if (rows.length > 5000) return err("Maximum 5000 rows per import", 400);

  const d = getDb();
  const now = nowIso();
  const auditDetail: string[] = [];

  // Cache existing batches within this workspace (case-insensitive name).
  const batchIdByName = new Map<string, string>();
  const insertBatch = d.prepare(
    "INSERT INTO batches(id,org_id,name,description,created_at,updated_at) VALUES(?,?,?,?,?,?)"
  );
  const insertRecipient = d.prepare(
    "INSERT INTO recipients(id,batch_id,org_id,name,email,created_at) VALUES(?,?,?,?,?,?)"
  );

  const stats = { batchesCreated: 0, batchesReused: 0, recipientsAdded: 0, invalidRows: 0 };

  // Emails already present per batch (populated lazily per touched batch).
  const seenEmailsByBatch = new Map<string, Set<string>>();

  function recipientEmailsFor(batchId: string): Set<string> {
    let set = seenEmailsByBatch.get(batchId);
    if (!set) {
      set = new Set(
        (d.prepare("SELECT lower(email) AS e FROM recipients WHERE batch_id=?").all(batchId) as
          Array<{ e: string }>).map((r) => r.e)
      );
      seenEmailsByBatch.set(batchId, set);
    }
    return set;
  }

  for (const raw of rows) {
    const batchName = String(raw?.["Batch Name"] ?? raw?.batchName ?? "").trim();
    const description = String(raw?.["Description"] ?? raw?.description ?? "").trim();
    const studentName = String(raw?.["Student Name"] ?? raw?.studentName ?? "").trim();
    const email = String(raw?.["Email"] ?? raw?.email ?? "").trim().toLowerCase();

    if (!batchName || batchName.length > 80) {
      stats.invalidRows += 1;
      continue;
    }

    if (batchName && studentName && !isValidEmail(email)) {
      // A batch-level row without a valid recipient is still fine ONLY if it
      // carries no student info; rows with a name/email must both be valid.
      if (email || studentName) {
        stats.invalidRows += 1;
        continue;
      }
    }

    const nameKey = batchName.toLowerCase();
    let batchId = batchIdByName.get(nameKey);
    if (!batchId) {
      const existing = d.prepare(
        "SELECT id FROM batches WHERE org_id=? AND lower(name)=lower(?)"
      ).get(auth.orgId, batchName) as { id: string } | undefined;
      if (existing) {
        batchId = existing.id;
        stats.batchesReused += 1;
      } else {
        batchId = uid("b");
        insertBatch.run(batchId, auth.orgId, batchName, description || null, now, now);
        stats.batchesCreated += 1;
        auditDetail.push(batchName.slice(0, 60));
      }
      batchIdByName.set(nameKey, batchId);
    }

    if (studentName && email && isValidEmail(email)) {
      const emails = recipientEmailsFor(batchId);
      if (!emails.has(email)) {
        insertRecipient.run(uid("r"), batchId, auth.orgId, studentName, email, now);
        emails.add(email);
        stats.recipientsAdded += 1;
      }
    }
  }

  audit(
    auth.orgId,
    auth.email,
    "groups.bulk_imported",
    `${stats.batchesCreated} created, ${stats.recipientsAdded} recipients imported` +
      (auditDetail.length > 0 ? `: ${auditDetail.slice(0, 5).join(", ")}` : "")
  );

  return json(stats, 201);
}
