"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { paths } from "@/routes/paths";
import { useAuth } from "@/hooks/AuthContext";
import { LoadingState } from "@/components/ui/EmptyState";

/**
 * Blocks unauthenticated access to protected routes and enforces workspace
 * selection: signed-in users without an active workspace are sent to the
 * workspace picker (they cannot see any data before a workspace is chosen).
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, initializing, orgId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isProtected = PROTECTED_SET.has(pathname);

  useEffect(() => {
    if (initializing) return;
    if (!user && isProtected) {
      router.replace(paths.login);
      return;
    }
    if (user && !orgId && pathname !== paths.workspace) {
      router.replace(paths.workspace);
    }
  }, [initializing, user, orgId, isProtected, pathname, router]);

  if (!isProtected) return <>{children}</>;

  if (initializing) return <LoadingState label="Restoring session…" />;

  if (!user) return <LoadingState label="Redirecting to login…" />;

  // On the picker itself: render immediately (no workspace needed to choose).
  if (pathname === paths.workspace) return <>{children}</>;

  if (!orgId) return <LoadingState label="Selecting workspace…" />;

  return <>{children}</>;
}

/** Authenticated users should not sit on the login page. */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { user, initializing, orgId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isGuestPage = pathname === paths.login;

  useEffect(() => {
    if (!initializing && user && isGuestPage) {
      router.replace(user && orgId ? paths.dashboard : paths.workspace);
    }
  }, [initializing, user, orgId, isGuestPage, router]);

  if (isGuestPage && (initializing || user)) {
    return <LoadingState label="Loading…" />;
  }

  return <>{children}</>;
}

const PROTECTED_SET = new Set<string>([
  paths.dashboard,
  paths.mails,
  paths.batches,
  paths.settings,
  paths.workspace,
]);
