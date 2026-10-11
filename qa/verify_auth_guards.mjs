/**
 * Auth Guard & Session Security Verification Script
 */
import http from "node:http";

const BASE_URL = "http://localhost:3002";

async function makeRequest(path, options = {}) {
  const url = new URL(path, BASE_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
        });
      });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function verify() {
  console.log("Verifying Auth Guards & Session Lifecycle...");

  // 1. Login
  const loginRes = await makeRequest("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@institution.edu", password: "ChangeThisPassword123!" }),
  });
  console.log("Login Status:", loginRes.statusCode);
  if (loginRes.statusCode !== 200) throw new Error("Login failed");

  const rawCookie = loginRes.headers["set-cookie"];
  const cookieHeader = Array.isArray(rawCookie) ? rawCookie.map((c) => c.split(";")[0]).join("; ") : "";
  console.log("Session Cookie Established:", !!cookieHeader);

  // 2. Verified Active Session
  const sessionRes = await makeRequest("/api/auth/session", {
    headers: { Cookie: cookieHeader },
  });
  console.log("Active Session Check:", sessionRes.statusCode);
  if (sessionRes.statusCode !== 200) throw new Error("Session check failed");

  // 3. Logout
  const logoutRes = await makeRequest("/api/auth/logout", {
    method: "POST",
    headers: { Cookie: cookieHeader },
  });
  console.log("Logout Status:", logoutRes.statusCode);
  if (logoutRes.statusCode !== 200) throw new Error("Logout failed");

  // 4. Session Check After Logout
  const postLogoutSession = await makeRequest("/api/auth/session", {
    headers: { Cookie: cookieHeader },
  });
  console.log("Post-Logout Session Check:", postLogoutSession.statusCode);
  if (postLogoutSession.statusCode !== 401) throw new Error("Session was not invalidated!");

  // 5. Protected API Access Without Session
  const protectedBatches = await makeRequest("/api/batches");
  console.log("Unauthenticated /api/batches Check:", protectedBatches.statusCode);
  if (protectedBatches.statusCode !== 401) throw new Error("Protected API exposed without auth!");

  const protectedMails = await makeRequest("/api/mails");
  console.log("Unauthenticated /api/mails Check:", protectedMails.statusCode);
  if (protectedMails.statusCode !== 401) throw new Error("Protected API exposed without auth!");

  console.log("✅ ALL AUTH & SESSION GUARDS VERIFIED SUCCESSFULLY!");
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
