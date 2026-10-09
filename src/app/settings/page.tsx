"use client";


import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { paths } from "@/routes/paths";
import { PageHeading, AppLayout } from "@/components/layout";
import { LoadingState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MailIcon, GmailIcon, UserIcon, LockIcon, LogoutIcon, UsersIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/AuthContext";
import { settingsService, authService, batchesService } from "@/services";
import { http } from "@/services/http";
import type { Batch, ForwardingRule } from "@/types";
import { formatDateTime } from "@/utils/format";
import { validateCcEmail, validateChangePassword } from "@/utils/validation";

function SettingsInner() {
  const { user, logout, role } = useAuth();
  const isAdmin = role === "admin";
  const router = useRouter();
  const oauthParams = useSearchParams();
  const settings = useAsync(() => settingsService.get(), []);
  const batches = useAsync<Batch[]>(() => batchesService.list(), []);
  const rules = useAsync<ForwardingRule[]>(() => http.get<ForwardingRule[]>("/api/rules"), []);
  const members = useAsync<Array<{ email: string; name: string; role: string }>>(
    () => http.get("/api/organizations/members"),
    []
  );
  const auditLog = useAsync<Array<{ id: number; actor: string; action: string; detail: string; createdAt: string }>>(
    () => http.get("/api/audit?limit=30"),
    []
  );
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

  // Workspace name + sender allowlist (admin-managed)
  const [orgName, setOrgName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [allowText, setAllowText] = useState("");
  const [allowSaved, setAllowSaved] = useState(false);
  const [allowError, setAllowError] = useState<string | null>(null);
  const [savingAllow, setSavingAllow] = useState(false);

  // Forwarding rules
  const [ruleOpen, setRuleOpen] = useState(false);
  const [rName, setRName] = useState("");
  const [rTarget, setRTarget] = useState("");
  const [rSubject, setRSubject] = useState("");
  const [rBody, setRBody] = useState("");
  const [rSender, setRSender] = useState("");
  const [rPriority, setRPriority] = useState("0");
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  // Members
  const [mEmail, setMEmail] = useState("");
  const [mRole, setMRole] = useState("member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [busyMember, setBusyMember] = useState<string | null>(null);

  const [disconnecting, setDisconnecting] = useState(false);

  // Manual inbox sync (member-triggered) — POST /api/gmail/sync
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Keep the CC field in sync with loaded settings without fighting the user's typing:
  // adjust during render only when a NEW loaded value arrives (React's "adjust state
  // when a prop changes" pattern — no setState inside an effect).
  const loadedCc = settings.data?.ccEmail;
  const [lastLoadedCc, setLastLoadedCc] = useState<string | null>(null);
  if (loadedCc !== undefined && loadedCc !== lastLoadedCc) {
    setLastLoadedCc(loadedCc);
    setCcEmail(loadedCc);
  }

  const loadedName = settings.data?.organizationName;
  const [lastLoadedName, setLastLoadedName] = useState<string | null>(null);
  if (loadedName !== undefined && loadedName !== lastLoadedName) {
    setLastLoadedName(loadedName);
    setOrgName(loadedName);
  }

  const loadedAllow = settings.data ? settings.data.allowedSenders.join("\n") : undefined;
  const [lastLoadedAllow, setLastLoadedAllow] = useState<string | null>(null);
  if (loadedAllow !== undefined && loadedAllow !== lastLoadedAllow) {
    setLastLoadedAllow(loadedAllow);
    setAllowText(loadedAllow);
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

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const name = orgName.trim();
    if (!name) {
      setNameError("Workspace name is required");
      return;
    }
    setNameError(null);
    setSavingName(true);
    setNameSaved(false);
    try {
      await settingsService.update({ organizationName: name });
      setNameSaved(true);
      settings.reload();
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Unable to save the workspace name.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveAllowlist(e: React.FormEvent) {
    e.preventDefault();
    const list = [...new Set(allowText.split(/[\n,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
    setAllowError(null);
    setSavingAllow(true);
    setAllowSaved(false);
    try {
      await settingsService.update({ allowedSenders: list });
      setAllowSaved(true);
      settings.reload();
    } catch (err) {
      setAllowError(err instanceof Error ? err.message : "Unable to save the allowlist.");
    } finally {
      setSavingAllow(false);
    }
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    setRuleError(null);
    if (!rName.trim()) return setRuleError("Rule name is required");
    if (!rTarget) return setRuleError("Select a target group");
    if (!rSubject.trim() && !rBody.trim()) return setRuleError("Add at least one subject or body keyword");
    setSavingRule(true);
    try {
      await http.post("/api/rules", {
        name: rName.trim(),
        targetBatchId: rTarget,
        subjectKeywords: rSubject,
        bodyKeywords: rBody,
        senderPattern: rSender.trim() || null,
        priority: Number(rPriority) || 0,
        active: true,
      });
      setRuleOpen(false);
      setRName(""); setRTarget(""); setRSubject(""); setRBody(""); setRSender(""); setRPriority("0");
      rules.reload();
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Unable to create the rule.");
    } finally {
      setSavingRule(false);
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      await http.delete(`/api/rules/${id}`);
      rules.reload();
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Unable to delete the rule.");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviting(true);
    try {
      await http.post("/api/organizations/members", { email: mEmail.trim(), role: mRole });
      setMEmail("");
      members.reload();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Unable to add the member.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(email: string) {
    setBusyMember(email);
    try {
      await http.delete(`/api/organizations/members?email=${encodeURIComponent(email)}`);
      members.reload();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Unable to remove the member.");
    } finally {
      setBusyMember(null);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await http.post<{ checked: number; ingested: number; forwarded: number; needsReview: number }>(
        "/api/gmail/sync",
        {}
      );
      setSyncMsg({
        ok: true,
        text: `Checked ${r.checked} · ${r.ingested} new · ${r.forwarded} forwarded · ${r.needsReview} in review`,
      });
      settings.reload();
    } catch (err) {
      setSyncMsg({ ok: false, text: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await http.delete("/api/gmail/connection");
      settings.reload();
    } finally {
      setDisconnecting(false);
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
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
                <Button type="submit" loading={savingCc} disabled={!isAdmin}>
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

          {/* Workspace */}
          <section className="space-y-2" aria-label="Workspace">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-semibold text-slate-800">Workspace</h2>
              {!isAdmin ? (
                <span className="text-[10px] font-medium text-slate-400">View only</span>
              ) : null}
            </div>
            <form onSubmit={handleSaveName} className="space-y-1.5">
              <label htmlFor="org-name" className="block pl-0.5 text-[11px] font-medium text-slate-600">
                Workspace Name
              </label>
              <div
                className={`flex items-center rounded-xl border bg-slate-50/50 px-3.5 py-2.5 shadow-sm transition-all focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 ${
                  nameError ? "border-rose-400" : "border-slate-200"
                }`}
              >
                <UsersIcon className="mr-2.5 h-4 w-4 shrink-0 text-slate-400" />
                <input
                  id="org-name"
                  type="text"
                  value={orgName}
                  disabled={!isAdmin}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    setNameSaved(false);
                  }}
                  placeholder="Workspace name"
                  aria-invalid={!!nameError || undefined}
                  className="w-full border-0 bg-transparent p-0 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
                />
              </div>
              {nameError ? (
                <p role="alert" className="pl-0.5 text-[11px] font-medium text-rose-600">{nameError}</p>
              ) : null}
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" loading={savingName} disabled={!isAdmin}>Save</Button>
                {nameSaved ? (
                  <span role="status" className="text-[11px] font-semibold text-emerald-600">Workspace updated</span>
                ) : null}
              </div>
            </form>
          </section>

          {/* Sender allowlist */}
          <section className="space-y-2" aria-label="Sender allowlist">
            <h2 className="text-xs font-semibold text-slate-800">Allowed Senders</h2>
            <form onSubmit={handleSaveAllowlist} className="space-y-1.5">
              <label htmlFor="allow-senders" className="block pl-0.5 text-[11px] font-medium text-slate-600">
                One email per line — only these senders enter the automatic pipeline
              </label>
              <textarea
                id="allow-senders"
                rows={4}
                value={allowText}
                disabled={!isAdmin}
                onChange={(e) => {
                  setAllowText(e.target.value);
                  setAllowSaved(false);
                }}
                placeholder="sender@example.com"
                aria-invalid={!!allowError || undefined}
                className={`w-full resize-y rounded-xl border bg-white px-3.5 py-2.5 font-mono text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed ${
                  allowError ? "border-rose-400" : "border-slate-200 focus:border-brand-600"
                }`}
              />
              {allowError ? (
                <p role="alert" className="pl-0.5 text-[11px] font-medium text-rose-600">{allowError}</p>
              ) : (
                <p className="pl-0.5 text-[10px] leading-relaxed text-slate-400">
                  Empty list = fail closed: every sender is held for manual review.
                </p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" loading={savingAllow} disabled={!isAdmin}>Save</Button>
                {allowSaved ? (
                  <span role="status" className="text-[11px] font-semibold text-emerald-600">Allowlist updated</span>
                ) : null}
              </div>
            </form>
          </section>

          {/* Members */}
          <section className="space-y-2" aria-label="Workspace members">
            <h2 className="text-xs font-semibold text-slate-800">Members</h2>
            {inviteError ? (
              <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
                {inviteError}
              </p>
            ) : null}
            <ul className="space-y-1.5 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm">
              {(members.data ?? []).map((m) => (
                <li key={m.email} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-slate-800">{m.name}</span>
                    <span className="block truncate text-[10px] text-slate-400">{m.email}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        m.role === "admin" ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {m.role}
                    </span>
                    {isAdmin && m.email !== user?.email ? (
                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(m.email)}
                        disabled={busyMember === m.email}
                        aria-label={`Remove ${m.email}`}
                        className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
              {members.loading && !members.data ? (
                <li className="text-[11px] text-slate-400">Loading members…</li>
              ) : null}
            </ul>
            {isAdmin ? (
              <form onSubmit={handleInvite} className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="member-email" className="mb-1 block pl-0.5 text-[11px] font-medium text-slate-600">
                    Add member by email
                  </label>
                  <input
                    id="member-email"
                    type="email"
                    value={mEmail}
                    onChange={(e) => setMEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Member role"
                  value={mRole}
                  onChange={(e) => setMRole(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <Button type="submit" loading={inviting}>Add</Button>
              </form>
            ) : null}
          </section>

          {/* Forwarding rules */}
          <section className="space-y-2" aria-label="Forwarding rules">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-800">Forwarding Rules</h2>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setRuleOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 transition-transform active:scale-95"
                >
                  <PlusIcon className="h-3.5 w-3.5" /> {ruleOpen ? "Close" : "Add Rule"}
                </button>
              ) : null}
            </div>
            {ruleError ? (
              <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
                {ruleError}
              </p>
            ) : null}
            {ruleOpen ? (
              <form onSubmit={handleCreateRule} className="space-y-2 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
                <div>
                  <label htmlFor="rule-name" className="mb-1 block text-[11px] font-medium text-slate-600">Rule name</label>
                  <input id="rule-name" value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Internship notices"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="rule-target" className="mb-1 block text-[11px] font-medium text-slate-600">Target group</label>
                  <select id="rule-target" value={rTarget} onChange={(e) => setRTarget(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-brand-600 focus:outline-none">
                    <option value="">Select a group…</option>
                    {(batches.data ?? []).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label htmlFor="rule-subject" className="mb-1 block text-[11px] font-medium text-slate-600">Subject keywords</label>
                    <input id="rule-subject" value={rSubject} onChange={(e) => setRSubject(e.target.value)} placeholder="internship, offer"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none" />
                  </div>
                  <div>
                    <label htmlFor="rule-body" className="mb-1 block text-[11px] font-medium text-slate-600">Body keywords</label>
                    <input id="rule-body" value={rBody} onChange={(e) => setRBody(e.target.value)} placeholder="apply, stipend"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none" />
                  </div>
                  <div>
                    <label htmlFor="rule-sender" className="mb-1 block text-[11px] font-medium text-slate-600">Sender (optional)</label>
                    <input id="rule-sender" value={rSender} onChange={(e) => setRSender(e.target.value)} placeholder="hr@example.com"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none" />
                  </div>
                  <div>
                    <label htmlFor="rule-priority" className="mb-1 block text-[11px] font-medium text-slate-600">Priority (higher wins)</label>
                    <input id="rule-priority" type="number" value={rPriority} onChange={(e) => setRPriority(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-brand-600 focus:outline-none" />
                  </div>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  Equal-priority rules targeting different groups send the mail to Needs Review instead of guessing.
                </p>
                <Button type="submit" loading={savingRule} fullWidth>Create Rule</Button>
              </form>
            ) : null}
            <ul className="space-y-1.5">
              {(rules.data ?? []).map((r) => {
                const target = (batches.data ?? []).find((b) => b.id === r.targetBatchId);
                return (
                  <li key={r.id} className="flex items-start justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-slate-900">
                        {r.name} <span className="font-medium text-slate-400">· P{r.priority}</span>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        → {target?.name ?? "Unknown group"}
                        {r.active ? "" : " · inactive"}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-400">
                        {(r.subjectKeywords.length ? `subj: ${r.subjectKeywords.join(", ")} ` : "")}
                        {(r.bodyKeywords.length ? `body: ${r.bodyKeywords.join(", ")}` : "")}
                        {r.senderPattern ? ` · from: ${r.senderPattern}` : ""}
                      </span>
                    </span>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteRule(r.id)}
                        aria-label={`Delete rule ${r.name}`}
                        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
              {rules.loading && !rules.data ? (
                <li className="text-[11px] text-slate-400">Loading rules…</li>
              ) : rules.data && rules.data.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">
                  No rules yet — group names in subjects/bodies are detected automatically; rules add keyword-based routing.
                </li>
              ) : null}
            </ul>
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
                  disabled={toggling || !isAdmin}
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
                <div className="flex shrink-0 items-center gap-1.5">
                  {s.gmailConnected ? (
                    <button
                      type="button"
                      onClick={handleSyncNow}
                      disabled={syncing}
                      className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {syncing ? "Syncing…" : "Sync Now"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => {
                      // Full page load is required: the server responds with a 302 to Google's consent screen.
                      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                      window.location.href = "/api/gmail/connect";
                    }}
                    className="rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reconnect
                  </button>
                  {s.gmailConnected && isAdmin ? (
                    <button
                      type="button"
                      onClick={() => void handleDisconnect()}
                      disabled={disconnecting}
                      className="rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition-transform active:scale-95 disabled:opacity-50"
                    >
                      {disconnecting ? "Disconnecting…" : "Disconnect"}
                    </button>
                  ) : null}
                </div>
              </div>
              {syncMsg ? (
                <p
                  role={syncMsg.ok ? "status" : "alert"}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium ${
                    syncMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {syncMsg.text}
                </p>
              ) : null}
              {s.lastSyncedAt ? (
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                  <span>Last synced: {formatDateTime(s.lastSyncedAt)}</span>
                </div>
              ) : null}
            </div>
          </section>

          {/* Audit history */}
          {isAdmin ? (
            <section className="space-y-2" aria-label="Audit history">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-800">Audit History</h2>
                <button
                  type="button"
                  onClick={auditLog.reload}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-700"
                >
                  Refresh
                </button>
              </div>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                {(auditLog.data ?? []).map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-800">{e.action}</span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {e.actor}
                        {e.detail ? ` · ${e.detail}` : ""}
                      </span>
                    </span>
                    <time className="shrink-0 text-[10px] font-medium text-slate-400">
                      {formatDateTime(e.createdAt)}
                    </time>
                  </li>
                ))}
                {auditLog.loading && !auditLog.data ? (
                  <li className="px-3.5 py-3 text-[11px] text-slate-400">Loading history…</li>
                ) : auditLog.data && auditLog.data.length === 0 ? (
                  <li className="px-3.5 py-3 text-[11px] text-slate-400">No recorded events yet.</li>
                ) : null}
                {auditLog.error ? (
                  <li className="px-3.5 py-3 text-[11px] font-medium text-rose-600">{auditLog.error}</li>
                ) : null}
              </ul>
            </section>
          ) : null}

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
