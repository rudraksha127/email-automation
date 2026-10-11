"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only.
 * Dev/test skip registration so hot-reload and jsdom tests stay clean.
 * The worker itself never caches /api responses (see public/sw.js).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* installability is best-effort — never break the app over it */
    });

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      const handleUserInteraction = () => {
        Notification.requestPermission().catch(() => {});
        window.removeEventListener("click", handleUserInteraction);
      };
      window.addEventListener("click", handleUserInteraction, { once: true });
    }
  }, []);

  return null;
}
