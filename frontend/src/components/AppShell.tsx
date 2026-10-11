"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { paths } from "@/routes/paths";
import { useAuth } from "@/hooks/AuthContext";
import { cn } from "@/utils/cn";
import {
  GraduationCapIcon,
  HomeIcon,
  MailIcon,
  InboxIcon,
  SettingsIcon,
  UserIcon,
  LogoutIcon,
} from "@/components/icons";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

const NAV_ITEMS = [
  { href: paths.dashboard, label: "Dashboard", icon: HomeIcon },
  { href: paths.mails, label: "Mails", icon: MailIcon },
  { href: paths.batches, label: "Batches", icon: InboxIcon },
  { href: paths.settings, label: "Settings", icon: SettingsIcon },
  { href: paths.profile, label: "Profile", icon: UserIcon },
] as const;

/** Top brand bar shared by all authenticated screens (incl. workspace switcher). */
export function AppHeader() {
  const { user, orgs, orgId, switchWorkspace } = useAuth();
  const mounted = useIsClient();

  const initial = (user?.email?.[0] ?? "A").toUpperCase();

  function handleSwitch(nextOrgId: string) {
    if (nextOrgId === paths.workspace) {
      window.location.assign(paths.workspace);
      return;
    }
    if (!nextOrgId || nextOrgId === orgId) return;
    void switchWorkspace(nextOrgId).then(() => {
      // Full navigation so every screen refetches the new workspace's data.
      window.location.assign(paths.dashboard);
    });
  }

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white px-5 py-3 shadow-xs lg:px-6 lg:py-2.5">
      <div className="flex items-center justify-between gap-3">
        <Link href={paths.dashboard} className="flex min-w-0 items-center space-x-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/20">
            <GraduationCapIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold uppercase tracking-tight text-slate-900">
              IT Department
            </span>
            <span className="block truncate text-[11px] font-medium leading-tight text-slate-400">
              Mail Automation
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {mounted && orgs.length > 0 ? (
            <select
              aria-label="Active workspace"
              value={orgId ?? ""}
              onChange={(e) => handleSwitch(e.target.value)}
              className="max-w-[132px] truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-700 focus:border-brand-500 focus:outline-none sm:max-w-[180px]"
            >
              {orgs.map((o) => (
                <option key={o.orgId} value={o.orgId}>
                  {o.name}
                </option>
              ))}
              <option value={paths.workspace}>＋ Create workspace…</option>
            </select>
          ) : null}
          <Link
            href={paths.profile}
            title="Institutional Profile & Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white shadow-sm shadow-brand-700/20 transition-opacity hover:opacity-90"
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Mobile bottom tab bar + a compact sidebar rail on desktop (lg+). */
export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, orgs, orgId } = useAuth();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Primary"
        className="sticky bottom-0 z-30 shrink-0 border-t border-slate-100 bg-white/95 px-6 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur-md lg:hidden"
      >
        <ul className="flex items-center justify-between">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center rounded-lg px-2 py-1 transition-colors",
                    active ? "text-brand-600" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Icon className="mb-1 h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                  <span
                    className={cn(
                      "text-[10px] leading-none",
                      active ? "font-bold" : "font-medium"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: left sidebar rail (w-60 per Stitch web reference) */}
      <nav
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex"
      >
        <Link href={paths.dashboard} className="mb-8 flex items-center space-x-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <GraduationCapIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xs font-bold uppercase tracking-tight text-slate-900">
              IT Department
            </span>
            <span className="block text-[11px] font-medium text-slate-400">Mail Automation</span>
          </span>
        </Link>
        <ul className="flex-1 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Signed-in user card with logout — mirrors the profile identity. */}
        <UserCard onLogout={() => void logout().then(() => router.replace(paths.login))} />
      </nav>
    </>
  );
}

/** Sidebar footer: signed-in identity (name, role, workspace) + logout button. */
function UserCard({ onLogout }: { onLogout: () => void }) {
  const mounted = useIsClient();
  const { user, orgs, orgId } = useAuth();

  if (!mounted) return null;

  const name =
    user?.name && user.name !== "Department Admin"
      ? user.name
      : user?.email || "Signed in";
  const role = orgs.find((o) => o.orgId === orgId)?.role;
  const roleLabel = role === "admin" ? "Administrator" : role === "member" ? "Member" : "";

  return (
    <div
      className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/90 px-3 py-3 shadow-xs"
      data-testid="sidebar-user-card"
      aria-label="Signed in user"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black uppercase tracking-wide text-brand-700">
            {name}
          </p>
          {roleLabel ? (
            <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
              {roleLabel}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Sign out"
          aria-label="Logout"
          data-testid="sidebar-logout"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
        >
          <LogoutIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
