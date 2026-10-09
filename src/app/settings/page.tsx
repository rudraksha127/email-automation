"use client";


import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { paths } from "@/routes/paths";
import { PageHeading, AppLayout } from "@/components/layout";
import { LoadingState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MailIcon, GmailIcon, UserIcon, LockIcon, LogoutIcon, UsersIcon } from "@/components/icons";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/AuthContext";
import { settingsService, authService } from "@/services";
import { formatDateTime } from "@/utils/format";
import { validateCcEmail, validateChangePassword } from "@/utils/validation";

function SettingsInner() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const oauthParams = useSearchParams();
  const settings = useAsync(() => settingsService.get(), []);
  // OAuth callback results (?gmailError=… / ?gmailConnected=1) — read at render time.
  const oauthError = oauthParams.get("gmailError");
  const oauthConnected = oauthParams.get("gmailConnected") === "1";

  const [ccEmail, setCcEmail] = useState("");
  const [ccError, setCcError] = useState<string | null>(null);
  const [savingCc, setSavingCc] = useState(false);
  const [ccSaved, setCcSaved] = useState(false);

  const [toggling, setToggling] = useState(false);

  // Change password modal state
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string | undefined>>({});
  const [pwApiError, setPwApiError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  // Keep the CC field in sync with loaded settings without fighting the user's typing:
  // adjust during render only when a NEW loaded value arrives (React's "adjust state
  // when a prop changes" pattern — no setState inside an effect).
  const loadedCc = settings.data?.ccEmail;
  const [lastLoadedCc, setLastLoadedCc] = useState<string | null>(null);
  if (loadedCc !== undefined && loadedCc !== lastLoadedCc) {
    setLastLoadedCc(loadedCc);
    setCcEmail(loadedCc);
  }

  async function handleSaveCc(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateCcEmail(ccEmail);
    if (errors.ccEmail) {
      setCcError(errors.ccEmail);
      return;
    }
    setCcError(null);
    setSavingCc(true);
    setCcSaved(false);
    try {
      await settingsService.update({ ccEmail: ccEmail.trim() });
      setCcSaved(true);
      settings.reload();
    } catch (err) {
      setCcError(err instanceof Error ? err.message : "Unable to save the CC email.");
    } finally {
      setSavingCc(false);
    }
  }

  async function handleToggleAutomation() {
    if (!settings.data) return;
    setToggling(true);
    try {
      await settingsService.update({ autoForwarding: !settings.data.autoForwarding });
      settings.reload();
    } finally {
      setToggling(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateChangePassword(current, next, confirm);
    setPwErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setPwApiError(null);
    setSavingPw(true);
    try {
      await authService.changePassword(current, next);
      setPwSaved(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setPwApiError(err instanceof Error ? err.message : "Unable to change the password.");
    } finally {
      setSavingPw(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace(paths.login);
    } finally {
      setLoggingOut(false);
    }
  }

  if (settings.loading && !settings.data) {
    return (
      <AppLayout>
        <LoadingState label="Loading settings…" />
      </AppLayout>
    );
  }

  if (settings.error && !settings.data) {
    return (
      <AppLayout>
        <ErrorState message={settings.error} onRetry={settings.reload} />
      </AppLayout>
    );
  }

  const s = settings.data;

  return (
    <AppLayout>
      <PageHeading title="Settings" subtitle="Configure automation and account" />

      {s ? (
        <div className="space-y-6">
          {/* Department Settings */}
          <section className="space-y-2" aria-label="Department settings">
            <h2 className="text-xs font-semibold text-slate-800">Department Settings</h2>
            <form onSubmit={handleSaveCc} className="space-y-1.5">
              <label
                htmlFor="cc-email"
                className="block pl-0.5 text-[11px] font-medium text-slate-600"
              >
                IT Department CC Email
              </label>
              <div
                className={`flex items-center rounded-xl border bg-slate-50/50 px-3.5 py-2.5 shadow-sm transition-all focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 ${
                  ccError ? "border-rose-400" : "border-slate-200"
                }`}
              >
                <MailIcon className="mr-2.5 h-4 w-4 shrink-0 text-slate-400" />
                <input
                  id="cc-email"
                  type="email"
                  value={ccEmail}
                  onChange={(e) => {
                    setCcEmail(e.target.value);
                    setCcSaved(false);
                  }}
                  placeholder="name@domain.in"
                  aria-invalid={!!ccError || undefined}
                  className="w-full border-0 bg-transparent p-0 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                />
              </div>
              {ccError ? (
                <p role="alert" className="pl-0.5 text-[11px] font-medium text-rose-600">
                  {ccError}
                </p>
              ) : (
                <p className="pl-0.5 text-[10px] leading-relaxed text-slate-400">
                  This email will be added as CC in all forwarded mails.
                </p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" loading={savingCc}>
                  Save
                </Button>
                {ccSaved ? (
                  <span role="status" className="text-[11px] font-semibold text-emerald-600">
                    CC email updated
                  </span>
                ) : null}
              </div>
            </form>
          </section>

          {/* Automation */}
          <section className="space-y-2" aria-label="Automation">
            <h2 className="text-xs font-semibold text-slate-800">Automation</h2>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
              <div className="flex items-start space-x-3 pr-2">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <UsersIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold leading-tight text-slate-900">
                    Auto Forwarding
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                    Automatically forward mails when batch is detected.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={s.autoForwarding}
                  disabled={toggling}
                  onChange={handleToggleAutomation}
                  aria-label="Auto forwarding"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
              </label>
            </div>
          </section>

          {/* Gmail connection */}
          <section className="space-y-2" aria-label="Gmail connection">
            <h2 className="text-xs font-semibold text-slate-800">Gmail Connection</h2>
            {oauthError ? (
              <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
                {oauthError}
              </p>
            ) : oauthConnected && s.gmailConnected ? (
              <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
                Gmail connected successfully as {s.gmailAccount ?? "account"}.
              </p>
            ) : null}
            <div className="space-y-2.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
                    <GmailIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-semibold leading-none text-slate-900">
                        {s.gmailConnected ? "Connected" : "Not Connected"}
                      </span>
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          s.gmailConnected ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-1 text-[10px] font-medium leading-tight text-slate-500">
                      {s.gmailAccount ?? "No account connected"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Full page load is required: the server responds with a 302 to Google's consent screen.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.href = "/api/gmail/connect";
                  }}
                  className="rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 transition-transform active:scale-95"
                >
                  Reconnect
                </button>
              </div>
              {s.lastSyncedAt ? (
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                  <span>Last synced: {formatDateTime(s.lastSyncedAt)}</span>
                </div>
              ) : null}
            </div>
          </section>

          {/* Admin account */}
          <section className="space-y-3 pt-0.5" aria-label="Admin account">
            <h2 className="text-xs font-semibold text-slate-800">Admin Account</h2>
            <div className="flex items-center space-x-3 px-1">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600">
                <UserIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold leading-tight text-slate-900">Admin Email</p>
                <p className="text-[11px] text-slate-500">{user?.email ?? "—"}</p>
              </div>
            </div>
            <Button variant="secondary" fullWidth onClick={() => setPwOpen(true)}>
              <LockIcon className="h-3.5 w-3.5 text-slate-700" />
              <span>Change Password</span>
            </Button>
            <Button variant="danger" fullWidth loading={loggingOut} onClick={handleLogout}>
              <LogoutIcon className="h-3.5 w-3.5" />
              <span>Logout</span>
            </Button>
          </section>

          <div className="h-2" />
        </div>
      ) : null}

      {/* Change password modal */}
      <Modal
        open={pwOpen}
        onClose={() => {
          setPwOpen(false);
          setPwSaved(false);
          setPwApiError(null);
        }}
        title="Change Password"
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setPwOpen(false);
                setPwSaved(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="pw-form" loading={savingPw} fullWidth>
              Update
            </Button>
          </>
        }
      >
        <form id="pw-form" onSubmit={handleChangePassword} noValidate className="space-y-4">
          {pwSaved ? (
            <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              Password updated successfully.
            </p>
          ) : null}
          {pwApiError ? (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {pwApiError}
            </p>
          ) : null}
          {(
            [
              { id: "pw-current", label: "Current Password", value: current, set: setCurrent, err: pwErrors.currentPassword, autoComplete: "current-password" },
              { id: "pw-next", label: "New Password", value: next, set: setNext, err: pwErrors.newPassword, autoComplete: "new-password" },
              { id: "pw-confirm", label: "Confirm New Password", value: confirm, set: setConfirm, err: pwErrors.confirmPassword, autoComplete: "new-password" },
            ] as const
          ).map((f) => (
            <div key={f.id}>
              <label htmlFor={f.id} className="mb-1.5 block text-xs font-semibold text-slate-700">
                {f.label}
              </label>
              <input
                id={f.id}
                type="password"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                autoComplete={f.autoComplete}
                aria-invalid={!!f.err || undefined}
                className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none ${
                  f.err ? "border-rose-400" : "border-slate-200 focus:border-brand-600"
                }`}
              />
              {f.err ? (
                <p role="alert" className="mt-1 text-[11px] font-medium text-rose-600">
                  {f.err}
                </p>
              ) : null}
            </div>
          ))}
        </form>
      </Modal>
    </AppLayout>
  );
}

/** useSearchParams requires a Suspense boundary when prerendering. */
export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading settings…" />}>
      <SettingsInner />
    </Suspense>
  );
}
