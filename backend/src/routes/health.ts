import { Router } from "express";
import { getDb } from "../lib/db";
import { gmailConfig } from "../lib/gmail";
import { isSupabaseConfigured } from "../lib/supabase";

const router = Router();

/**
 * GET /api/health — Liveness & readiness probe for Render.
 * Unauthenticated by design; returns only health booleans and metadata.
 */
router.get("/", (req, res) => {
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

  const status = allOk ? "ok" : "degraded";
  res.status(allOk ? 200 : 503).json({
    status,
    uptimeSeconds: Math.round(process.uptime()),
    checks,
    gmailConfigured,
    supabaseConfigured: isSupabaseConfigured(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
