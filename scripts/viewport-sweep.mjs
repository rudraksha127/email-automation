/* Viewport + functional sweep via Chrome DevTools Protocol (no dependencies).
 * Usage: node scripts/viewport-sweep.mjs [baseURL]
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:3001";
const PORT = 9222;
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Google\\Chrome Beta\\Application\\chrome.exe",
];
import { existsSync } from "node:fs";
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("NO_CHROME"); process.exit(2); }

const profile = path.join(os.tmpdir(), "ab-sweep-" + Date.now());
mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu",
  "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, method = "GET") {
  const res = await fetch(url, { method });
  return res.json();
}

async function waitForCDP() {
  for (let i = 0; i < 50; i++) {
    try { return await getJson(`http://127.0.0.1:${PORT}/json/version`); }
    catch { await sleep(300); }
  }
  throw new Error("CDP not ready");
}

let wsId = 0;
const pending = new Map();
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const api = {
    send(method, params = {}) {
      const id = ++wsId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { ws.close(); },
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(api);
    ws.onerror = reject;
  });
}

async function evalJS(cdp, expr) {
  const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
  return r.result.value;
}

async function goto(cdp, url, settle = 900) {
  await cdp.send("Page.navigate", { url });
  await sleep(settle);
}

async function setViewport(cdp, w, h) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: w, height: h, deviceScaleFactor: 1, mobile: w < 500,
  });
}

const OVERFLOW_EXPR = `(() => {
  const d = document.scrollingElement;
  const vw = window.innerWidth;
  const bad = [];
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.overflowX === "auto" || cs.overflowX === "scroll") return;
      // ignore elements inside horizontal scrollers
      let p = el.parentElement, inScroller = false;
      while (p) { const pc = getComputedStyle(p); if (pc.overflowX === "auto" || pc.overflowX === "scroll") { inScroller = true; break; } p = p.parentElement; }
      if (!inScroller) bad.push(el.tagName.toLowerCase() + "." + String(el.className || "").split(" ").slice(0,3).join("."));
    }
  });
  return { vw, scrollW: d.scrollWidth, overflow: d.scrollWidth > vw + 1, offenders: [...new Set(bad)].slice(0, 6) };
})()`;

const results = [];
async function sweep(cdp, label, route) {
  await goto(cdp, BASE + route);
  const r = await evalJS(cdp, OVERFLOW_EXPR);
  const hasShell = await evalJS(cdp, `!!document.querySelector("nav, aside") || location.pathname === "/login"`);
  const h1 = await evalJS(cdp, `(document.querySelector("h1") || {}).textContent || document.title`);
  results.push({ label, route, ...r, shell: hasShell, title: (h1 || "").trim().slice(0, 40) });
  return r;
}

(async () => {
  await waitForCDP();
  const target = await getJson(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + "/login")}`, "PUT");
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const VIEWPORTS = [
    { name: "mobile-360", w: 360, h: 740 },
    { name: "mobile-390", w: 390, h: 844 },
    { name: "tablet-768", w: 768, h: 1024 },
    { name: "laptop-1024", w: 1024, h: 768 },
    { name: "desktop-1280", w: 1280, h: 800 },
    { name: "desktop-1440", w: 1440, h: 900 },
  ];
  const ROUTES = ["/", "/dashboard", "/mails", "/batches", "/settings", "/workspace"];

  // --- login once at mobile-360 ---
  await setViewport(cdp, 360, 740);
  await goto(cdp, BASE + "/login", 1200);
  await evalJS(cdp, `(() => {
    const set = (sel, val) => { const el = document.querySelector(sel); if (!el) return false;
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true })); return true; };
    set('input[name="email"]', 'admin@acropolis.in');
    set('input[name="password"]', 'admin123');
    return true;
  })()`);
  await sleep(200);
  await evalJS(cdp, `(() => { const b = document.querySelector('button[type="submit"]'); if (b) b.click(); return !!b; })()`);
  await sleep(2000);
  const afterLogin = await evalJS(cdp, `location.pathname`);
  results.push({ label: "auth", route: "/login", loginRedirect: afterLogin, ok: afterLogin === "/dashboard" });
  await evalJS(cdp, `localStorage.setItem("sweep", "1")`).catch(() => {});

  // --- overflow sweep ---
  for (const v of VIEWPORTS) {
    await setViewport(cdp, v.w, v.h);
    for (const route of ROUTES) {
      try { await sweep(cdp, v.name, route); }
      catch (e) { results.push({ label: v.name, route, error: String(e.message || e) }); }
    }
  }

  // --- screenshots ---
  mkdirSync("sweep-shots", { recursive: true });
  const shots = [
    ["desktop-1440", 1440, 900, "/dashboard"],
    ["desktop-1440", 1440, 900, "/mails"],
    ["desktop-1440", 1440, 900, "/batches"],
    ["desktop-1440", 1440, 900, "/settings"],
    ["mobile-360", 360, 740, "/dashboard"],
    ["tablet-768", 768, 1024, "/mails"],
  ];
  for (const [name, w, h, route] of shots) {
    await setViewport(cdp, w, h);
    await goto(cdp, BASE + route, 1100);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`sweep-shots/${name}${route.replace(/\//g, "_")}.png`, Buffer.from(data, "base64"));
  }

  // --- service worker / manifest checks ---
  await setViewport(cdp, 1440, 900);
  await goto(cdp, BASE + "/dashboard", 1500);
  const pwa = await evalJS(cdp, `Promise.all([
    navigator.serviceWorker.getRegistrations().then(r => r.length),
    fetch("/manifest.webmanifest").then(r => r.status),
    document.querySelector('link[rel="manifest"]') ? document.querySelector('link[rel="manifest"]').href : null,
  ]).then(([sw, mf, link]) => ({ sw, mf, link }))`);
  results.push({ label: "pwa", ...pwa });

  console.log(JSON.stringify(results, null, 1));
  const overflowFails = results.filter((r) => r.overflow);
  const errors = results.filter((r) => r.error);
  console.log("SUMMARY overflow=" + overflowFails.length + " errors=" + errors.length + " login=" + (afterLogin === "/dashboard"));

  cdp.close();
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); chrome.kill(); process.exit(1); });
