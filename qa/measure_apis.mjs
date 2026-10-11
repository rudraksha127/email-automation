/**
 * Benchmark Script for API Latency & Payload Size
 * Runs 20 samples per endpoint and calculates p50, p95, p99, and bytes transferred.
 */
import http from "node:http";

const BASE_URL = "http://localhost:3002";

async function makeRequest(path, options = {}) {
  const url = new URL(path, BASE_URL);
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        const duration = performance.now() - start;
        resolve({
          statusCode: res.statusCode,
          duration,
          headers: res.headers,
          bodySize: Buffer.byteLength(data),
          data,
        });
      });
    });
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function calculatePercentiles(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return {
    min: sorted[0].toFixed(2),
    p50: p50.toFixed(2),
    p95: p95.toFixed(2),
    p99: p99.toFixed(2),
    max: sorted[sorted.length - 1].toFixed(2),
  };
}

async function benchmark() {
  console.log("Measuring API Latency & Payloads against", BASE_URL);

  // 1. Health endpoint
  const healthLatencies = [];
  let healthSize = 0;
  for (let i = 0; i < 20; i++) {
    const res = await makeRequest("/api/health");
    healthLatencies.push(res.duration);
    healthSize = res.bodySize;
  }
  const healthStats = calculatePercentiles(healthLatencies);
  console.log(`GET /api/health: p50=${healthStats.p50}ms, p95=${healthStats.p95}ms, p99=${healthStats.p99}ms (${healthSize} bytes)`);

  // 2. Login
  const loginRes = await makeRequest("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@institution.edu", password: "ChangeThisPassword123!" }),
  });
  
  const rawCookie = loginRes.headers["set-cookie"];
  const cookieHeader = Array.isArray(rawCookie) ? rawCookie.map((c) => c.split(";")[0]).join("; ") : "";
  const authHeaders = cookieHeader ? { Cookie: cookieHeader } : {};

  // 3. Authenticated Endpoints
  const endpoints = [
    { name: "GET /api/auth/session", path: "/api/auth/session" },
    { name: "GET /api/batches", path: "/api/batches" },
    { name: "GET /api/mails", path: "/api/mails" },
    { name: "GET /api/dashboard/stats", path: "/api/dashboard/stats" },
    { name: "GET /api/settings", path: "/api/settings" },
  ];

  const results = [
    { endpoint: "GET /api/health", ...healthStats, bytes: healthSize },
  ];

  for (const ep of endpoints) {
    const latencies = [];
    let size = 0;
    for (let i = 0; i < 20; i++) {
      const res = await makeRequest(ep.path, { headers: authHeaders });
      latencies.push(res.duration);
      size = res.bodySize;
    }
    const stats = calculatePercentiles(latencies);
    console.log(`${ep.name}: p50=${stats.p50}ms, p95=${stats.p95}ms, p99=${stats.p99}ms (${size} bytes)`);
    results.push({ endpoint: ep.name, ...stats, bytes: size });
  }

  console.log("\nJSON_RESULTS:" + JSON.stringify(results));
}

benchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
