"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingState } from "@/components/ui/EmptyState";
import {
  KeyIcon,
  ShieldIcon,
  DevicesIcon,
  UsersIcon,
  UserCheckIcon,
  HelpCircleIcon,
  InfoIcon,
  LogoutIcon,
  ChevronRightIcon,
  BuildingIcon,
} from "@/components/icons";
import { useAuth } from "@/hooks/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { paths } from "@/routes/paths";
import { authService } from "@/services";
import { http } from "@/services/http";
import { validateChangePassword } from "@/utils/validation";
import { DeveloperModal } from "@/components/DeveloperModal";
import type { ProfileResponse } from "@/app/api/auth/profile/route";

interface OrgMember {
  email: string;
  name: string;
  role: "admin" | "member";
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, refresh } = useAuth();

  const profileState = useAsync<ProfileResponse>(
    () => http.get<ProfileResponse>("/api/auth/profile"),
    []
  );
  const facultyState = useAsync<OrgMember[]>(
    () => http.get<OrgMember[]>("/api/organizations/members"),
    []
  );

  const profile = profileState.data ?? {
    name: user?.name || "Prof. (Dr.) Prashant Lakkadwala",
    email: user?.email || "hodit@acropolis.in",
    employeeId: "HOD-IT-001",
    roleTitle: "Role: HOD",
    status: "Active",
    departmentScope: "IT & CSE-DS",
    activeBatches: "2nd, 3rd & 4th Year",
    institution: "Acropolis Institute of Technology And Research Indore",
    department: "IT Department",
    academicSession: "Academic Session 2026–27",
  };

  const facultyList = facultyState.data ?? [];

  // Modals state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);
  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [appInfoModalOpen, setAppInfoModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [devModalOpen, setDevModalOpen] = useState(false);

  // Edit profile form
  const [nameInput, setNameInput] = useState("");
  const [roleTitleInput, setRoleTitleInput] = useState("");
  const [empIdInput, setEmpIdInput] = useState("");
  const [deptScopeInput, setDeptScopeInput] = useState("");
  const [batchesInput, setBatchesInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Sync form inputs whenever fresh profile data arrives from server (only when not actively editing)
  useEffect(() => {
    if (profileState.data && !editProfileOpen) {
      setNameInput(profileState.data.name);
      setRoleTitleInput(profileState.data.roleTitle || "Role: HOD");
      setEmpIdInput(profileState.data.employeeId);
      setDeptScopeInput(profileState.data.departmentScope);
      setBatchesInput(profileState.data.activeBatches);
    }
  }, [profileState.data, editProfileOpen]);

  /** Populate form inputs with current profile values and open the edit modal */
  function handleOpenEdit() {
    setNameInput(profile.name);
    setRoleTitleInput(profile.roleTitle || "Role: HOD");
    setEmpIdInput(profile.employeeId);
    setDeptScopeInput(profile.departmentScope);
    setBatchesInput(profile.activeBatches);
    setProfileMsg(null);
    setProfileError(null);
    setEditProfileOpen(true);
  }

  // Change password form
  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string | undefined>>({});
  const [pwApiError, setPwApiError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  // Faculty management
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [facultyMsg, setFacultyMsg] = useState<string | null>(null);

  // Transfer HOD
  const [transferTargetEmail, setTransferTargetEmail] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState<string | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    setProfileError(null);
    try {
      await http.patch<ProfileResponse>("/api/auth/profile", {
        name: nameInput.trim(),
        roleTitle: roleTitleInput.trim(),
        employeeId: empIdInput.trim(),
        departmentScope: deptScopeInput.trim(),
        activeBatches: batchesInput.trim(),
      });
      profileState.reload();
      await refresh();
      setProfileMsg("Profile updated successfully");
      setTimeout(() => setEditProfileOpen(false), 900);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateChangePassword(currentPw, nextPw, confirmPw);
    setPwErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPw(true);
    setPwApiError(null);
    try {
      await authService.changePassword(currentPw, nextPw);
      setPwSaved(true);
      setCurrentPw("");
      setNextPw("");
      setConfirmPw("");
      setTimeout(() => {
        setChangePasswordOpen(false);
        setPwSaved(false);
      }, 1200);
    } catch (err) {
      setPwApiError(err instanceof Error ? err.message : "Password update failed.");
    } finally {
      setSavingPw(false);
    }
  }

  async function handleInviteFaculty(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setFacultyMsg(null);
    try {
      await http.post("/api/organizations/members", {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      });
      setInviteEmail("");
      setFacultyMsg("Faculty member added successfully");
      facultyState.reload();
    } catch (err) {
      setFacultyMsg(err instanceof Error ? err.message : "Could not add faculty");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveFaculty(email: string) {
    if (!confirm(`Are you sure you want to remove ${email}?`)) return;
    try {
      await http.delete(`/api/organizations/members?email=${encodeURIComponent(email)}`);
      facultyState.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove member");
    }
  }

  async function handleTransferOwnership(e: React.FormEvent) {
    e.preventDefault();
    if (!transferTargetEmail.trim()) return;
    setTransferring(true);
    setTransferMsg(null);
    try {
      await http.post("/api/organizations/members", {
        email: transferTargetEmail.trim().toLowerCase(),
        role: "admin",
      });
      setTransferMsg(`HOD admin rights granted to ${transferTargetEmail}`);
      facultyState.reload();
      setTimeout(() => setTransferModalOpen(false), 1200);
    } catch (err) {
      setTransferMsg(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(false);
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

  // Derive initials from name
  const displayName = profile?.name || "Prof. (Dr.) Prashant Lakkadwala";
  const initials = displayName
    .replace(/Prof\.|\(Dr\.\)|Dr\./gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "PL";

  if (profileState.loading && !profileState.data) {
    return (
      <AppLayout>
        <LoadingState label="Loading profile…" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-2 py-4 sm:px-4 sm:py-6">
        {/* Profile Card Header */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs transition-shadow sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0B57D0] text-lg font-bold text-white shadow-sm shadow-blue-600/30">
                {initials}
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 sm:text-lg">
                  {profile?.name}
                </h1>
                <p className="text-xs text-slate-500">{profile?.email}</p>
                <p className="text-[11px] font-medium text-slate-400">
                  {profile?.employeeId}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                    {profile?.roleTitle || "Role: HOD"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {profile?.status || "Active"}
                  </span>
                </div>
              </div>
            </div>

            <div className="sm:self-start">
              <button
                type="button"
                onClick={handleOpenEdit}
                className="w-full rounded-xl bg-[#0B57D0] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-auto"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Department Scope & Active Batches Banner */}
        <div className="my-4 rounded-xl border border-blue-100/80 bg-blue-50/50 p-4 transition-all sm:p-4.5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Department Scope
              </p>
              <p className="mt-0.5 text-xs font-bold text-slate-900 sm:text-sm">
                {profile?.departmentScope}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Batches
              </p>
              <p className="mt-0.5 text-xs font-bold text-blue-700 sm:text-sm">
                {profile?.activeBatches}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation / Action Rows Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs divide-y divide-slate-100">
          {/* Change Password */}
          <button
            type="button"
            onClick={() => setChangePasswordOpen(true)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50/80"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <KeyIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 sm:text-sm">Change Password</p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 text-slate-400" />
          </button>

          {/* Security Settings */}
          <button
            type="button"
            onClick={() => setSecurityModalOpen(true)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50/80"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShieldIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 sm:text-sm">Security Settings</p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 text-slate-400" />
          </button>

          {/* Manage Sessions */}
          <button
            type="button"
            onClick={() => setSessionsModalOpen(true)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50/80"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <DevicesIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 sm:text-sm">Manage Sessions</p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 text-slate-400" />
          </button>

          {/* Faculty Management */}
          <button
            type="button"
            onClick={() => setFacultyModalOpen(true)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50/80"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <UsersIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 sm:text-sm">Faculty Management</p>
                <p className="text-[11px] font-medium text-slate-400">
                  Invite, activate, reset passwords and remove faculty
                </p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 text-slate-400" />
          </button>

          {/* Transfer HOD Ownership */}
          <button
            type="button"
            onClick={() => setTransferModalOpen(true)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50/80"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <UserCheckIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 sm:text-sm">Transfer HOD Ownership</p>
                <p className="text-[11px] font-medium text-slate-400">
                  Hand over department head role to another faculty member
                </p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 text-slate-400" />
          </button>

          {/* Help Center */}
          <button
            type="button"
            onClick={() => setHelpModalOpen(true)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50/80"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <HelpCircleIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 sm:text-sm">Help Center</p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 text-slate-400" />
          </button>

          {/* App Information */}
          <button
            type="button"
            onClick={() => setAppInfoModalOpen(true)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50/80"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <InfoIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 sm:text-sm">App Information</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                v1.0.0
              </span>
              <ChevronRightIcon className="h-4 w-4 text-slate-400" />
            </div>
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={() => setLogoutModalOpen(true)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-rose-50/50"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <LogoutIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-rose-600 sm:text-sm">Logout</p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 text-rose-400" />
          </button>
        </div>

        {/* Institutional Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
            <BuildingIcon className="h-4 w-4 text-slate-400" />
            <span>{profile?.institution}</span>
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">
            {profile?.department}
          </p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-3 py-1 text-[10px] font-semibold text-slate-500">
            <ShieldIcon className="h-3 w-3 text-slate-400" />
            <span>{profile?.academicSession}</span>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setDevModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50/80 px-3.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100/80 transition-colors cursor-pointer border border-blue-200/60"
            >
              Developed by Student of IT Department
            </button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. Edit Profile Modal */}
      <Modal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        title="Edit Institutional Profile"
      >
        <form onSubmit={handleSaveProfile} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700">
              Full Name & Title
            </label>
            <input
              type="text"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700">
              Role / Designation
            </label>
            <input
              type="text"
              required
              value={roleTitleInput}
              onChange={(e) => setRoleTitleInput(e.target.value)}
              placeholder="e.g. Placement Coordinator"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700">
              Employee ID
            </label>
            <input
              type="text"
              required
              value={empIdInput}
              onChange={(e) => setEmpIdInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700">
              Department Scope
            </label>
            <input
              type="text"
              required
              value={deptScopeInput}
              onChange={(e) => setDeptScopeInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700">
              Active Batches Description
            </label>
            <input
              type="text"
              required
              value={batchesInput}
              onChange={(e) => setBatchesInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          {profileMsg && (
            <p className="text-[11px] font-semibold text-emerald-600">{profileMsg}</p>
          )}
          {profileError && (
            <p className="text-[11px] font-semibold text-rose-600">{profileError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditProfileOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={savingProfile}>
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. Change Password Modal */}
      <Modal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        title="Change Password"
      >
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700">
              Current Password
            </label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
            {pwErrors.current && (
              <p className="mt-1 text-[11px] text-rose-600">{pwErrors.current}</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700">
              New Password
            </label>
            <input
              type="password"
              value={nextPw}
              onChange={(e) => setNextPw(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
            {pwErrors.next && (
              <p className="mt-1 text-[11px] text-rose-600">{pwErrors.next}</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
            {pwErrors.confirm && (
              <p className="mt-1 text-[11px] text-rose-600">{pwErrors.confirm}</p>
            )}
          </div>

          {pwApiError && <p className="text-[11px] text-rose-600">{pwApiError}</p>}
          {pwSaved && (
            <p className="text-[11px] font-semibold text-emerald-600">
              Password successfully changed!
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setChangePasswordOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={savingPw}>
              Update Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. Security Settings Modal */}
      <Modal
        open={securityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
        title="Department Security & Cryptography"
      >
        <div className="space-y-3.5 text-xs text-slate-600">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">OAuth Token Encryption</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Tokens at rest are secured with AES-256-GCM via GMAIL_TOKEN_KEY with unique initialization vectors.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">Session Protection</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              httpOnly, SameSite=Lax cookie authentication with 7-day server-side session validity and scrypt password hashing.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">Allowlist Fail-Closed Enforcement</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Only verified emails from authorized faculty/senders are eligible for automatic forwarding; all others require HOD review.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setSecurityModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* 4. Manage Sessions Modal */}
      <Modal
        open={sessionsModalOpen}
        onClose={() => setSessionsModalOpen(false)}
        title="Active Sessions"
      >
        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <div>
              <p className="font-semibold text-emerald-900">Current Session (Active)</p>
              <p className="text-[11px] text-emerald-700">Signed in as {profile?.email}</p>
            </div>
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
              Online
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Your session is secured with httpOnly cookie storage. Logging out will immediately invalidate this token in SQLite.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setSessionsModalOpen(false)}>
              Done
            </Button>
            <Button variant="danger" onClick={() => setLogoutModalOpen(true)}>
              Logout This Device
            </Button>
          </div>
        </div>
      </Modal>

      {/* 5. Faculty Management Modal */}
      <Modal
        open={facultyModalOpen}
        onClose={() => setFacultyModalOpen(false)}
        title="Faculty Management"
      >
        <div className="space-y-4">
          <form onSubmit={handleInviteFaculty} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-800">Add Faculty Member</p>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="faculty@acropolis.in"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="member">Faculty</option>
                <option value="admin">HOD/Admin</option>
              </select>
              <Button type="submit" loading={inviting} className="shrink-0">
                Add
              </Button>
            </div>
            {facultyMsg && (
              <p className="text-[11px] font-semibold text-blue-600">{facultyMsg}</p>
            )}
          </form>

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-700">Active Department Faculty</p>
            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
              {facultyList.length === 0 ? (
                <p className="p-3 text-xs text-slate-400">No additional faculty members</p>
              ) : (
                facultyList.map((m) => (
                  <div key={m.email} className="flex items-center justify-between p-2.5 text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{m.email}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{m.role}</p>
                    </div>
                    {m.email !== profile?.email && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFaculty(m.email)}
                        className="text-[11px] font-medium text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={() => setFacultyModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* 6. Transfer HOD Ownership Modal */}
      <Modal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer HOD Ownership"
      >
        <form onSubmit={handleTransferOwnership} className="space-y-3 text-xs text-slate-600">
          <p className="text-slate-600">
            Hand over primary administrator and HOD responsibilities to another faculty email address in the department.
          </p>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700">
              Recipient Faculty Email
            </label>
            <input
              type="email"
              required
              value={transferTargetEmail}
              onChange={(e) => setTransferTargetEmail(e.target.value)}
              placeholder="newhod@acropolis.in"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>
          {transferMsg && (
            <p className="text-[11px] font-semibold text-emerald-600">{transferMsg}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={transferring}>
              Grant HOD Rights
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. Help Center Modal */}
      <Modal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        title="Mail Automation Help & Guidance"
      >
        <div className="space-y-3 text-xs text-slate-600">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <p className="font-semibold text-blue-900">Email Routing Rules</p>
            <p className="mt-0.5 text-[11px] text-blue-800">
              Emails containing &ldquo;2027&rdquo; in the subject or body are matched with Batch 2027 recipients.
              Emails containing &ldquo;2028&rdquo; are matched with Batch 2028 recipients.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">Department CC Protection</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              All outgoing student forwards automatically include the department CC address ({profile?.email}) for archiving.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">Assistance & Support</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              For system queries or mailbox configuration changes, contact Acropolis IT Administration.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setHelpModalOpen(false)}>Got It</Button>
          </div>
        </div>
      </Modal>

      {/* 8. App Information Modal */}
      <Modal
        open={appInfoModalOpen}
        onClose={() => setAppInfoModalOpen(false)}
        title="App Information"
      >
        <div className="space-y-2.5 text-xs text-slate-600">
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Application:</span>
            <span className="font-semibold text-slate-800">Acropolis Mail Automation PWA</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Version:</span>
            <span className="font-semibold text-blue-700">v1.0.0 (Production Pilot)</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Target Mailbox:</span>
            <span className="font-semibold text-slate-800">rudraksha240036@acropolis.in</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Database Engine:</span>
            <span className="font-semibold text-slate-800">SQLite (node:sqlite WAL mode v2)</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Session Status:</span>
            <span className="font-semibold text-emerald-600">Encrypted & Authenticated</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-slate-100 mt-1">
            <div>
              <span className="block text-[11px] font-medium text-slate-500">Developer:</span>
              <span className="font-semibold text-slate-800 text-xs">Rudraksh Udiya (IT Dept)</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAppInfoModalOpen(false);
                setDevModalOpen(true);
              }}
              className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              View Developer Info
            </button>
          </div>
          <div className="flex justify-end pt-3">
            <Button onClick={() => setAppInfoModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* 9. Logout Confirmation Modal */}
      <Modal
        open={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title="Confirm Sign Out"
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>Are you sure you want to sign out of the IT Department Mail Automation portal?</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setLogoutModalOpen(false)}>
              Stay Signed In
            </Button>
            <Button variant="danger" loading={loggingOut} onClick={handleLogout}>
              Yes, Sign Out
            </Button>
          </div>
        </div>
      </Modal>

      {/* 10. Developer Info Modal */}
      <DeveloperModal open={devModalOpen} onClose={() => setDevModalOpen(false)} />
    </AppLayout>
  );
}

