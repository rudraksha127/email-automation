"use client";

import { useState } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <main className="flex min-h-dvh flex-col justify-center bg-slate-50 px-4 py-10">
      <InstallPrompt />

      <div className="mx-auto w-full max-w-md">
        {/* Brand */}
        <section className="mb-6 flex flex-col items-center text-center" aria-label="Department">
          <span className="relative mb-4">
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
              <GraduationCapIcon className="h-10 w-10" />
            </span>
            <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-slate-50 bg-emerald-500 text-white">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="white" strokeWidth="3.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </span>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">IT Department</h1>
          <p className="mt-1 text-base font-medium text-slate-500">Mail Automation</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-200/70 px-3.5 py-1.5 text-xs font-semibold text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Academic Session {academicSession()}
            {today ? <span className="text-slate-400">• {today}</span> : null}
          </p>
        </section>

        {/* Login card */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-7">
          <header className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-500">Login to continue</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600">
              <ShieldIcon className="h-4 w-4" />
              Secure Portal
            </span>
          </header>

          <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Sign in">
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

            <label className="flex cursor-pointer items-center pt-1">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="ml-2 block text-xs font-medium text-slate-700">Remember me</span>
            </label>

            {formError ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700"
              >
                {formError}
              </p>
            ) : null}

            <Button type="submit" fullWidth loading={submitting} className="py-3.5 text-sm">
              Sign In
              <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </form>
        </section>

        {/* Trust note */}
        <p className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-50/70 px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-xs">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xs font-bold text-slate-900">IT Department</span>
            <span className="block text-xs text-slate-500">Secure institutional network</span>
          </span>
        </p>

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
            Acropolis Institute of Technology and Research Indore
          </p>
          <p className="mt-1 text-xs text-slate-500">Department of Information Technology</p>
          <button
            type="button"
            onClick={() => setShowDevModal(true)}
            className="mt-4 mx-auto w-fit rounded-full bg-slate-200/70 px-3.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-300/70 transition-colors cursor-pointer"
          >
            Developed by Student of IT Department
          </button>
        </footer>
      </div>

      {/* Developer Info Modal */}
      <DeveloperModal open={showDevModal} onClose={() => setShowDevModal(false)} />
    </main>
  );
}
