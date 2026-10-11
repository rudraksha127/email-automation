# 📘 Production Operations Runbook

**System:** Mail Automation & Batch Distribution Platform  
**Target Environment:** Production (`v1.0.0`)  
**Primary Institutional Contact:** `placementit@acropolis.in`  
**Last Updated:** October 2026

---

## 1. System Overview & Architecture

The Mail Automation platform runs as a dual-tier architecture:
- **Frontend:** Next.js 16 (App Router) on port `3002` (or Vercel edge/serverless in cloud).
- **Backend:** Express API + TypeScript on port `3001` (or Render web service).
- **Database:** SQLite WAL mode (`data/pilot.db`) with automatic backup, or Supabase PostgreSQL (`DATABASE_URL`).
- **Autonomous Poller:** 60-second background worker embedded in the backend process to continuously ingest and forward official emails.

---

## 2. Service Management & Operations

### Windows Background Daemon (24/7 Operation)
To keep the application running continuously in the background on a server/workstation:

```powershell
# Start frontend + backend services in detached background processes
npm run start:daemon

# Check running status, PID, and port bindings (3001 & 3002)
npm run status:daemon

# Gracefully terminate background processes
npm run stop:daemon
```

### PM2 Process Manager (Linux / VM Deployments)
```bash
# Start cluster using ecosystem configuration
npm run pm2:start

# Inspect process status, memory, and restarts
npm run pm2:status

# Stop cluster
npm run pm2:stop
```

### Standard Dev / Foreground Run
```bash
npm run dev           # Both frontend & backend concurrently
npm run dev:frontend  # Port 3002
npm run dev:backend   # Port 3001
```

---

## 3. Monitoring & Health Checks

### Health Endpoint
The backend exposes a comprehensive health monitoring check:
```http
GET /api/health
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "uptimeSeconds": 1420,
  "checks": {
    "database": "ok"
  },
  "gmailConfigured": true,
  "supabaseConfigured": false,
  "poller": {
    "active": true,
    "status": "healthy",
    "intervalSeconds": 60,
    "lastTickStartedAt": "2026-10-11T18:40:45.523Z",
    "lastTickCompletedAt": "2026-10-11T18:40:45.524Z",
    "lastError": null,
    "consecutiveErrors": 0,
    "totalRuns": 24,
    "totalIngested": 0,
    "totalForwarded": 0
  },
  "timestamp": "2026-10-11T18:41:43.339Z"
}
```

### Alerts & Thresholds
- **`status != "ok"` or HTTP != 200**: Service degraded; inspect database connectivity.
- **`consecutiveErrors >= 3`**: Gmail API rate limiting or invalid OAuth token. Re-authenticate via `/settings`.
- **Latency > 500ms**: High CPU load or large attachment processing.

---

## 4. Disaster Recovery & Rollback

### Database Backup
The primary SQLite database resides at `data/pilot.db`.
Before any production deployment or major migration, an atomic snapshot is preserved:
- Pre-release snapshot: `data/pilot.db.prod-deploy-backup-*`

### Automated Backup Script
```bash
# To take a quick snapshot without stopping traffic (WAL-safe):
sqlite3 data/pilot.db ".backup 'data/backup-$(date +%s).db'"
```

### Rollback Procedure
If a breaking regression occurs in production:
1. Stop running services:
   ```powershell
   npm run stop:daemon
   ```
2. Restore database snapshot:
   ```powershell
   Copy-Item -Path "data/pilot.db.prod-deploy-backup-*" -Destination "data/pilot.db" -Force
   ```
3. Revert code to pre-release baseline:
   ```bash
   git checkout pre-release
   ```
4. Restart services:
   ```powershell
   npm run start:daemon
   ```
5. Verify health:
   ```bash
   curl -s http://localhost:3001/api/health
   ```

---

## 5. Security & Secret Rotation

### Rule 1: Never Commit Secrets
Secrets must only live in `.env.local` or environment provider vaults (Render/Vercel/Supabase). Never commit `.env*` files or plaintext passwords.

### Rotating Administrator Credentials
1. Generate a strong secret passphrase.
2. Update `PILOT_ADMIN_PASSWORD` in `backend/.env.local`.
3. In `backend/src/lib/db.ts`, ensure `forcePasswordSync` is triggered on server restart, or run a secure rotation script using scrypt (`N=16384, r=8, p=1`, 64-byte key).
4. Restart backend service.
5. Invalidate existing sessions:
   ```sql
   DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = 'placementit@acropolis.in');
   ```

### Rotating Gmail OAuth Tokens
1. If Google Cloud OAuth credentials need rotation:
   - Update `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in `backend/.env.local` and `frontend/.env.local`.
   - Clear stored tokens in database:
     ```sql
     UPDATE system_settings SET value = NULL WHERE key = 'gmail_tokens';
     ```
   - Navigate to `http://localhost:3002/settings` (or production URL).
   - Click **Connect Gmail** and complete Google OAuth consent.

---

## 6. Common Troubleshooting

| Symptom | Probable Cause | Action |
| :--- | :--- | :--- |
| `ECONNREFUSED 3001` | Backend service not running | Run `npm run start:daemon` or inspect `npm run status:daemon` |
| `HTTP 401 Unauthorized` on login | Invalid credentials or expired session | Ensure `placementit@acropolis.in` is used; verify password in `.env.local` |
| Gmail sync shows "Disconnected" | Expired refresh token or missing scopes | Click **Connect Gmail** under Settings to refresh OAuth tokens |
| Mails stuck in "Needs Review" | Low confidence classification score (< 0.70) | Open Mails dashboard, click email, manually assign batch and click **Forward Now** |
