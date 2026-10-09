/* Quick login-page screenshots (desktop + mobile). */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = "http://localhost:3001";
const PORT = 9228;
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => existsSync(p));
const profile = path.join(os.tmpdir(), "ab-shot-" + Date.now());
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
(async () => {
  for (let i = 0; i < 50; i++) { try { await getJson(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(300); } }
  const t = await getJson(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + "/login")}`, "PUT");
  const cdp = await connect(t.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  mkdirSync("sweep-shots", { recursive: true });
  for (const [name, w, h] of [["login-desktop-1440", 1440, 900], ["login-mobile-390", 390, 844]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
    await cdp.send("Page.navigate", { url: BASE + "/login" });
    await sleep(2500);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`sweep-shots/${name}.png`, Buffer.from(data, "base64"));
    const overflow = await cdp.send("Runtime.evaluate", {
      expression: `document.scrollingElement.scrollWidth > window.innerWidth + 1`,
      returnByValue: true,
    });
    console.log(name, "overflow=", overflow.result.value);
  }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); chrome.kill(); process.exit(1); });
