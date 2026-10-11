"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { paths } from "@/routes/paths";
import { useAuth } from "@/hooks/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { InstallPrompt } from "@/components/InstallPrompt";
import {
  GraduationCapIcon,
  MailIcon,
  LockIcon,
  ArrowRightIcon,
  ShieldIcon,
} from "@/components/icons";
import { validateLoginForm } from "@/utils/validation";
import { DeveloperModal } from "@/components/DeveloperModal";

/** "Fri, 9 Oct, 2026" — computed after mount to avoid hydration mismatch. */
function formatToday(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "numeric" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `${weekday}, ${day} ${month}, ${d.getFullYear()}`;
}

/** Academic session label (July–June cycle): "2026–27". */
function academicSession(): string {
  const d = new Date();
  const start = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}–${String(start + 1).slice(2)}`;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  // This page is fully client-rendered (the auth guard streams the shell as a
  // Suspense fallback), so a lazy initializer is hydration-safe.
  const [today] = useState(formatToday);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err) {
        queueMicrotask(() => {
          setFormError(err);
        });
        window.history.replaceState({}, "", "/login");
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const errors = validateLoginForm(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login(email, password, remember);
      router.replace(paths.dashboard);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to sign in. Please try again."
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-slate-50 px-4 py-3 sm:py-6">
      <InstallPrompt />

      <div className="mx-auto w-full max-w-md">
        {/* Brand */}
        <section className="mb-3.5 sm:mb-4 flex flex-col items-center text-center" aria-label="Department">
          <span className="relative mb-2.5">
            <span className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-brand-600 text-white shadow-md shadow-brand-600/25">
              <GraduationCapIcon className="h-7 w-7 sm:h-8 sm:w-8" />
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-50 bg-emerald-500 text-white">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="white" strokeWidth="3.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </span>
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900">IT Department</h1>
          <p className="mt-0.5 text-sm sm:text-base font-medium text-slate-500">Mail Automation</p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-200/60 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="text-[11px] sm:text-xs font-medium text-slate-600">
              Academic Session {academicSession()}
              {today ? <span className="text-slate-400"> • {today}</span> : null}
            </span>
          </div>
        </section>

        {/* Login card */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-md shadow-slate-200/40">
          <header className="mb-3.5 sm:mb-4 flex items-center justify-between">
            <h2 className="text-xs sm:text-[13px] font-medium text-slate-400">Login to continue</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600">
              <ShieldIcon className="h-4 w-4" />
              Secure Portal
            </span>
          </header>

          <form onSubmit={handleSubmit} noValidate className="space-y-3 sm:space-y-3.5" aria-label="Sign in">
            <Input
              label="Email Address"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              icon={<MailIcon className="h-5 w-5" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
            />

            <Input
              label="Password"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              icon={<LockIcon className="h-5 w-5" />}
              passwordToggle
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
            />

            <label className="flex cursor-pointer select-none items-center gap-2 pt-0.5">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs font-medium text-slate-700">Remember me</span>
            </label>

            {formError ? (
              <div
                role="alert"
                className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800"
              >
                <div className="flex-1">
                  <p className="font-semibold text-rose-900">Sign in failed</p>
                  <p className="mt-0.5 leading-relaxed text-rose-700">{formError}</p>
                </div>
                {(formError.includes("unavailable") ||
                  formError.includes("starting up") ||
                  formError.includes("connection") ||
                  formError.includes("network") ||
                  formError.includes("server error")) && (
                  <button
                    type="button"
                    onClick={(e) => void handleSubmit(e)}
                    className="shrink-0 rounded-lg bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-200 transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : null}

            <Button
              type="submit"
              fullWidth
              loading={submitting}
              className="mt-1 flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all active:scale-[0.99]"
            >
              Sign In
              <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </form>
        </section>

        {/* Context note */}
        <div className="mt-3.5 flex items-center gap-3 rounded-xl bg-slate-100/70 p-3 sm:p-3.5 border border-slate-200/60">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-xs">
            <ShieldIcon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-900">IT Department</p>
            <p className="truncate text-[11px] text-slate-500">Secure institutional network</p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Acropolis Institute of Technology and Research Indore
          </p>
          <p className="mt-0.5 text-xs text-slate-400">Department of Information Technology</p>
          
          <div className="mt-2 flex justify-center gap-4 text-xs font-medium text-brand-600">
            <a href="/privacy-policy" className="hover:underline">Privacy Policy</a>
            <a href="/terms" className="hover:underline">Terms of Service</a>
          </div>

          <div className="mt-2.5 flex justify-center">
            <button
              type="button"
              onClick={() => setShowDevModal(true)}
              className="inline-flex h-8 items-center rounded-lg bg-slate-200/60 px-3 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Developed by Student of IT Department
            </button>
          </div>
        </footer>
      </div>

      {/* Developer Info Modal */}
      <DeveloperModal open={showDevModal} onClose={() => setShowDevModal(false)} />
    </main>
  );
}
