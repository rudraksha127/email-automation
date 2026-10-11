"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/AuthContext";
import { http } from "@/services/http";
import { paths } from "@/routes/paths";
import { MailIcon, XIcon, CheckCircleIcon } from "@/components/icons";

interface MailItem {
  id: string;
  sender: string;
  senderName: string | null;
  subject: string;
  receivedAt: string;
  batchName: string | null;
  status: string;
}

interface NewMailToast {
  id: string;
  mailId: string;
  sender: string;
  subject: string;
  batchName: string | null;
}

/** Synthesize a subtle, pleasant notification chime without external mp3 files. */
function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* AudioContext policy may block until interaction */
  }
}

/**
 * Global Real-Time PWA & Web Notification Listener
 * Polls for incoming department emails in the background and delivers:
 * 1. Native System Notifications (Service Worker / Notification API on mobile & desktop)
 * 2. In-App Floating Toast Banner with direct link to view the mail
 * 3. Soft Audio Chime
 */
export function MailNotificationListener() {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<NewMailToast[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  // Auto-request notification permission on interaction
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      const onRequest = () => {
        Notification.requestPermission().catch(() => {});
        window.removeEventListener("click", onRequest);
      };
      window.addEventListener("click", onRequest, { once: true });
    }
  }, []);

  // Poll for new mails
  useEffect(() => {
    if (!user) return;

    let active = true;

    async function checkForNewMails() {
      try {
        const mails = await http.get<MailItem[]>("/api/mails?limit=10");
        if (!active || !Array.isArray(mails)) return;

        if (initialLoadRef.current) {
          // First load: seed existing mail IDs so we only alert on genuinely new incoming emails
          mails.forEach((m) => knownIdsRef.current.add(m.id));
          initialLoadRef.current = false;
          return;
        }

        const freshMails = mails.filter((m) => !knownIdsRef.current.has(m.id));
        if (freshMails.length > 0) {
          freshMails.forEach((mail) => {
            knownIdsRef.current.add(mail.id);

            // 1. Play Audio Chime
            playChime();

            // 2. Native System Notification (Mobile & Web PWA)
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              const notifTitle = `📧 New Mail: ${mail.senderName || mail.sender}`;
              const notifBody = `${mail.subject}${mail.batchName ? `\nForwarded to: ${mail.batchName}` : ""}`;

              if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.ready
                  .then((reg) => {
                    reg.showNotification(notifTitle, {
                      body: notifBody,
                      icon: "/icons/icon-192.png",
                      badge: "/icons/icon-192.png",
                      tag: `mail-${mail.id}`,
                      data: { url: `/mails/${mail.id}` },
                    });
                  })
                  .catch(() => {
                    new Notification(notifTitle, { body: notifBody, icon: "/icons/icon.svg" });
                  });
              } else {
                try {
                  new Notification(notifTitle, { body: notifBody, icon: "/icons/icon.svg" });
                } catch {
                  /* fallback gracefully */
                }
              }
            }

            // 3. In-App Floating Toast
            const toastId = `${mail.id}-${Date.now()}`;
            setToasts((prev) => [
              ...prev.slice(-2), // Keep max 3 toasts
              {
                id: toastId,
                mailId: mail.id,
                sender: mail.senderName || mail.sender,
                subject: mail.subject,
                batchName: mail.batchName,
              },
            ]);

            // Auto-dismiss toast after 6 seconds
            setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== toastId));
            }, 6000);
          });
        }
      } catch {
        /* background polling error — silent retry */
      }
    }

    // Initial check
    checkForNewMails();

    // Poll every 15 seconds
    const interval = setInterval(checkForNewMails, 15_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-blue-200 bg-white/95 p-3.5 shadow-xl shadow-blue-500/10 backdrop-blur-md transition-all animate-in slide-in-from-top-2"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <MailIcon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">New Email Received</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="truncate text-xs font-bold text-slate-900 mt-0.5">{toast.subject}</p>
            <p className="truncate text-[11px] text-slate-500">{toast.sender}</p>
            {toast.batchName && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                <CheckCircleIcon className="h-3 w-3" />
                {toast.batchName}
              </span>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Link
                href={paths.mailDetails(toast.mailId)}
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                View Email →
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
