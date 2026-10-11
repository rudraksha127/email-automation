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
  ClockIcon,
  SettingsIcon,
  UserIcon,
  LogoutIcon,
  MenuIcon,
  XIcon,
} from "@/components/icons";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export const NAV_ITEMS = [
  { href: paths.dashboard, label: "Dashboard", icon: HomeIcon },
  { href: paths.mails, label: "Mails", icon: MailIcon },
  { href: paths.batches, label: "Batches", icon: InboxIcon },
  { href: paths.history, label: "History", icon: ClockIcon },
  { href: paths.settings, label: "Settings", icon: SettingsIcon },
  { href: paths.profile, label: "Profile", icon: UserIcon },
] as const;

/** Top brand bar shared by all authenticated screens (incl. workspace switcher & mobile menu trigger). */
export function AppHeader({ onOpenMobileMenu }: { onOpenMobileMenu?: () => void }) {
  const { user, orgs, orgId, switchWorkspace } = useAuth();
  const mounted = useIsClient();

  // Compute initials accurately from the user's display name or email.
  // E.g., "Kapil Sahu" -> "KS", "Prof. (Dr.) Prashant Lakkadwala" -> "PL"
  const displayName =
    user?.name && user.name !== "Department Admin"
      ? user.name
      : (user?.email ?? "");

  const initials =
    displayName
      .replace(/Prof\.|\(Dr\.\)|Dr\./gi, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || (user?.email?.[0] ?? "A").toUpperCase();

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
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-xs lg:px-6 lg:py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile hamburger menu toggle */}
          {onOpenMobileMenu ? (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Open mobile navigation"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 active:scale-95 lg:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          ) : null}

          <Link href={paths.dashboard} className="flex min-w-0 items-center space-x-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/20">
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
        </div>

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
            aria-label="Open Profile"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white shadow-sm shadow-brand-700/20 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            {initials}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Mobile slide-over drawer + bottom tab bar + desktop left sidebar rail (w-60). */
export function AppNav({
  mobileOpen = false,
  onCloseMobile,
}: {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const isActive = (href: string) =>
    pathname === href || (href !== paths.dashboard && pathname.startsWith(`${href}/`));

  return (
    <>
      {/* Mobile Drawer (Slide-over matching reference image) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Slide-in sidebar drawer */}
          <div className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform">
            {/* Header with branding and close icon */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                  <GraduationCapIcon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-tight text-slate-900">
                    IT Department
                  </h2>
                  <p className="text-[11px] font-medium text-slate-400">Mail Automation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Nav items list */}
            <nav className="flex-1 overflow-y-auto px-4 py-4">
              <ul className="space-y-1.5">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onCloseMobile}
                        className={cn(
                          "flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm transition-all",
                          active
                            ? "bg-brand-600 font-bold text-white shadow-sm shadow-brand-600/30"
                            : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
                        <span>{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Drawer Bottom Actions */}
            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => {
                  onCloseMobile?.();
                  void logout().then(() => router.replace(paths.login));
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50"
              >
                <LogoutIcon className="h-5 w-5" strokeWidth={2.2} />
                <span>Logout</span>
              </button>

              <Link
                href={paths.profile}
                onClick={onCloseMobile}
                className="mt-2.5 block rounded-2xl border border-brand-100 bg-brand-50/70 p-3.5 shadow-xs transition-colors hover:bg-brand-50"
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-brand-700">
                  SIMPLE DATA. BETTER INSIGHTS.
                </p>
                <p className="mt-1 truncate text-xs font-bold text-slate-900">
                  {user?.name && user.name !== "Department Admin"
                    ? user.name.startsWith("Prof.")
                      ? user.name
                      : `Prof. ${user.name}`
                    : "Prof. Kapil Sahu"}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-700">
                  {(user?.roleTitle || "Placement Coordinator, IT Department").split(",")[0]?.trim() || "Placement Coordinator"}
                </p>
                <p className="truncate text-[11px] font-medium text-slate-500">
                  • {((user?.roleTitle || "Placement Coordinator, IT Department").split(",")[1]?.trim()) || "IT Department"}
                </p>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Primary"
        className="sticky bottom-0 z-30 shrink-0 border-t border-slate-100 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur-md lg:hidden"
      >
        <ul className="flex items-center justify-around">
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
                  <Icon className="mb-0.5 h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
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
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/20">
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
  const { user } = useAuth();

  if (!mounted) return null;

  const rawName =
    user?.name && user.name !== "Department Admin"
      ? user.name
      : "Kapil Sahu";
  const name = rawName.startsWith("Prof.") ? rawName : `Prof. ${rawName}`;
  const roleTitle = user?.roleTitle || "Placement Coordinator, IT Department";
  const [rolePrimary, roleSecondary] = roleTitle.includes(",")
    ? roleTitle.split(",").map((s) => s.trim())
    : [roleTitle, "IT Department"];

  return (
    <div
      className="mt-auto border-t border-slate-100/90 pt-3"
      data-testid="sidebar-user-card"
      aria-label="Signed in user"
    >
      {/* Logout button matching reference: red icon + red text */}
      <button
        type="button"
        onClick={onLogout}
        title="Sign out"
        aria-label="Logout"
        data-testid="sidebar-logout"
        className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50"
      >
        <LogoutIcon className="h-5 w-5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
        <span>Logout</span>
      </button>

      {/* Identity card matching reference image */}
      <Link
        href={paths.profile}
        className="mt-2 block rounded-2xl border border-brand-100 bg-brand-50/70 p-3.5 shadow-xs transition-all hover:bg-brand-50 hover:border-brand-200"
      >
        <p className="text-[10px] font-black uppercase tracking-wider text-brand-700">
          SIMPLE DATA. BETTER INSIGHTS.
        </p>
        <p className="mt-1 truncate text-xs font-bold text-slate-900">
          {name}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-700">
          {rolePrimary}
        </p>
        <p className="truncate text-[11px] font-medium text-slate-500">
          • {roleSecondary || "IT Department"}
        </p>
      </Link>
    </div>
  );
}
