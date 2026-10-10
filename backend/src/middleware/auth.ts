import type { Request, Response, NextFunction } from "express";
import { getDb, listUserOrgs, membershipOf, type Membership } from "../lib/db";

export const SESSION_COOKIE = "ma_session";
const TTL_MS = 7 * 24 * 3600_000;

export interface SessionUser {
  email: string;
  name: string;
}

export interface OrgAuthOk {
  ok: true;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: "admin" | "member";
}

export type OrgAuth =
  | OrgAuthOk
  | { ok: false; status: 401 | 403; message: string };

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser | null;
      orgAuth?: OrgAuth;
      sessionToken?: string | null;
    }
  }
}

/** Extracts session token from cookie or Authorization header. */
export function extractToken(req: Request): string | null {
  if (req.cookies && req.cookies[SESSION_COOKIE]) {
    return req.cookies[SESSION_COOKIE];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  return null;
}

/** Resolves current session and user from request. */
export function resolveSession(req: Request): { user: SessionUser | null; orgId: string | null; token: string | null } {
  const token = extractToken(req);
  if (!token) return { user: null, orgId: null, token: null };

  const d = getDb();
  const row = d.prepare(`
    SELECT s.token, s.admin_email, s.org_id, s.expires_at, a.name
    FROM sessions s
    JOIN admins a ON a.email = s.admin_email
    WHERE s.token = ?
  `).get(token) as { token: string; admin_email: string; org_id: string | null; expires_at: string; name: string } | undefined;

  if (!row) return { user: null, orgId: null, token };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    try {
      d.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    } catch {
      /* noop */
    }
    return { user: null, orgId: null, token };
  }

  return {
    user: { email: row.admin_email, name: row.name },
    orgId: row.org_id,
    token: row.token,
  };
}

/** Resolves multi-tenant workspace context for the current session. */
export function resolveOrgAuth(user: SessionUser | null, orgId: string | null, requireAdmin = false): OrgAuth {
  if (!user) {
    return { ok: false, status: 401, message: "Unauthorized — please sign in" };
  }

  const orgs = listUserOrgs(user.email);
  if (orgs.length === 0) {
    return {
      ok: false,
      status: 403,
      message: "No workspace memberships. Create or join a workspace first.",
    };
  }

  const targetOrgId = orgId ?? (orgs.length === 1 ? orgs[0]!.orgId : null);
  if (!targetOrgId) {
    return {
      ok: false,
      status: 403,
      message: "Multiple workspaces available. Select a workspace to continue.",
    };
  }

  const membership = membershipOf(targetOrgId, user.email);
  if (!membership) {
    return {
      ok: false,
      status: 403,
      message: "You are not a member of this workspace.",
    };
  }

  if (requireAdmin && membership.role !== "admin") {
    return {
      ok: false,
      status: 403,
      message: "Forbidden — workspace administrator privilege required",
    };
  }

  const targetOrg = orgs.find((o) => o.orgId === targetOrgId);
  return {
    ok: true,
    email: user.email,
    name: user.name,
    orgId: targetOrgId,
    orgName: targetOrg?.name ?? "Workspace",
    role: membership.role,
  };
}

/** Express middleware: Attaches user & orgAuth to req. */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { user, orgId, token } = resolveSession(req);
  req.user = user;
  req.sessionToken = token;
  req.orgAuth = resolveOrgAuth(user, orgId);
  next();
}

/** Express route guard: Requires valid authenticated user. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized — please sign in" });
    return;
  }
  next();
}

/** Express route guard: Requires active workspace membership (optional admin requirement). */
export function requireWorkspace(requireAdmin = false) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { user, orgId } = resolveSession(req);
    const orgAuth = resolveOrgAuth(user, orgId, requireAdmin);
    if (!orgAuth.ok) {
      res.status(orgAuth.status).json({ error: orgAuth.message });
      return;
    }
    req.orgAuth = orgAuth;
    next();
  };
}
