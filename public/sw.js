/*
 * Minimal service worker — PWA installability + offline fallback shell.
 *
 * Caching rules (security-sensitive by design):
 *  - NEVER caches /api/* responses (no auth, no email content, no tokens).
 *  - NEVER caches navigation/page HTML (pages are just shells; data comes from the API).
 *  - Only caches immutable static assets: /_next/static/* (content-hashed),
 *    /icons/*, /manifest.webmanifest, plus the static /offline fallback page.
 *  - The offline page makes NO claim that email automation works offline.
 */

const OFFLINE_URL = "/offline";
const STATIC_CACHE = "pwa-static-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icons/icon.svg"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API/auth traffic — no caching of sensitive responses.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, static offline fallback when unreachable.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((hit) => hit || Response.error()))
    );
    return;
  }

  const isImmutableAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest";
  if (!isImmutableAsset) return;

  // Cache-first for immutable, content-hashed assets.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
    )
  );
});
