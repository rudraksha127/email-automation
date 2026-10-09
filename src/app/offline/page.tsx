import Link from "next/link";

/**
 * Static offline fallback served by the service worker when the network is
 * unavailable. Deliberately makes no claim that email automation runs offline.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0M8.111 8.111A5 5 0 0 0 14 12a5 5 0 0 0 3.9 4.889M2 2l20 20" />
        </svg>
      </span>
      <h1 className="mt-5 text-lg font-black tracking-tight text-slate-900">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">
        This page needs a connection. Incoming mail processing continues on the server — reconnect
        to view the dashboard.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700"
      >
        Try again
      </Link>
    </main>
  );
}
