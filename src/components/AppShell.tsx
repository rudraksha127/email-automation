"use client";

import Link from "next/link";
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
} from "@/components/icons";

const NAV_ITEMS = [
  { href: paths.dashboard, label: "Dashboard", icon: HomeIcon },
  { href: paths.mails, label: "Mails", icon: MailIcon },
  { href: paths.batches, label: "Batches", icon: InboxIcon },
  { href: paths.settings, label: "Settings", icon: SettingsIcon },
] as const;

/** Top brand bar shared by all authenticated screens. */
export function AppHeader() {
  const { user } = useAuth();
  const initial = (user?.email?.[0] ?? "A").toUpperCase();

  return (
    <header className="shrink-0 border-b border-slate-100 bg-white px-5 py-3">
      <div className="flex items-center justify-between">
        <Link href={paths.dashboard} className="flex items-center space-x-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/20">
            <GraduationCapIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xs font-bold uppercase tracking-tight text-slate-900">
              IT Department
            </span>
            <span className="block text-[11px] font-medium leading-tight text-slate-400">
              Mail Automation
            </span>
          </span>
        </Link>
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white shadow-sm shadow-brand-700/20"
        >
          {initial}
        </span>
      </div>
    </header>
  );
}

/** Mobile bottom tab bar + a compact sidebar rail on desktop (lg+). */
export function AppNav() {
  const pathname = usePathname();

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

      {/* Desktop: left sidebar rail */}
      <nav
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-slate-100 bg-white px-4 py-5 lg:flex"
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
      </nav>
    </>
  );
}
