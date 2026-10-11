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
    <main className="flex min-h-dvh flex-col bg-surface px-6 pb-8 pt-10">
      <section className="mb-8 flex items-center space-x-3" aria-label="Department">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
          <GraduationCapIcon className="h-6 w-6" />
        </span>
        <span>
          <span className="block text-base font-bold leading-tight tracking-tight text-on-surface">
            IT Department
          </span>
          <span className="block text-xs font-medium text-on-surface-variant">Mail Automation</span>
        </span>
      </section>

      <section className="mb-6">
        <h1 className="mb-1.5 text-2xl sm:text-[26px] font-bold tracking-tight text-on-surface">
          Choose a Workspace
        </h1>
        <p className="text-sm leading-relaxed text-on-surface-variant">
          Select the workspace to manage, or create a new one. Signed in as {user.email}.
        </p>
      </section>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-error/20 bg-error-container px-4 py-2.5 text-xs font-medium text-on-error-container">
          {error}
        </p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="mb-4 rounded-xl border border-slate-200/80 bg-surface-container-low px-4 py-3 text-xs font-medium text-on-surface-variant">
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
                className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left shadow-card transition-all ${
                  busy === o.orgId
                    ? "border-primary bg-primary-fixed/40"
                    : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-surface-container-low/40"
                }`}
              >
                <span className="flex min-w-0 items-center space-x-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
                    <UserIcon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-on-surface">{o.name}</span>
                    <span className="block text-[11px] font-medium capitalize text-on-surface-variant">
                      {o.role}
                      {o.orgId === orgId ? " · active" : ""}
                    </span>
                  </span>
                </span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-on-surface-variant/60" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={createWorkspace} className="mt-8 space-y-3" aria-label="Create workspace">
        <h2 className="text-xs font-semibold text-on-surface">Create a Workspace</h2>
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
          className="mx-auto block text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
        >
          Sign out ({user.email})
        </button>
      </footer>
    </main>
  );
}
