import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { gmailConfig } from "@/lib/gmail";

/**
 * GET /api/health — liveness/readiness probe for Render (and manual checks).
 * Unauthenticated on purpose; returns ONLY non-sensitive booleans/counts.
 * No credentials, tokens, email content or stack traces are ever included.
 */

export async function GET(): Promise<Response> {
  // Always evaluate per-request (uptime/date must never be baked at build).
  await connection();
  const checks: Record<string, "ok" | "error"> = {};
  try {
    getDb().prepare("SELECT 1").get();
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  let gmailConfigured = false;
  try {
    gmailConfigured = gmailConfig().configured;
  } catch {
    gmailConfigured = false;
  }

  return Response.json(
    {
      status: allOk ? "ok" : "degraded",
      uptimeSeconds: Math.round(process.uptime()),
      checks,
      gmailConfigured, // boolean only — never the values
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
