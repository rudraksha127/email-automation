"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { paths } from "@/routes/paths";
import { useAuth } from "@/hooks/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GraduationCapIcon, MailIcon, LockIcon, ArrowRightIcon } from "@/components/icons";
import { validateLoginForm } from "@/utils/validation";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <main className="flex min-h-dvh flex-col bg-white px-6 pb-8 pt-10">
      {/* Department badge */}
      <section className="mb-8 flex items-center space-x-3" aria-label="Department">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600 shadow-sm">
          <GraduationCapIcon className="h-6 w-6" />
        </span>
        <span>
          <span className="block text-base font-bold leading-tight tracking-tight text-slate-900">
            IT Department
          </span>
          <span className="block text-xs font-medium text-slate-500">Mail Automation</span>
        </span>
      </section>

      {/* Welcome */}
      <section className="mb-8">
        <h1 className="mb-1.5 text-[28px] font-black tracking-tight text-slate-900">
          Welcome Back
        </h1>
        <p className="text-sm leading-relaxed text-slate-500">
          Sign in to manage departmental email automation.
        </p>
      </section>

      {/* Login form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-label="Sign in">
        <Input
          label="Email Address"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="admin@example.in"
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
          placeholder="••••••••••"
          icon={<LockIcon className="h-5 w-5" />}
          passwordToggle
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="ml-2 block text-xs font-medium text-slate-700">Remember me</span>
          </label>
        </div>

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

      <footer className="mt-auto pt-10 text-center">
        <p className="text-xs font-semibold tracking-tight text-slate-800">IT Department</p>
        <p className="text-[11px] text-slate-500">Mail Automation System</p>
      </footer>
    </main>
  );
}
