# Deployment Readiness Guide

## Current architecture

| Layer | Production responsibility |
| --- | --- |
| Vercel | Serves the Next.js frontend and proxies every `/api/*` request to Render. |
| Render | Runs the Express API, server-side sessions, Gmail OAuth, Gmail poller, and SQLite access. |
| Render disk | Persists the SQLite database at `PILOT_DB_PATH`. |
| Supabase | Contains migration and RLS preparation only; the running application does not query Supabase yet. |

`BACKEND_API_URL` is the split-deployment switch. When it is set, the frontend
proxies all API routes before its local fallback handlers, so Express is the
only production API and session authority. Keep it unset only for standalone
local Next.js development.

## Render API deployment

Use the repository-root `render.yaml`. It intentionally builds from the
workspace root, where `package-lock.json` lives:

- Build command: `npm ci --include=dev && npm run build:backend`
- Start command: `npm --prefix backend start`
- Health check: `/api/health`
- Persistent disk: mount at `/disks/pilot` and set
  `PILOT_DB_PATH=/disks/pilot/data/pilot.db`

Do not use `backend/` as Render's root directory: it has no independent lockfile,
so `npm ci` fails there.

## Vercel frontend deployment

Deploy `frontend/` as the Vercel project root. Set only:

| Variable | Value |
| --- | --- |
| `BACKEND_API_URL` | The verified HTTPS origin of the Render API, without a trailing slash. |

Do not put API secrets, Gmail credentials, token-encryption keys, database URLs,
or Supabase service-role keys in `NEXT_PUBLIC_*` variables.

## Render environment

Set these in Render's service environment. Values must never be committed.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | yes | Set to `production`. |
| `CORS_ORIGIN` | yes | Comma-separated, explicit Vercel origins; wildcard origins are rejected. |
| `FRONTEND_URL` | yes | Verified frontend origin used after OAuth callback. |
| `PILOT_DB_PATH` | yes | SQLite location on the attached persistent disk. |
| `PILOT_ADMIN_EMAIL` | yes | Initial administrator identity. |
| `PILOT_ADMIN_PASSWORD` | yes | Initial administrator password; change it after first login. |
| `GMAIL_CLIENT_ID` | yes for Gmail | Server-only Google OAuth client ID. |
| `GMAIL_CLIENT_SECRET` | yes for Gmail | Server-only Google OAuth secret. |
| `GMAIL_REDIRECT_URI` | yes for Gmail | `https://<render-host>/api/gmail/callback`. |
| `GMAIL_TOKEN_KEY` | yes for Gmail | Stable key used to encrypt stored OAuth tokens. |
| `GMAIL_TARGET_EMAIL` | yes for Gmail | Authorized monitored mailbox. |
| `PILOT_ALLOWED_SENDERS` | yes for automation | Comma-separated sender allowlist; empty fails closed. |
| `PILOT_BATCH_2027_RECIPIENTS` | yes for automation | Comma-separated approved recipients. |
| `PILOT_BATCH_2028_RECIPIENTS` | yes for automation | Comma-separated approved recipients. |
| `PILOT_CC_EMAIL` | yes for automation | Department CC address; empty disables forwarding. |
| `PILOT_SYNC_INTERVAL_MS` | no | Poll interval; defaults to 60 seconds, minimum 15 seconds. |
| `PILOT_DISABLE_POLLER` | no | Test-only switch; never enable in production. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are not required by the current
SQLite-backed request path. Do not configure them as a claim that Supabase is
already active. If the planned migration is completed, keep the service-role
key on Render only and validate schema, policies, and service behavior first.

## OAuth configuration

Configure the exact same redirect URI in Google Cloud Console and Render:

```text
https://<verified-render-host>/api/gmail/callback
```

Do not substitute the Vercel host here. The callback terminates at the Express
backend, which then redirects to `FRONTEND_URL` after state validation and
encrypted token storage.

## Controlled release checks

1. Deploy Render, then confirm `GET /api/health` returns `200` with
   `status: "ok"`.
2. Deploy Vercel with `BACKEND_API_URL` set to that exact Render origin.
3. Confirm valid login, invalid login, session refresh, logout, and a protected
   API route through the Vercel frontend.
4. Configure Gmail OAuth, connect a dedicated test mailbox, and confirm the
   OAuth callback succeeds without exposing a token.
5. Keep auto-forwarding disabled until a dry-run or mocked Gmail test confirms
   sender allowlisting, batch classification, and duplicate protection.

## Operational caveats

- A single Render instance is required for the pilot. Multiple pollers can run
  concurrently when the API scales horizontally; database idempotency reduces
  duplicate sends but does not replace a dedicated worker design.
- Back up the SQLite database together with its `-wal` and `-shm` files before
  any risky migration or disk operation.
- Deployment dashboard status, live Gmail OAuth, and Supabase policy behavior
  require provider access and are not verified by local builds.
