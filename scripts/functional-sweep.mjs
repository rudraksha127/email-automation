/* Functional sweep via CDP (no dependencies): login → nav → mails filters →
 * batch create/delete round-trip → logout. No emails sent, no settings mutated.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:3001";
const PORT = 9223;
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("NO_CHROME"); process.exit(2); }

const profile = path.join(os.tmpdir(), "ab-func-" + Date.now());
mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu",
  "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass, detail });
  console.log((pass ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
}

async function getJson(url, method = "GET") {
  const res = await fetch(url, { method });
  return res.json();
}
async function waitForCDP() {
  for (let i = 0; i < 50; i++) {
    try { return await getJson(`http://127.0.0.1:${PORT}/json/version`); } catch { await sleep(300); }
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
  return new Promise((resolve, reject) => { ws.onopen = () => resolve(api); ws.onerror = reject; });
}

async function evalJS(cdp, expr) {
  const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function goto(cdp, url, settle = 1000) {
  await cdp.send("Page.navigate", { url });
  await sleep(settle);
}
const setText = (sel, val) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;
const clickText = (text, tag = "button") => `(() => {
  const els = [...document.querySelectorAll(${JSON.stringify(tag)})];
  const el = els.find((e) => (e.textContent || "").trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
  if (el) { el.click(); return true; } return false;
})()`;

(async () => {
  await waitForCDP();
  const target = await getJson(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + "/login")}`, "PUT");
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // 1. Login
  await goto(cdp, BASE + "/login", 1200);
  await evalJS(cdp, setText('input[name="email"]', "admin@acropolis.in"));
  await evalJS(cdp, setText('input[name="password"]', "admin123"));
  await evalJS(cdp, `document.querySelector('button[type="submit"]').click()`);
  await sleep(2200);
  let p = await evalJS(cdp, "location.pathname");
  check("login redirects to dashboard", p === "/dashboard", p);

  // 2. Dashboard real data: stat cards + View All
  const cards = await evalJS(cdp, `document.querySelectorAll("main section a, main .grid a, main .grid > *").length`);
  check("dashboard stat cards render", cards >= 4, String(cards));
  await evalJS(cdp, clickText("View All", "a"));
  await sleep(1200);
  p = await evalJS(cdp, "location.pathname");
  check("View All navigates to mails", p === "/mails", p);

  // 3. Mails: status filter + search
  await evalJS(cdp, clickText("Needs Review", "button"));
  await sleep(900);
  let errState = await evalJS(cdp, `!!([...document.querySelectorAll("h3,h2,p")].find(e => /unable|failed to load|error/i.test(e.textContent||"")))`);
  check("status filter works without error", !errState);
  await evalJS(cdp, clickText("All", "button"));
  await sleep(600);
  const searchBtn = await evalJS(cdp, `(() => { const b = document.querySelector('button[aria-label="Toggle search"]'); if (b) b.click(); return !!b; })()`);
  await sleep(300);
  if (searchBtn) await evalJS(cdp, setText('input[aria-label="Search mails"]', "lecture"));
  await sleep(1000);
  errState = await evalJS(cdp, `!!([...document.querySelectorAll("h3,h2,p")].find(e => /unable|failed to load|error/i.test(e.textContent||"")))`);
  check("search runs without error", searchBtn ? !errState : false, searchBtn ? "" : "search toggle missing");

  // 4. Batch create/delete round-trip
  await goto(cdp, BASE + "/batches", 1200);
  await evalJS(cdp, clickText("Add Batch", "button"));
  await sleep(600);
  const opened = await evalJS(cdp, `!!document.querySelector('input[placeholder="e.g. Batch 2026"]')`);
  check("Add Batch modal opens", opened);
  if (opened) {
    await evalJS(cdp, setText('input[placeholder="e.g. Batch 2026"]', "Sweep Test Batch 999"));
    await evalJS(cdp, setText('input[placeholder="e.g. IT Department – Final Year"]', "Automated UI round-trip"));
    await evalJS(cdp, clickText("Create Batch", "button"));
    await sleep(1500);
    const created = await evalJS(cdp, `document.body.innerText.includes("Sweep Test Batch 999")`);
    check("batch created and listed", created);

    // delete it: the card's delete button = a button containing "delete" that
    // lives under an ancestor mentioning the batch name
    const clicked = await evalJS(cdp, `(() => {
      const NAME = "Sweep Test Batch 999";
      const all = [...document.querySelectorAll("*")].filter(e => (e.textContent || "").includes(NAME));
      const inner = all.find(e => ![...e.children].some(c => (c.textContent || "").includes(NAME)));
      let el = inner;
      while (el && el !== document.body) {
        const d = [...el.querySelectorAll("button")].find(b => /delete/i.test(b.textContent || ""));
        if (d) { d.click(); return true; }
        el = el.parentElement;
      }
      return false;
    })()`);
    check("card delete button clicked", clicked);
    await sleep(700);
    const confirmShown = await evalJS(cdp, `document.body.innerText.includes("Are you sure you want to delete")`);
    check("delete confirmation dialog shows", confirmShown);
    await evalJS(cdp, `(() => {
      // exact match "Delete" inside the open confirmation modal (avoid per-card "Delete Batch")
      const el = [...document.querySelectorAll("button")].reverse()
        .find(b => (b.textContent || "").trim().toLowerCase() === "delete");
      if (!el) return false; el.click(); return true;
    })()`);
    await sleep(1500);
    const gone = await evalJS(cdp, `!document.body.innerText.includes("Sweep Test Batch 999")`);
    check("batch deleted (round-trip)", gone);
  }

  // 5. Settings loads + audit section + logout
  await goto(cdp, BASE + "/settings", 1500);
  const hasSections = await evalJS(cdp, `({
    cc: document.body.innerText.includes("IT Department CC Email"),
    allow: document.body.innerText.includes("Allowed Senders"),
    rules: document.body.innerText.includes("Forwarding Rules"),
    gmail: document.body.innerText.includes("Gmail Connection"),
    auto: document.body.innerText.includes("Auto Forwarding"),
    audit: document.body.innerText.includes("Audit History"),
    members: document.body.innerText.includes("Members"),
    changePw: document.body.innerText.includes("Change Password"),
  })`);
  check("settings sections present", Object.values(hasSections).every(Boolean), JSON.stringify(hasSections));
  await evalJS(cdp, clickText("Logout", "button"));
  await sleep(2200);
  p = await evalJS(cdp, "location.pathname");
  check("logout redirects to login", p === "/login", p);

  // 6. Protected route after logout → redirect
  await goto(cdp, BASE + "/dashboard", 1600);
  p = await evalJS(cdp, "location.pathname");
  check("protected route redirects when logged out", p === "/login", p);

  mkdirSync("sweep-shots", { recursive: true });
  writeFileSync("sweep-shots/functional-results.json", JSON.stringify(results, null, 1));
  const failed = results.filter((r) => !r.pass);
  console.log("SUMMARY " + (results.length - failed.length) + "/" + results.length + " passed");
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); chrome.kill(); process.exit(1); });
