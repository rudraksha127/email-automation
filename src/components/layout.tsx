import type { ReactNode } from "react";
import { AppHeader, AppNav } from "@/components/AppShell";

/**
 * Shell for authenticated screens: sticky brand header, content area and
 * bottom tabs (mobile) / w-60 sidebar rail (desktop, per Stitch web refs).
 */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader />
      <div className="flex flex-1 lg:pl-60">
        <main className="mx-auto w-full px-5 pb-6 pt-4 lg:px-6 lg:pt-6">{children}</main>
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
