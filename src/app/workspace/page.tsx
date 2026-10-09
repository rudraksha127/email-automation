"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { paths } from "@/routes/paths";
import { useAuth } from "@/hooks/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/EmptyState";
import { GraduationCapIcon, ArrowRightIcon, UserIcon } from "@/components/icons";
import { http } from "@/services/http";

/**
 * Workspace picker — shown when a user belongs to one or more workspaces.
 * Selecting a workspace binds it server-side to the session (membership is
 * verified there); creating one makes the user its admin.
 */
export default function WorkspacePage() {
  const { user, orgs, orgId, switchWorkspace, logout, initializing } = useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [busy, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (initializing) return <LoadingState label="Restoring session…" />;
  if (!user) return <LoadingState label="Redirecting to login…" />;

  async function pick(id: string) {
    setError(null);
    setOpenId(id);
    try {
      await switchWorkspace(id);
      router.replace(paths.dashboard);
      // Full navigation guarantees every screen refetches workspace data.
      window.location.assign(paths.dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to select that workspace.");
      setOpenId(null);
    }
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setCreateError("Workspace name is required");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const org = await http.post<{ id: string }>("/api/organizations", { name });
      await switchWorkspace(org.id);
      window.location.assign(paths.dashboard);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to create the workspace.");
      setCreating(false);
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

      <section className="mb-6">
        <h1 className="mb-1.5 text-[28px] font-black tracking-tight text-slate-900">
          Choose a Workspace
        </h1>
        <p className="text-sm leading-relaxed text-slate-500">
          Select the workspace to manage, or create a new one. Signed in as {user.email}.
        </p>
      </section>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
          You are not a member of any workspace yet. Create your first workspace below, or ask an
          administrator to invite you to theirs.
        </p>
      ) : (
        <ul className="space-y-2.5" aria-label="Workspaces">
          {orgs.map((o) => (
            <li key={o.orgId}>
              <button
                type="button"
                onClick={() => void pick(o.orgId)}
                disabled={busy !== null}
                className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left shadow-sm transition-colors ${
                  busy === o.orgId
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200/90 bg-white hover:border-brand-200"
                }`}
              >
                <span className="flex min-w-0 items-center space-x-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <UserIcon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">{o.name}</span>
                    <span className="block text-[11px] font-medium capitalize text-slate-400">
                      {o.role}
                      {o.orgId === orgId ? " · active" : ""}
                    </span>
                  </span>
                </span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={createWorkspace} className="mt-8 space-y-3" aria-label="Create workspace">
        <h2 className="text-xs font-semibold text-slate-800">Create a Workspace</h2>
        <Input
          label="Workspace name"
          id="workspace-name"
          name="workspace-name"
          placeholder="e.g. Placement Cell"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          error={createError ?? undefined}
        />
        <Button type="submit" fullWidth loading={creating} className="py-3.5 text-sm">
          Create Workspace
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </form>

      <footer className="mt-auto pt-10">
        <button
          type="button"
          onClick={() => void logout().then(() => router.replace(paths.login))}
          className="mx-auto block text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          Sign out ({user.email})
        </button>
      </footer>
    </main>
  );
}
