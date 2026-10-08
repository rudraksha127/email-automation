import type { ReactNode } from "react";
import { AppHeader, AppNav } from "@/components/AppShell";

/**
 * Shell for authenticated screens: brand header, content area and
 * bottom tabs (mobile) / sidebar rail (desktop).
 */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader />
      <div className="flex flex-1 lg:pl-56">
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-6 pt-4">{children}</main>
      </div>
      <AppNav />
    </div>
  );
}

/** Standard page heading block: title + contextual subtitle. */
export function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="mb-4">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-0.5 text-xs font-medium text-slate-400">{subtitle}</p>
    </section>
  );
}
