/* Deep verification via CDP (no dependencies):
 *  1) CSV recipient import E2E (upload -> preview -> confirm -> recipients listed)
 *  2) Forwarding rule E2E (create -> persisted -> deleted)
 *  3) PWA deep check (manifest parse, SW active, cache populated, offline fallback)
 * Cleans up its own test batch from the DB at the end.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

const BASE = "http://localhost:3001";
const PORT = 9225;
const BATCH_NAME = "Sweep Deep Batch";
const RULE_NAME = "Sweep Rule Check";
const DB_PATH = path.join(process.cwd(), "data", "pilot.db");

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => existsSync(p));

// temp CSV with valid, duplicate and invalid rows
const csvPath = path.join(os.tmpdir(), `sweep-recipients-${Date.now()}.csv`);
writeFileSync(
  csvPath,
  [
    "Name,Email",
    "CSV Student One,csv1@example.com",
    "CSV Student Two,csv2@example.com",
    "CSV Student Three,csv3@example.com",
    "CSV Student One,csv1@example.com",
    "Bad Row,not-an-email",
  ].join("\n")
);

const profile = path.join(os.tmpdir(), "ab-deep-" + Date.now());
mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--disable-gpu", "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (n, p, d = "") => { results.push({ n, p: !!p }); console.log((p ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); };

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
const goto = async (cdp, url, settle = 1200) => { await cdp.send("Page.navigate", { url }); await sleep(settle); };
async function waitFor(cdp, expr, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await evalJS(cdp, expr)) return true; } catch { /* keep polling */ }
    await sleep(250);
  }
  return false;
}
const setText = (sel, val) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;

(async () => {
  for (let i = 0; i < 50; i++) { try { await getJson(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(300); } }
  const t = await getJson(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + "/login")}`, "PUT");
  const cdp = await connect(t.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("DOM.enable");
  await cdp.send("Network.enable");

  // ---- login ----
  await goto(cdp, BASE + "/login", 1300);
  await evalJS(cdp, setText('input[name="email"]', "admin@acropolis.in"));
  await evalJS(cdp, setText('input[name="password"]', "admin123"));
  const loginReady = await waitFor(cdp, `!!document.querySelector('button[type="submit"]')`);
  check("login form ready", loginReady);
  await evalJS(cdp, `document.querySelector('button[type="submit"]').click()`);
  await waitFor(cdp, `location.pathname === "/dashboard"`, 8000);
  check("logged in", (await evalJS(cdp, "location.pathname")) === "/dashboard");

  // ---- 1) CSV import E2E ----
  await goto(cdp, BASE + "/batches", 1300);
  await waitFor(cdp, `!![...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim().includes("Add Batch"))`);
  await evalJS(cdp, `(() => { const b=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim().includes("Add Batch")); if(b){b.click();return true;} return false; })()`);
  await sleep(600);
  await evalJS(cdp, setText('input[placeholder="e.g. Batch 2026"]', BATCH_NAME));
  await evalJS(cdp, `(() => { const b=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim()==="Create Batch"); if(b){b.click();return true;} return false; })()`);
  await sleep(1500);
  check("test batch created", await evalJS(cdp, `document.body.innerText.includes(${JSON.stringify(BATCH_NAME)})`));

  // open batch detail
  await evalJS(cdp, `(() => { const a=[...document.querySelectorAll("a")].find(x=>(x.getAttribute("aria-label")||"").includes(${JSON.stringify(BATCH_NAME)}) || (x.textContent||"").includes(${JSON.stringify(BATCH_NAME)})); if(a){a.click();return true;} return false; })()`);
  await waitFor(cdp, `location.pathname.includes("/batches/")`, 8000);
  const onDetail = (await evalJS(cdp, "location.pathname")).includes("/batches/");
  check("batch detail opened", onDetail);

  // upload CSV through the hidden file input (wait for the detail page to render)
  await waitFor(cdp, `!!document.querySelector('input[aria-label="Upload recipients CSV"]')`, 8000);
  const doc = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: 'input[aria-label="Upload recipients CSV"]' });
  check("CSV file input found", !!nodeId);
  await cdp.send("DOM.setFileInputFiles", { files: [csvPath], nodeId });
  await sleep(1200);
  const preview = await evalJS(cdp, `({
    modal: document.body.innerText.includes("Import Recipients"),
    valid3: document.body.innerText.includes("Import 3 Recipients"),
  })`);
  check("import preview modal (3 valid rows)", preview.modal && preview.valid3, JSON.stringify(preview));
  await evalJS(cdp, `(() => { const b=[...document.querySelectorAll("button")].find(x=>/^Import \\d+ Recipients$/.test((x.textContent||"").trim())); if(b){b.click();return true;} return false; })()`);
  await sleep(1800);
  const imported = await evalJS(cdp, `({
    one: document.body.innerText.includes("csv1@example.com"),
    two: document.body.innerText.includes("csv2@example.com"),
    three: document.body.innerText.includes("csv3@example.com"),
    count3: document.body.innerText.includes("3 recipients"),
  })`);
  check("recipients imported (3 added)", imported.one && imported.two && imported.three, JSON.stringify(imported));

  // ---- 2) rules E2E ----
  await goto(cdp, BASE + "/settings", 1600);
  await waitFor(cdp, `!![...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim().includes("Add Rule"))`);
  await evalJS(cdp, `(() => { const b=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim().includes("Add Rule")); if(b){b.click();return true;} return false; })()`);
  await waitFor(cdp, `!!document.querySelector("#rule-name")`, 5000);
  const formOpen = await evalJS(cdp, `!!document.querySelector("#rule-name")`);
  check("rule form opens", formOpen);
  await evalJS(cdp, setText("#rule-name", RULE_NAME));
  await evalJS(cdp, `(() => {
    const sel = document.querySelector("#rule-target");
    if (!sel) return false;
    const opt = [...sel.options].find(o => (o.textContent || "").includes(${JSON.stringify(BATCH_NAME)}));
    if (!opt) return false;
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(sel, opt.value);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  await evalJS(cdp, setText("#rule-subject", "sweep, deep"));
  await sleep(200);
  await evalJS(cdp, `(() => { const b=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim()==="Create Rule"); if(b){b.click();return true;} return false; })()`);
  await sleep(1800);
  check("rule created and listed", await evalJS(cdp, `document.body.innerText.includes(${JSON.stringify(RULE_NAME)})`));
  const dbRule = new DatabaseSync(DB_PATH).prepare("SELECT COUNT(*) c FROM forwarding_rules WHERE name=?").get(RULE_NAME);
  check("rule persisted in DB", dbRule.c === 1, "rows=" + dbRule.c);

  await evalJS(cdp, `(() => { const b=document.querySelector('button[aria-label="Delete rule ${RULE_NAME}"]'); if(b){b.click();return true;} return false; })()`);
  await sleep(1500);
  const dbRule2 = new DatabaseSync(DB_PATH).prepare("SELECT COUNT(*) c FROM forwarding_rules WHERE name=?").get(RULE_NAME);
  // Audit history may still mention the rule name — check the rules list itself.
  const ruleGoneFromList = await evalJS(cdp, `!document.querySelector('button[aria-label="Delete rule ${RULE_NAME}"]')`);
  check("rule deleted via UI", dbRule2.c === 0 && ruleGoneFromList, "rows=" + dbRule2.c);

  // ---- 3) PWA deep check ----
  await goto(cdp, BASE + "/dashboard", 1500);
  const manifest = await cdp.send("Page.getAppManifest");
  check("manifest parses without errors", (manifest.errors || []).length === 0, JSON.stringify((manifest.errors || []).map((e) => e.message)));
  const mfText = await evalJS(cdp, `fetch("/manifest.webmanifest").then(r => r.text())`);
  let mfObj = null;
  try { mfObj = mfText ? JSON.parse(mfText) : null; } catch { mfObj = null; }
  const mfName = mfObj ? mfObj.name : null;
  check("served manifest parses with name", !!mfName, mfName || ("raw:" + String(mfText).slice(0, 60)));
  const sw = await evalJS(cdp, `navigator.serviceWorker.getRegistrations().then(rs => rs.map(r => ({ active: !!r.active, scope: r.scope, script: r.active ? r.active.scriptURL : null })))`);
  check("service worker active", sw.length > 0 && sw[0].active, JSON.stringify(sw));
  const cachesKeys = await evalJS(cdp, `caches.keys()`);
  check("static cache populated", cachesKeys.some((k) => k.startsWith("pwa-static-")), JSON.stringify(cachesKeys));

  // Offline navigation is covered by scripts/offline-nav-check.mjs — CDP
  // network emulation does not apply to service-worker fetches, so this
  // script only verifies the online SW/manifest/cache state.

  // ---- cleanup ----
  const d = new DatabaseSync(DB_PATH);
  const batch = d.prepare("SELECT id FROM batches WHERE name=?").get(BATCH_NAME);
  if (batch) {
    d.prepare("DELETE FROM recipients WHERE batch_id=?").run(batch.id);
    d.prepare("DELETE FROM forwarding_rules WHERE target_batch_id=?").run(batch.id);
    d.prepare("DELETE FROM batches WHERE id=?").run(batch.id);
  }
  d.prepare("DELETE FROM mails WHERE subject LIKE 'Sweep%'").run();
  const leftover = d.prepare("SELECT COUNT(*) c FROM batches WHERE name=?").get(BATCH_NAME).c;
  check("cleanup complete", leftover === 0);
  try { rmSync(csvPath, { force: true }); } catch {}

  const failed = results.filter((r) => !r.p);
  console.log("SUMMARY " + (results.length - failed.length) + "/" + results.length);
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); chrome.kill(); process.exit(1); });
