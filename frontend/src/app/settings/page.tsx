"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { paths } from "@/routes/paths";
import { PageHeading, AppLayout } from "@/components/layout";
import { LoadingState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  MailIcon,
  GmailIcon,
  UserIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ChevronRightIcon,
  ShieldIcon,
} from "@/components/icons";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/AuthContext";
import { settingsService, batchesService } from "@/services";
import { http } from "@/services/http";
import type { Batch, ForwardingRule } from "@/types";
import { formatDateTime } from "@/utils/format";
import { validateCcEmail } from "@/utils/validation";

function SettingsInner() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const oauthParams = useSearchParams();

  // Async data
  const settings = useAsync(() => settingsService.get(), []);
  const batches = useAsync<Batch[]>(() => batchesService.list(), []);
  const rules = useAsync<ForwardingRule[]>(() => http.get<ForwardingRule[]>("/api/rules"), []);
  const auditLog = useAsync<Array<{ id: number; actor: string; action: string; detail: string; createdAt: string }>>(
    () => http.get("/api/audit?limit=20"),
    []
  );

  const oauthError = oauthParams.get("gmailError");
  const oauthConnected = oauthParams.get("gmailConnected") === "1";

  // Form states
  const [ccEmail, setCcEmail] = useState("");
  const [ccError, setCcError] = useState<string | null>(null);
  const [savingCc, setSavingCc] = useState(false);
  const [ccSaved, setCcSaved] = useState(false);

  const [toggling, setToggling] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  // Sender allowlist chip management
  const [newSenderEmail, setNewSenderEmail] = useState("");
  const [senderMsg, setSenderMsg] = useState<string | null>(null);
  const [savingSenders, setSavingSenders] = useState(false);

  // Manual inbox sync
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Advanced section collapsible toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Forwarding rules modal
  const [ruleOpen, setRuleOpen] = useState(false);
  const [rName, setRName] = useState("");
  const [rTarget, setRTarget] = useState("");
  const [rSubject, setRSubject] = useState("");
  const [rSender, setRSender] = useState("");
  const [savingRule, setSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Adjust state during render when new data arrives
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
      setTimeout(() => setCcSaved(false), 2000);
    } catch (err) {
      setCcError(err instanceof Error ? err.message : "Unable to save CC email.");
    } finally {
      setSavingCc(false);
    }
  }

  async function handleToggleForwarding() {
    if (!settings.data || toggling || !isAdmin) return;
    setToggling(true);
    try {
      await settingsService.update({ autoForwarding: !settings.data.autoForwarding });
      settings.reload();
    } finally {
      setToggling(false);
    }
  }

  async function handleAddSender(e: React.FormEvent) {
    e.preventDefault();
    const email = newSenderEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.includes("@")) {
      setSenderMsg("Please enter a valid email address");
      return;
    }

    const currentList = settings.data?.allowedSenders ?? [];
    if (currentList.includes(email)) {
      setSenderMsg("Sender is already in the allowed list");
      return;
    }

    setSavingSenders(true);
    setSenderMsg(null);
    try {
      const nextList = [...currentList, email];
      await settingsService.update({ allowedSenders: nextList });
      setNewSenderEmail("");
      settings.reload();
    } catch (err) {
      setSenderMsg(err instanceof Error ? err.message : "Could not add sender");
    } finally {
      setSavingSenders(false);
    }
  }

  async function handleRemoveSender(emailToRemove: string) {
    if (!isAdmin) return;
    const currentList = settings.data?.allowedSenders ?? [];
    const nextList = currentList.filter((s) => s !== emailToRemove);
    setSavingSenders(true);
    try {
      await settingsService.update({ allowedSenders: nextList });
      settings.reload();
    } catch (err) {
      setSenderMsg(err instanceof Error ? err.message : "Could not remove sender");
    } finally {
      setSavingSenders(false);
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
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Could not update workspace name");
    } finally {
      setSavingName(false);
    }
  }

  async function handleManualSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await http.post<{ newCount: number; forwardedCount: number }>("/api/gmail/sync", {});
      setSyncMsg({
        ok: true,
        text: `Sync complete: ${res.newCount} new, ${res.forwardedCount} forwarded`,
      });
      setTimeout(() => setSyncMsg(null), 3500);
    } catch (err) {
      setSyncMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Sync failed",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnectGmail() {
    if (!confirm("Are you sure you want to disconnect this Gmail mailbox?")) return;
    setDisconnecting(true);
    try {
      await http.delete("/api/gmail/connection");
      settings.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not disconnect Gmail");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    if (!rName.trim() || !rTarget) {
      setRuleError("Rule name and target batch are required");
      return;
    }
    setSavingRule(true);
    setRuleError(null);
    try {
      await http.post("/api/rules", {
        name: rName.trim(),
        targetBatchId: rTarget,
        subjectKeywords: rSubject.trim(),
        senderPattern: rSender.trim(),
      });
      setRuleOpen(false);
      setRName("");
      setRTarget("");
      setRSubject("");
      setRSender("");
      rules.reload();
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Could not create rule");
    } finally {
      setSavingRule(false);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm("Delete this rule?")) return;
    try {
      await http.delete(`/api/rules/${id}`);
      rules.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete rule");
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
  const isGmailConnected = !!s?.gmailConnected;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-5 pb-8">
        <PageHeading
          title="Automation Settings"
          subtitle="Configure department forwarding rules and mailbox connections"
        />

        {/* Profile Navigation Shortcut Banner */}
        <Link
          href={paths.profile}
          className="flex items-center justify-between rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 p-4 shadow-xs transition-all hover:border-blue-200 hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 sm:text-sm">
                Institutional Profile & Account Settings
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Manage passwords, active sessions, and faculty permissions in the Profile page
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-blue-700">
            <span className="hidden sm:inline">Go to Profile</span>
            <ChevronRightIcon className="h-4 w-4" />
          </div>
        </Link>

        {/* OAuth Feedback Banners */}
        {oauthError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircleIcon className="h-4 w-4 shrink-0 text-rose-600" />
            <span>Gmail connection could not be completed: {oauthError}</span>
          </div>
        )}
        {oauthConnected && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Gmail mailbox connected successfully! Automatic polling is active.</span>
          </div>
        )}

        {/* Card 1: Forwarding Automation */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Forwarding Engine</h2>
              <p className="text-[11px] text-slate-500">
                Automated matching of incoming emails to student batches
              </p>
            </div>
            {/* Auto-forwarding toggle */}
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-semibold ${
                  s?.autoForwarding ? "text-emerald-700" : "text-slate-400"
                }`}
              >
                {s?.autoForwarding ? "Automated" : "Paused"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={s?.autoForwarding}
                disabled={!isAdmin || toggling}
                onClick={handleToggleForwarding}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed ${
                  s?.autoForwarding ? "bg-emerald-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    s?.autoForwarding ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* IT Department CC Email */}
          <form onSubmit={handleSaveCc} className="mt-4 space-y-2">
            <label htmlFor="cc-input" className="block text-xs font-semibold text-slate-700">
              Department CC Email Address
            </label>
            <p className="text-[11px] text-slate-400">
              Added as CC on all outgoing automated forwards for departmental audit and archiving.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <MailIcon className="h-4 w-4" />
                </div>
                <input
                  id="cc-input"
                  type="email"
                  value={ccEmail}
                  onChange={(e) => {
                    setCcEmail(e.target.value);
                    setCcSaved(false);
                  }}
                  placeholder="it@acropolis.in"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>
              <Button type="submit" loading={savingCc} disabled={!isAdmin}>
                Save CC
              </Button>
            </div>
            {ccError && <p className="text-[11px] font-medium text-rose-600">{ccError}</p>}
            {ccSaved && <p className="text-[11px] font-medium text-emerald-600">CC email updated successfully</p>}
          </form>
        </div>

        {/* Card 2: Gmail Mailbox Connection */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <GmailIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Gmail Mailbox Integration</h2>
                <p className="text-[11px] text-slate-500">
                  Target mailbox:{" "}
                  <span className="font-semibold text-slate-700">
                    {s?.gmailAccount || "rudraksha240036@acropolis.in"}
                  </span>
                </p>
              </div>
            </div>

            <div>
              {isGmailConnected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Not Connected
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-500">
              {isGmailConnected
                ? "Background sync polls every 60 seconds automatically. You can also trigger an instant manual sync."
                : "Authorize Google OAuth credentials to connect the target Gmail inbox for live processing."}
            </p>

            <div className="flex items-center gap-2 shrink-0">
              {isGmailConnected ? (
                <>
                  <Button
                    variant="secondary"
                    loading={syncing}
                    onClick={handleManualSync}
                    className="text-xs"
                  >
                    Sync Inbox Now
                  </Button>
                  <Button
                    variant="ghost"
                    loading={disconnecting}
                    onClick={handleDisconnectGmail}
                    className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <a
                  href="/api/gmail/connect"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                >
                  <GmailIcon className="h-4 w-4" />
                  Connect Gmail
                </a>
              )}
            </div>
          </div>

          {syncMsg && (
            <div
              className={`mt-3 rounded-lg p-2.5 text-xs font-medium ${
                syncMsg.ok
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {syncMsg.text}
            </div>
          )}
        </div>

        {/* Card 3: Authorized Senders (Interactive Allowlist) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Authorized Senders Allowlist</h2>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                {s?.allowedSenders.length ?? 0} authorized
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Only incoming emails from these addresses are eligible for automatic forwarding. All others are safely held for review.
            </p>
          </div>

          {/* Senders Chips List */}
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {s?.allowedSenders && s.allowedSenders.length > 0 ? (
                s.allowedSenders.map((sender) => (
                  <span
                    key={sender}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs"
                  >
                    <MailIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span>{sender}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSender(sender)}
                        disabled={savingSenders}
                        title="Remove sender"
                        className="ml-1 text-slate-400 hover:text-rose-600 focus:outline-none"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))
              ) : (
                <p className="text-xs text-amber-700 font-medium">
                  No authorized senders configured. (Fail-closed: all incoming emails will be held for review)
                </p>
              )}
            </div>

            {/* Quick Add Sender Input */}
            {isAdmin && (
              <form onSubmit={handleAddSender} className="mt-4 flex gap-2">
                <input
                  type="email"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                  placeholder="Add new authorized email (e.g. luckyudiya@gmail.com)"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
                <Button type="submit" loading={savingSenders} className="shrink-0 text-xs">
                  <PlusIcon className="mr-1 h-3.5 w-3.5" />
                  Add Sender
                </Button>
              </form>
            )}

            {senderMsg && (
              <p className="mt-2 text-[11px] font-medium text-rose-600">{senderMsg}</p>
            )}
          </div>
        </div>

        {/* Card 4: Workspace Information */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">Workspace Details</h2>
          <p className="text-[11px] text-slate-500">
            Active workspace identity within the multi-tenant departmental database
          </p>

          <form onSubmit={handleSaveName} className="mt-4 flex gap-2">
            <input
              type="text"
              value={orgName}
              disabled={!isAdmin}
              onChange={(e) => {
                setOrgName(e.target.value);
                setNameSaved(false);
              }}
              placeholder="Workspace name"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none disabled:cursor-not-allowed"
            />
            <Button type="submit" loading={savingName} disabled={!isAdmin} className="text-xs">
              Save Name
            </Button>
          </form>
          {nameError && <p className="mt-1 text-[11px] text-rose-600">{nameError}</p>}
          {nameSaved && <p className="mt-1 text-[11px] text-emerald-600">Workspace name updated</p>}
        </div>

        {/* Card 5: Advanced (Collapsible Accordion) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50/80"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <ShieldIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 sm:text-sm">
                  Advanced Rules & Audit Logs
                </p>
                <p className="text-[11px] text-slate-400">
                  Keyword overrides, custom routing patterns, and security audit history
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-600">
              {showAdvanced ? "Hide" : "Show"}
            </span>
          </button>

          {showAdvanced && (
            <div className="border-t border-slate-100 p-5 space-y-5 bg-slate-50/30">
              {/* Custom Forwarding Rules */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Custom Keyword Rules ({rules.data?.length ?? 0})
                  </h3>
                  {isAdmin && (
                    <Button onClick={() => setRuleOpen(true)}>
                      <PlusIcon className="mr-1 h-3 w-3" />
                      New Rule
                    </Button>
                  )}
                </div>

                {rules.data && rules.data.length > 0 ? (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
                    {rules.data.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-3 text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{r.name}</p>
                          <p className="text-[11px] text-slate-500">
                            Keywords: {r.subjectKeywords || "None"} → Target:{" "}
                            {batches.data?.find((b) => b.id === r.targetBatchId)?.name || r.targetBatchId}
                          </p>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(r.id)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No custom keyword rules. Built-in batch detection (2027, 2028) is active.
                  </p>
                )}
              </div>

              {/* Audit Log */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Recent System Audit Events
                </h3>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 text-xs">
                  {auditLog.data && auditLog.data.length > 0 ? (
                    auditLog.data.map((a) => (
                      <div key={a.id} className="p-2.5">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-700">{a.action}</span>
                          <span>{formatDateTime(a.createdAt)}</span>
                        </div>
                        <p className="text-slate-600 text-[11px] truncate mt-0.5">{a.detail}</p>
                      </div>
                    ))
                  ) : (
                    <p className="p-3 text-xs text-slate-400">No audit events recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Rule Modal */}
      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title="New Forwarding Rule">
        <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">Rule Name</label>
            <input
              type="text"
              required
              value={rName}
              onChange={(e) => setRName(e.target.value)}
              placeholder="e.g. Placement Mail Routing"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700">Target Student Batch</label>
            <select
              required
              value={rTarget}
              onChange={(e) => setRTarget(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            >
              <option value="">Select target batch</option>
              {batches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.recipientCount} recipients)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700">Subject Keywords (comma separated)</label>
            <input
              type="text"
              value={rSubject}
              onChange={(e) => setRSubject(e.target.value)}
              placeholder="e.g. 2027, campus drive"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700">Sender Filter (optional)</label>
            <input
              type="text"
              value={rSender}
              onChange={(e) => setRSender(e.target.value)}
              placeholder="e.g. tpo@acropolis.in"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>

          {ruleError && <p className="text-rose-600 font-medium">{ruleError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRuleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={savingRule}>
              Save Rule
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <LoadingState label="Loading settings…" />
        </AppLayout>
      }
    >
      <SettingsInner />
    </Suspense>
  );
}
