"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { paths } from "@/routes/paths";
import { useAuth } from "@/hooks/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GraduationCapIcon, MailIcon, LockIcon, UserIcon, ArrowRightIcon } from "@/components/icons";

/**
 * Create an account. Registration grants NO workspace privileges — new users
 * start with no memberships and either create their own workspace or get
 * invited to one by an existing workspace admin.
 */
export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string | undefined> = {};
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address";
    if (password.length < 8) next.password = "Password must be at least 8 characters";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await register(email.trim().toLowerCase(), password, name.trim());
      router.replace(paths.workspace);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to create the account.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-white px-6 pb-8 pt-10">
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

      <section className="mb-8">
        <h1 className="mb-1.5 text-[28px] font-black tracking-tight text-slate-900">
          Create Account
        </h1>
        <p className="text-sm leading-relaxed text-slate-500">
          Register to create your own workspace or join one you are invited to.
        </p>
      </section>

      <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-label="Create account">
        <Input
          label="Your Name"
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Jane Doe"
          icon={<UserIcon className="h-5 w-5" />}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <Input
          label="Email Address"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@organization.example"
          icon={<MailIcon className="h-5 w-5" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Input
          label="Password"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          icon={<LockIcon className="h-5 w-5" />}
          passwordToggle
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        {formError ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700"
          >
            {formError}
          </p>
        ) : null}

        <Button type="submit" fullWidth loading={submitting} className="py-3.5 text-sm">
          Create Account
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </form>

      <footer className="mt-auto pt-10 text-center">
        <p className="text-xs font-medium text-slate-500">
          Already have an account?{" "}
          <Link href={paths.login} className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </footer>
    </main>
  );
}
