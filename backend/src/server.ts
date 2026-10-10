import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import gmailRouter from "./routes/gmail";
import mailsRouter from "./routes/mails";
import batchesRouter from "./routes/batches";
import rulesRouter from "./routes/rules";
import settingsRouter from "./routes/settings";
import dashboardRouter from "./routes/dashboard";
import organizationsRouter from "./routes/organizations";
import { listConnectedOrgs } from "./lib/db";
import { syncGmailInbox } from "./lib/gmailSync";

const app = express();

// Trust proxy for secure cookies and IP tracking on Render
app.set("trust proxy", 1);

// Configure CORS
const rawCors = process.env.CORS_ORIGIN || "http://localhost:3000";
const allowedOrigins = rawCors
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server or curl requests with no origin
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      const isAllowed =
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(normalized) ||
        allowedOrigins.some((allowed) => {
          if (allowed.includes("*")) {
            const pattern = new RegExp("^" + allowed.replace(/\*/g, ".*") + "$");
            return pattern.test(normalized);
          }
          return false;
        });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

// Mount API routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/gmail", gmailRouter);
app.use("/api/mails", mailsRouter);
app.use("/api/batches", batchesRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/organizations", organizationsRouter);

// Root heartbeat
app.get("/", (_req, res) => {
  res.json({ service: "mail-automation-api", status: "ok" });
});

// Background Gmail Poller Worker
if (process.env.PILOT_DISABLE_POLLER !== "true") {
  const intervalMs = Math.max(15_000, Number(process.env.PILOT_SYNC_INTERVAL_MS ?? 60_000));
  let running = false;

  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const orgIds = listConnectedOrgs();
      for (const orgId of orgIds) {
        try {
          const result = await syncGmailInbox(orgId, 10);
          if (result.errors.length > 0) {
            console.warn(`[mail-sync] org=${orgId} ${result.errors.length} error(s):`, result.errors.slice(0, 3));
          }
        } catch (e) {
          console.warn(`[mail-sync] org=${orgId} failed:`, e instanceof Error ? e.message : e);
        }
      }
    } catch (e) {
      console.warn("[mail-sync] cycle failed:", e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };

  setTimeout(() => void tick(), 10_000);
  setInterval(() => void tick(), intervalMs);
  console.log(`[mail-sync] background Gmail poller started (interval: ${intervalMs / 1000}s)`);
}

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`[mail-automation-api] running on port ${PORT}`);
});
