# Deployment Readiness Guide

> Status: configuration and instructions only. **No production hostname is
> invented here** — real URLs come from the hosting provider after the first
> deployment, and the OAuth redirect URI is derived from the verified callback
> route + the verified deployed origin (see §5).

## 1. Architecture (as verified in this repository)

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router) — React 19, Tailwind 4, installable PWA |
| Backend | Next.js API route handlers (`src/app/api/**`) — same process, same origin |
| Database | SQLite (`node:sqlite`) at `./data/pilot.db` — WAL mode, auto-migrated on boot |
| Background work | In-process Gmail poller registered via `src/instrumentation.ts` |
| Auth | Server-side sessions in an httpOnly cookie (`ma_session`), scrypt password hashing |

There is **no separate Express server** and **no CORS configuration** — the
frontend and API are served from the same origin by design.

## 2. Hosting choice

### Backend + frontend: Render Web Service (recommended for the pilot)

A single Render Web Service runs the whole app:

- **Build command:** `npm ci && npm run build`
- **Start command:** `npm start` (Next respects the `PORT` Render assigns)
- **Node version:** 24 (see `engines` in `package.json`)
- **Health check path:** `/api/health`
- **Persistent disk:** attach a disk and set `PILOT_DB_PATH=/disks/pilot/data/pilot.db`
  (default `./data/pilot.db` is ephemeral on most PaaS hosts — without a disk
  the pilot database is lost on every redeploy)

### Why NOT Vercel for this application

The prompt's default assumption (Vercel frontend + Render backend) does not fit
what is actually in the repository:

1. The database is a **local SQLite file** — Vercel's filesystem is ephemeral
   and shared read-only in serverless functions; the DB would break or reset.
2. The **background Gmail poller is a long-lived `setInterval`** inside the
   Node process — serverless functions freeze between invocations, so mail
   would only be processed when someone happens to have the UI open.

Splitting to Vercel requires first migrating the database to Supabase
PostgreSQL (README Phase 7 — not implemented yet). Until then, host the whole
app on Render.

### Background processing caveat

The poller runs in the web process. A single web instance (Basic/Standard
plan) is fine for the departmental pilot. On an autoscaled setup with multiple
instances, each instance would poll independently — the DB-level idempotency
(`forward_logs` UNIQUE reservation) prevents duplicate sends, but consider a
dedicated worker before scaling out. Do **not** assume a free-tier instance
supports continuous background processing reliably.

## 3. Production environment variables

Set these in the hosting provider's dashboard (Render → Environment). Never
commit real values.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` (set by host) |
| `GMAIL_CLIENT_ID` | yes | Google Cloud OAuth client |
| `GMAIL_CLIENT_SECRET` | yes | server-side only, never `NEXT_PUBLIC_` |
| `GMAIL_REDIRECT_URI` | yes | `https://<backend-host>/api/gmail/callback` (see §5) |
| `GMAIL_TARGET_EMAIL` | yes | monitored mailbox; OAuth connect fails without it |
| `PILOT_ALLOWED_SENDERS` | yes | comma-separated; empty = fail closed (all held for review) |
| `PILOT_BATCH_2027_RECIPIENTS` | yes | comma-separated approved recipients |
| `PILOT_BATCH_2028_RECIPIENTS` | yes | comma-separated approved recipients |
| `PILOT_CC_EMAIL` | yes | department CC; empty = forwarding disabled |
| `PILOT_ADMIN_EMAIL` | yes | **required in production — boot fails fast if missing** |
| `PILOT_ADMIN_PASSWORD` | yes | **required in production — boot fails fast if missing** |
| `PILOT_DB_PATH` | recommended | point at the persistent disk path |
| `PILOT_SYNC_INTERVAL_MS` | no | poll interval, default 60000 (min 15000) |
| `PILOT_DISABLE_POLLER` | no | only for tests — never set in production |
| `NEXT_PUBLIC_USE_MOCK_API` | no | must stay unset in production |

Frontend-only note: `NEXT_PUBLIC_*` values are baked into the browser bundle —
never put secrets behind that prefix.

## 4. First deployment checklist

1. Create the Render Web Service from the GitHub repository (branch `main`).
2. Attach a persistent disk; set `PILOT_DB_PATH` to it.
3. Set every required env var above (real values only in the dashboard).
4. Deploy; verify `GET https://<backend-host>/api/health` returns
   `{"status":"ok"}`.
5. Open `https://<backend-host>/login`, log in with `PILOT_ADMIN_EMAIL` /
   `PILOT_ADMIN_PASSWORD`, then **change the password in Settings**.
6. Configure Google OAuth (§5) and connect Gmail from Settings.
7. Send one test mail from an allowlisted sender and confirm it lands in
   Needs Review or forwards correctly **before** enabling auto-forwarding.

## 5. Gmail OAuth redirect URI (derive — never guess)

The URI is composed of exactly three verified parts:

1. **Callback route (verified in code):** `src/app/api/gmail/callback/route.ts`
   — App Router serves it at the domain root, so the path is `/api/gmail/callback`.
   (There is no Express router prefix to add.)
2. **Deployed backend HTTPS origin:** `https://<the host Render actually assigned>`
   — recorded here only after deployment exists.
3. **Client configuration:** the same value must be entered in Google Cloud
   Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs **and**
   in `GMAIL_REDIRECT_URI`.

Final URI (fill in after the backend is deployed):

```
https://<verified-backend-host>/api/gmail/callback
```

Local development URI: `http://localhost:3000/api/gmail/callback`.

## 6. Database migrations & rollback

- Schema changes are idempotent `CREATE TABLE/INDEX IF NOT EXISTS` statements
  executed on boot (`src/lib/db.ts`). They never drop or rewrite existing data.
- Seed reconciliation of pilot recipients runs **once per database**
  (guarded by the `seedCleanupDone` setting) — restarts never delete
  admin-created batches, recipients or mail history.
- Before risky changes: copy the SQLite file (`pilot.db`, plus `-wal`/`-shm`)
  off the disk as a backup.
- **Rollback:** redeploy the previous git commit from the host's dashboard;
  the DB is backward-compatible because migrations only add structures.

## 7. CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:
secret scan → lint → typecheck → tests → production-dependency audit → build.
A failing required check should block merges; deployment stays a manual
environment action so no release can change a live service unexpectedly.
