"use client";

import { useEffect, useRef } from "react";

interface DeveloperModalProps {
  open: boolean;
  onClose: () => void;
}

export function DeveloperModal({ open, onClose }: DeveloperModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="developer-info-title"
        className="relative z-10 w-full max-w-[440px] max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="pb-1">
          <h2 id="developer-info-title" className="text-xl font-bold text-slate-900 tracking-tight">
            Developer Information
          </h2>
        </div>

        {/* Developer Core Details */}
        <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-3.5 text-xs sm:text-[13px]">
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-slate-500 font-normal">Developer</span>
            <span className="text-right font-semibold text-slate-900 break-words">Rudraksh Udiya</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-slate-500 font-normal">Enrollment No.</span>
            <span className="text-right font-semibold text-slate-900 font-mono">0827IT241115</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-slate-500 font-normal">Year</span>
            <span className="text-right font-semibold text-slate-900">3rd Year</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-slate-500 font-normal">Department</span>
            <span className="text-right font-semibold text-slate-900 break-words">Information Technology (IT)</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-slate-500 font-normal">Email</span>
            <span className="text-right font-semibold text-slate-900 break-all">rudraksha240036@acropolis.in</span>
          </div>
        </div>

        {/* Guided By Section */}
        <div className="mt-5 sm:mt-6">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            GUIDED BY
          </h3>
          <div className="mt-2.5 rounded-2xl bg-blue-50/50 p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 text-xs sm:text-[13px] border border-blue-100/50">
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-slate-500 font-normal">Faculty Mentor</span>
              <span className="text-right font-semibold text-slate-900 break-words">Dr. Nitin Kulkarni</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-slate-500 font-normal">Designation</span>
              <span className="text-right font-semibold text-slate-900">Faculty Mentor</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-slate-500 font-normal">Department</span>
              <span className="text-right font-semibold text-slate-900 break-words">Information Technology (IT)</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-slate-500 font-normal">Email</span>
              <span className="text-right font-semibold text-slate-900 break-all">nitinkulkarni@acropolis.in</span>
            </div>
          </div>
        </div>

        {/* Technical Support Section */}
        <div className="mt-5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            TECHNICAL SUPPORT
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
            Facing an issue or found a bug? Write to the developer:
          </p>
          <a
            href="mailto:rudraksha240036@acropolis.in"
            className="mt-1.5 inline-block text-xs sm:text-[13px] font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors break-all"
          >
            rudraksha240036@acropolis.in
          </a>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 sm:mt-6 w-full rounded-2xl bg-[#EEF4FF] hover:bg-[#E0ECFF] py-3 text-sm font-semibold text-slate-800 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}
