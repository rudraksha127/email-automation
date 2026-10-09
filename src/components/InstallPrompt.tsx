"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, XIcon } from "@/components/icons";

/**
 * The browser's beforeinstallprompt event (Chromium). Typed locally because
 * the event is not part of the stable TS DOM lib yet.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

/**
 * "Install app" banner shown once the browser reports the PWA as installable.
 * Purely functional: the button fires the real install prompt; the X hides it
 * for the session. Renders nothing when the event never fires (Safari/Firefox,
 * already-installed, or dismissed).
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    const onReady = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onReady);
    return () => window.removeEventListener("beforeinstallprompt", onReady);
  }, []);

  async function handleInstall() {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome !== "accepted") setVisible(false);
      setDeferred(null);
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Install app prompt"
      className="fixed inset-x-0 top-3 z-50 mx-auto flex w-[min(92vw,420px)] items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3 shadow-lg"
    >
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
        <span className="text-[13px] font-black tracking-tight">IT</span>
        <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="white" strokeWidth="4">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-slate-900">
          Install Mail Automation App
        </span>
        <span className="block text-xs text-slate-500">Install for instant dashboard access</span>
      </span>
      <button
        type="button"
        onClick={handleInstall}
        disabled={installing}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        <DownloadIcon className="h-3.5 w-3.5" />
        Install
      </button>
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={handleDismiss}
        className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
