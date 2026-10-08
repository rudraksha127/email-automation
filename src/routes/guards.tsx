"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { paths } from "@/routes/paths";
import { useAuth } from "@/hooks/AuthContext";
import { LoadingState } from "@/components/ui/EmptyState";

/**
 * Blocks unauthenticated access to protected routes.
 * Renders a loading shell while the stored session is being restored,
 * then redirects to /login when no session exists.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isProtected = PROTECTED_SET.has(pathname);

  useEffect(() => {
    if (!initializing && !user && isProtected) {
      router.replace(paths.login);
    }
  }, [initializing, user, isProtected, router]);

  if (!isProtected) return <>{children}</>;

  if (initializing) return <LoadingState label="Restoring session…" />;

  if (!user) return <LoadingState label="Redirecting to login…" />;

  return <>{children}</>;
}

/** Authenticated users should not sit on /login — send them to the dashboard. */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isGuestPage = pathname === paths.login;

  useEffect(() => {
    if (!initializing && user && isGuestPage) {
      router.replace(paths.dashboard);
    }
  }, [initializing, user, isGuestPage, router]);

  if (isGuestPage && (initializing || user)) {
    return <LoadingState label="Loading…" />;
  }

  return <>{children}</>;
}

const PROTECTED_SET = new Set<string>([
  "/dashboard",
  "/mails",
  "/batches",
  "/settings",
]);
