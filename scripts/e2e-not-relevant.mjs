/* E2E: needs_review mail → "Not Relevant" → confirm modal → status updates.
 * Run: node scripts/e2e-not-relevant.mjs <mailId>
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const MAIL_ID = process.argv[2];
if (!MAIL_ID) { console.error("missing mail id"); process.exit(2); }
const BASE = "http://localhost:3001";
const PORT = 9224;
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => existsSync(p));

const profile = path.join(os.tmpdir(), "ab-e2e-" + Date.now());
mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--disable-gpu", "--window-size=1440,900", "about:blank",
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
const results = [];
const check = (n, p, d = "") => { results.push({ n, p: !!p }); console.log((p ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); };

(async () => {
  for (let i = 0; i < 50; i++) { try { await getJson(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(300); } }
  const t = await getJson(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + "/login")}`, "PUT");
  const cdp = await connect(t.webSocketDebuggerUrl);
  await cdp.send("Page.enable");

  // login
  await cdp.send("Page.navigate", { url: BASE + "/login" }); await sleep(1400);
  await evalJS(cdp, `(() => { const set=(s,v)=>{const e=document.querySelector(s);Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set.call(e,v);e.dispatchEvent(new Event("input",{bubbles:true}));}; set('input[name="email"]','admin@acropolis.in'); set('input[name="password"]','admin123'); return true; })()`);
  await evalJS(cdp, `document.querySelector('button[type="submit"]').click()`);
  await sleep(2200);
  check("logged in", (await evalJS(cdp, "location.pathname")) === "/dashboard");

  // mails list shows the test mail
  await cdp.send("Page.navigate", { url: BASE + "/mails" }); await sleep(1500);
  const listed = await evalJS(cdp, `document.body.innerText.includes("Sweep Test — Needs Review Mail")`);
  check("test mail listed", listed);

  // open detail
  await evalJS(cdp, `(() => { const a=[...document.querySelectorAll("a")].find(x=>(x.textContent||"").includes("Sweep Test")); if(a){a.click();return true;} return false; })()`);
  await sleep(1800);
  check("mail detail opened", (await evalJS(cdp, "location.pathname")).includes("/mails/"));

  const hasActions = await evalJS(cdp, `({
    forward: document.body.innerText.includes("Select Batch & Forward"),
    notRelevant: document.body.innerText.includes("Not Relevant"),
  })`);
  check("needs_review actions present", hasActions.forward && hasActions.notRelevant, JSON.stringify(hasActions));

  // open confirm modal
  await evalJS(cdp, `(() => { const b=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim()==="Not Relevant"); if(b){b.click();return true;} return false; })()`);
  await sleep(700);
  const modalShown = await evalJS(cdp, `document.body.innerText.includes("Mark as Not Relevant")`);
  check("confirm modal opens", modalShown);

  // confirm
  await evalJS(cdp, `(() => { const b=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim()==="Mark Not Relevant"); if(b){b.click();return true;} return false; })()`);
  await sleep(2200);
  const after = await evalJS(cdp, `({
    failed: document.body.innerText.includes("Failed"),
    reason: document.body.innerText.includes("Marked as not relevant by admin"),
    retry: document.body.innerText.includes("Retry Forwarding"),
    noLongerReview: !document.body.innerText.includes("Select Batch & Forward"),
  })`);
  check("status updated to failed", after.failed && after.noLongerReview, JSON.stringify(after));
  check("failure reason shown", after.reason);
  check("retry offered (recoverable)", after.retry);

  const failed = results.filter((r) => !r.p);
  console.log("SUMMARY " + (results.length - failed.length) + "/" + results.length);
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); chrome.kill(); process.exit(1); });
