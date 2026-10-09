/* True offline test — CDP network emulation does NOT affect service-worker
 * fetches (they run in a separate target), so the only honest simulation of
 * "backend unreachable" is to actually stop the server.
 *
 * Flow: register SW + confirm offline.html cached -> kill server ->
 * navigate to a fresh URL -> expect the static "You're offline" page ->
 * restart server -> report.
 */
import { spawn, execSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = "http://localhost:3001";
const PORT = 9227;
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => existsSync(p));

const profile = path.join(os.tmpdir(), "ab-off-" + Date.now());
mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--disable-gpu", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, method = "GET") { return (await fetch(url, { method })).json(); }
let wsId = 0; const pending = new Map();
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const send = (method, params = {}) => {
    const id = ++wsId;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message)); else resolve(m.result);
    }
  };
  return new Promise((res, rej) => { ws.onopen = () => res({ send }); ws.onerror = rej; });
}
const evalJS = async (cdp, expr) => {
  const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

let serverPid = null;
function killServer() {
  try {
    // execSync runs under cmd.exe — use single-slash taskkill flags there.
    const out = execSync('netstat -ano | findstr LISTENING | findstr :3001', { encoding: "utf8" });
    serverPid = out.trim().split(/\s+/).pop();
    execSync(`taskkill /F /PID ${serverPid} /T`, { stdio: "ignore" });
    return true;
  } catch (e) {
    console.error("killServer failed:", String(e).slice(0, 200));
    return false;
  }
}
function restartServer() {
  const child = spawn("cmd", ["/c", "npm", "start"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: "3001" },
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return true; } catch {}
    await sleep(500);
  }
  return false;
}

const results = [];
const check = (n, p, d = "") => { results.push({ n, p: !!p }); console.log((p ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); };

(async () => {
  for (let i = 0; i < 50; i++) { try { await getJson(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(300); } }
  const t = await getJson(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + "/login")}`, "PUT");
  const cdp = await connect(t.webSocketDebuggerUrl);
  await cdp.send("Page.enable");

  // 1. Load a page so the SW registers, installs and precaches.
  await cdp.send("Page.navigate", { url: BASE + "/login" });
  await sleep(2500);
  const ready = await evalJS(cdp, `(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    const active = regs.find(r => r.active);
    const keys = await caches.keys();
    const hit = keys.length ? await (await caches.open(keys[0])).match("/offline.html") : null;
    return { active: !!active, keys, hasOffline: !!hit };
  })()`);
  check("SW active + offline.html precached", ready.active && ready.hasOffline, JSON.stringify(ready));

  // 2. Kill the server — the real-world "backend unreachable" state.
  check("server stopped", killServer(), "pid=" + serverPid);
  await sleep(800);
  const serverDown = await fetch(`${BASE}/api/health`).then(() => false, () => true);
  check("server unreachable", serverDown);

  // 3. Navigate to a never-visited URL — SW must serve the static fallback.
  await cdp.send("Page.navigate", { url: BASE + "/mails?fresh=" + Date.now() });
  await sleep(3000);
  const doc = await evalJS(cdp, `({
    href: location.href,
    text: (document.body.innerText || "").slice(0, 200),
  })`);
  check("static offline page served (no JS needed)", /You're offline/i.test(doc.text), JSON.stringify(doc).slice(0, 140));

  // 4. Bring the server back and confirm normal operation resumes.
  restartServer();
  const back = await waitForServer();
  check("server restarted", back);
  await cdp.send("Page.navigate", { url: BASE + "/login?recovery=" + Date.now() });
  await sleep(2500);
  const recovered = await evalJS(cdp, `(document.body.innerText || "").includes("Welcome Back")`);
  check("app recovers once backend returns", recovered);

  const failed = results.filter((r) => !r.p);
  console.log("SUMMARY " + (results.length - failed.length) + "/" + results.length);
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error("FATAL", e);
  try { restartServer(); } catch {}
  chrome.kill();
  process.exit(1);
});
