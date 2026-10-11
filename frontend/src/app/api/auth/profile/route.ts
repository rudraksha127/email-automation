import { err, json, sessionState } from "@/lib/auth";
import { getDb, getSetting, setSetting, audit } from "@/lib/db";

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

const PROFILE_DEFAULTS = {
  employeeId: "EMP-001",
  roleTitle: "Placement Coordinator",
  status: "Active",
  departmentScope: "Placement Cell",
  activeBatches: "",
  institution: "",
  department: "",
};

/**
 * GET /api/auth/profile — returns the signed-in user's profile.
 * Everything except the email is user-editable; defaults are neutral and
 * described in 'hint' fields... (kept simple: empty defaults render as editable blanks).
 */
export async function GET(): Promise<Response> {
  const state = await sessionState();
  if (!state.user) return err("Unauthorized", 401);

  const orgId = state.orgId ?? "org_default";
  const user = state.user;

  const name =
    user.name && user.name !== "Department Admin" ? user.name : "";

  const response: ProfileResponse = {
    name,
    email: user.email,
    employeeId: getSetting(orgId, "profile_employee_id", PROFILE_DEFAULTS.employeeId),
    roleTitle: getSetting(orgId, "profile_role_title", PROFILE_DEFAULTS.roleTitle),
    status: getSetting(orgId, "profile_status", PROFILE_DEFAULTS.status),
    departmentScope: getSetting(orgId, "profile_department_scope", PROFILE_DEFAULTS.departmentScope),
    activeBatches: getSetting(orgId, "profile_active_batches", PROFILE_DEFAULTS.activeBatches),
    institution: getSetting(orgId, "profile_institution", PROFILE_DEFAULTS.institution),
    department: getSetting(orgId, "profile_department", PROFILE_DEFAULTS.department),
    academicSession: getSetting(orgId, "profile_academic_session", "2026–27"),
  };

  return json(response);
}

/**
 * PATCH /api/auth/profile — update profile metadata
 * (name, roleTitle, employeeId, departmentScope, activeBatches, institution, department).
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

  if (typeof body.name === "string") {
    const trimmedName = body.name.trim();
    if (trimmedName) {
      d.prepare("UPDATE admins SET name=? WHERE email=?").run(trimmedName, user.email);
    }
  }

  const stringFields: Array<[string, string]> = [
    ["employeeId", "profile_employee_id"],
    ["departmentScope", "profile_department_scope"],
    ["activeBatches", "profile_active_batches"],
    ["roleTitle", "profile_role_title"],
    ["status", "profile_status"],
    ["institution", "profile_institution"],
    ["department", "profile_department"],
    ["academicSession", "profile_academic_session"],
  ];
  for (const [bodyKey, settingKey] of stringFields) {
    const value = body[bodyKey];
    if (typeof value === "string") setSetting(orgId, settingKey, value.trim());
  }

  audit(orgId, user.email, "profile.updated", "User updated profile");

  // Re-fetch the updated profile (same shape as GET).
  const adminRow = d.prepare("SELECT name FROM admins WHERE email=?").get(user.email) as
    | { name: string }
    | undefined;

  const response: ProfileResponse = {
    name: adminRow?.name || user.name,
    email: user.email,
    employeeId: getSetting(orgId, "profile_employee_id", PROFILE_DEFAULTS.employeeId),
    roleTitle: getSetting(orgId, "profile_role_title", PROFILE_DEFAULTS.roleTitle),
    status: getSetting(orgId, "profile_status", PROFILE_DEFAULTS.status),
    departmentScope: getSetting(orgId, "profile_department_scope", PROFILE_DEFAULTS.departmentScope),
    activeBatches: getSetting(orgId, "profile_active_batches", PROFILE_DEFAULTS.activeBatches),
    institution: getSetting(orgId, "profile_institution", PROFILE_DEFAULTS.institution),
    department: getSetting(orgId, "profile_department", PROFILE_DEFAULTS.department),
    academicSession: getSetting(orgId, "profile_academic_session", "2026–27"),
  };

  return json(response);
}
