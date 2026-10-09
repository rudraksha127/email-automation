/* API latency baseline/after benchmark (local server, authenticated).
 * Usage: node scripts/api-benchmark.mjs [baseURL] [iterations]
 */
const BASE = process.argv[2] || "http://localhost:3001";
const N = Number(process.argv[3] || 200);

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@acropolis.in", password: "admin123", remember: true }),
  });
  if (!res.ok) throw new Error("login failed: " + res.status);
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")];
  const cookie = sc.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("no session cookie");
  return cookie;
}

function pct(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]; }

async function bench(cookie, route, { method = "GET", body } = {}) {
  const times = [];
  let errors = 0;
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    const res = await fetch(BASE + route, {
      method,
      headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    await res.arrayBuffer();
    times.push(performance.now() - t0);
    if (!res.ok) errors++;
  }
  times.sort((a, b) => a - b);
  return {
    route,
    n: N,
    p50: +pct(times, 50).toFixed(2),
    p95: +pct(times, 95).toFixed(2),
    p99: +pct(times, 99).toFixed(2),
    max: +times[times.length - 1].toFixed(2),
    errors,
  };
}

(async () => {
  const cookie = await login();
  const out = [];
  out.push(await bench(cookie, "/api/auth/session"));
  out.push(await bench(cookie, "/api/dashboard/stats"));
  out.push(await bench(cookie, "/api/mails"));
  out.push(await bench(cookie, "/api/mails?status=needs_review&search=lecture"));
  out.push(await bench(cookie, "/api/batches"));
  out.push(await bench(cookie, "/api/settings"));
  out.push(await bench(cookie, "/api/rules"));
  out.push(await bench(cookie, "/api/audit?limit=20"));
  console.log(JSON.stringify(out, null, 1));
})();
