import { err, json, sessionState } from "@/lib/auth";
import { getDb, getSetting, setSetting, audit, listUserOrgs } from "@/lib/db";

export interface ProfileResponse {
  name: string;
  email: string;
  employeeId: string;
  roleTitle: string;
  status: string;
  departmentScope: string;
  activeBatches: string;
  institution: string;
  department: string;
  academicSession: string;
}

/**
 * GET /api/auth/profile — returns detailed profile for the authenticated user/HOD.
 */
export async function GET(): Promise<Response> {
  const state = await sessionState();
  if (!state.user) return err("Unauthorized", 401);

  const orgId = state.orgId ?? "org_default";
  const user = state.user;

  // Default to reference HOD name if default seeded name
  const name =
    user.name && user.name !== "Department Admin"
      ? user.name
      : "Prof. (Dr.) Prashant Lakkadwala";

  const employeeId = getSetting(orgId, "profile_employee_id", "HOD-IT-001");
  const roleTitle = getSetting(orgId, "profile_role_title", "Role: HOD");
  const status = getSetting(orgId, "profile_status", "Active");
  const departmentScope = getSetting(orgId, "profile_department_scope", "IT & CSE-DS");
  const activeBatches = getSetting(orgId, "profile_active_batches", "2nd, 3rd & 4th Year");

  const response: ProfileResponse = {
    name,
    email: user.email,
    employeeId,
    roleTitle,
    status,
    departmentScope,
    activeBatches,
    institution: "Acropolis Institute of Technology And Research Indore",
    department: "IT Department",
    academicSession: "Academic Session 2026–27",
  };

  return json(response);
}

/**
 * PATCH /api/auth/profile — update profile metadata (name, employeeId, departmentScope, activeBatches).
 */
export async function PATCH(req: Request): Promise<Response> {
  const state = await sessionState();
  if (!state.user) return err("Unauthorized", 401);

  const user = state.user;
  const orgId = state.orgId ?? state.orgs[0]?.orgId ?? "org_default";

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Invalid JSON payload", 400);
  }

  const d = getDb();

  if (typeof body.name === "string" && body.name.trim()) {
    const trimmedName = body.name.trim();
    d.prepare("UPDATE admins SET name=? WHERE email=?").run(trimmedName, user.email);
  }

  if (typeof body.employeeId === "string") {
    setSetting(orgId, "profile_employee_id", body.employeeId.trim());
  }

  if (typeof body.departmentScope === "string") {
    setSetting(orgId, "profile_department_scope", body.departmentScope.trim());
  }

  if (typeof body.activeBatches === "string") {
    setSetting(orgId, "profile_active_batches", body.activeBatches.trim());
  }

  if (typeof body.roleTitle === "string") {
    setSetting(orgId, "profile_role_title", body.roleTitle.trim());
  }

  audit(orgId, user.email, "profile.updated", "User updated institutional profile");

  // Re-fetch updated profile
  const adminRow = d.prepare("SELECT name FROM admins WHERE email=?").get(user.email) as
    | { name: string }
    | undefined;

  const updatedName = adminRow?.name ?? user.name;
  const updatedEmployeeId = getSetting(orgId, "profile_employee_id", "HOD-IT-001");
  const updatedRoleTitle = getSetting(orgId, "profile_role_title", "Role: HOD");
  const updatedStatus = getSetting(orgId, "profile_status", "Active");
  const updatedDepartmentScope = getSetting(orgId, "profile_department_scope", "IT & CSE-DS");
  const updatedActiveBatches = getSetting(orgId, "profile_active_batches", "2nd, 3rd & 4th Year");

  return json({
    name: updatedName,
    email: user.email,
    employeeId: updatedEmployeeId,
    roleTitle: updatedRoleTitle,
    status: updatedStatus,
    departmentScope: updatedDepartmentScope,
    activeBatches: updatedActiveBatches,
    institution: "Acropolis Institute of Technology And Research Indore",
    department: "IT Department",
    academicSession: "Academic Session 2026–27",
  });
}
