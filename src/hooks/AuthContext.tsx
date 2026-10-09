"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AdminUser, Workspace } from "@/types";
import { authService } from "@/services";
import { http } from "@/services/http";

interface SessionPayload {
  user: AdminUser;
  orgId: string | null;
  orgs: Workspace[];
}

interface AuthContextValue {
  user: AdminUser | null;
  /** True while the stored session is being restored on first load. */
  initializing: boolean;
  /** Active workspace (null = none selected yet → workspace picker). */
  orgId: string | null;
  /** All workspaces the user is a member of. */
  orgs: Workspace[];
  /** Role within the active workspace. */
  role: "admin" | "member" | null;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Workspace[]>([]);
  const [initializing, setInitializing] = useState(true);

  const applySession = useCallback((s: SessionPayload) => {
    setUser(s.user);
    setOrgId(s.orgId);
    setOrgs(s.orgs);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setOrgId(null);
    setOrgs([]);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await http.get<SessionPayload>("/api/auth/session");
      applySession(s);
    } catch {
      clearSession();
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    let cancelled = false;
    http
      .get<SessionPayload>("/api/auth/session")
      .then((s) => {
        if (!cancelled) applySession(s);
      })
      .catch(() => {
        // 401 when signed out (or transient failure) — treat as no session.
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  const login = useCallback(
    async (email: string, password: string, _remember: boolean) => {
      await authService.login({ email, password, remember: _remember });
      await refresh();
    },
    [refresh]
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      await http.post("/api/auth/register", { email, password, name });
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await authService.logout();
    clearSession();
  }, [clearSession]);

  const switchWorkspace = useCallback(
    async (nextOrgId: string) => {
      const res = await http.post<{ orgId: string; orgs: Workspace[] }>("/api/auth/workspace", {
        orgId: nextOrgId,
      });
      setOrgId(res.orgId);
      setOrgs(res.orgs);
    },
    []
  );

  const role = orgId ? (orgs.find((o) => o.orgId === orgId)?.role ?? null) : null;

  return (
    <AuthContext.Provider
      value={{
        user, initializing, orgId, orgs, role,
        login, register, logout, switchWorkspace, refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
