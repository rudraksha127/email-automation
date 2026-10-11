"use client";

import { useEffect, useRef } from "react";

const DEVELOPER = {
  name: "Rudraksh Udiya",
  enrollment: "0827IT241115",
  year: "3rd Year",
  department: "Information Technology (IT)",
  email: "rudraksha240036@acropolis.in",
};

const MENTOR = {
  name: "Dr. Nitin Kulkarni",
  designation: "Faculty Mentor",
  department: "Information Technology (IT)",
  email: "nitinkulkarni@acropolis.in",
};

interface DeveloperModalProps {
  open: boolean;
  onClose: () => void;
}

export function DeveloperModal({ open, onClose }: DeveloperModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const devRows = [
    { label: "Developer", value: DEVELOPER.name },
    { label: "Enrollment No.", value: DEVELOPER.enrollment },
    { label: "Year", value: DEVELOPER.year },
    { label: "Department", value: DEVELOPER.department },
    { label: "Email", value: DEVELOPER.email },
  ];

  const mentorRows = [
    { label: "Faculty Mentor", value: MENTOR.name },
    { label: "Designation", value: MENTOR.designation },
    { label: "Department", value: MENTOR.department },
    { label: "Email", value: MENTOR.email },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="developer-info-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
    >
      <div
        className="flex w-full flex-col gap-[10px] rounded-2xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 border border-slate-100"
        style={{ maxWidth: 380 }}
      >
        <h2 id="developer-info-title" className="mb-1 text-[17px] font-bold text-slate-900">
          Developer Information
        </h2>

        {devRows.map(({ label, value }) => (
          <DevRow key={label} label={label} value={value} />
        ))}

        <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[1px] text-blue-600">
          Guided By
        </p>
        <div className="flex flex-col gap-0.5 rounded-xl bg-slate-50 px-2.5 py-1 border border-slate-100">
          {mentorRows.map(({ label, value }) => (
            <DevRow key={label} label={label} value={value} />
          ))}
        </div>

        <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[1px] text-blue-600">
          Technical Support
        </p>
        <p className="text-[12.5px] leading-[18px] text-slate-500">
          Facing an issue or found a bug? Write to the developer:
        </p>
        <a
          href={`mailto:${DEVELOPER.email}?subject=${encodeURIComponent("IT Student Mail Automation — Issue Report")}`}
          className="-mt-0.5 w-fit break-all py-0.5 text-[13px] font-bold text-blue-600 underline hover:text-blue-700"
        >
          {DEVELOPER.email}
        </a>

        {/* Close button matches the app's secondary tonal button */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-1.5 flex h-11 sm:h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-[#EEF4FF] hover:bg-[#E0ECFF] text-[14px] font-semibold text-slate-800 transition-colors active:opacity-75 cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/** Label/value row with hairline divider, matching the app's devRow style. */
function DevRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-[7px] last:border-b-0">
      <span className="shrink-0 text-[12px] text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right text-[13px] font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );
}
