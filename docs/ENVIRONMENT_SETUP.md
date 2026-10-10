# Environment Variables Configuration Guide

> **Scope:** This document covers ALL environment variables required to run and deploy the Mail Automation Platform — both the **Next.js monolithic app** (repository root) and the **Express API** (`apps/api`). It is derived **exclusively from source code inspection** — no values are invented.

---

## Quick Reference: Variable Inventory

| Variable | Used By | Required? | Secret? | Frontend-Exposed? |
|----------|---------|-----------|---------|-------------------|
| `NODE_ENV` | Both | Yes (prod) | No | No |
| `PORT` | Express API | No (host assigns) | No | No |
| `GMAIL_CLIENT_ID` | Both | Yes | Yes | **No** |
| `GMAIL_CLIENT_SECRET` | Both | Yes | Yes | **No** |
| `GMAIL_REDIRECT_URI` | Both | Yes | No | No |
| `GMAIL_TOKEN_KEY` | Both | Yes (prod) | Yes | **No** |
| `GMAIL_TARGET_EMAIL` | Both | Yes (prod) | No | No |
| `PILOT_ALLOWED_SENDERS` | Both | Yes (prod) | No | No |
| `PILOT_BATCH_2027_RECIPIENTS` | Both | Yes (prod) | No | No |
| `PILOT_BATCH_2028_RECIPIENTS` | Both | Yes (prod) | No | No |
| `PILOT_CC_EMAIL` | Both | Yes (prod) | No | No |
| `PILOT_ADMIN_EMAIL` | Both | Yes (prod) | No | No |
| `PILOT_ADMIN_PASSWORD` | Both | Yes (prod) | Yes | **No** |
| `PILOT_DB_PATH` | Both | Recommended | No | No |
| `PILOT_SYNC_INTERVAL_MS` | Both | No | No | No |
| `PILOT_DISABLE_POLLER` | Both | No (tests only) | No | No |
| `NEXT_PUBLIC_USE_MOCK_API` | Next.js | No | No | **Yes** |
| `DEFAULT_ORG_NAME` | Both | No | No | No |
| `CORS_ORIGIN` | Express API | Yes (prod) | No | No |
| `SUPABASE_URL` | Express API | Optional* | No | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Express API | Optional* | Yes | **No** |

\* Required only if using Supabase PostgreSQL instead of SQLite fallback.

---

## Detailed Variable Reference

### 1. Runtime Configuration

#### `NODE_ENV`
- **Purpose:** Standard Node environment flag; controls secure cookie flag, encryption fallback behavior, and build optimizations.
- **Required:** Yes in production (`production`); dev defaults to `development`.
- **Source:** Hosting platform (Render sets automatically).
- **Configure in:** Render Dashboard → Environment, or `.env.local` for dev.

#### `PORT`
- **Purpose:** Port the Express API (`apps/api`) listens on.
- **Required:** No — Render injects this automatically (e.g., `10000`).
- **Configure in:** Render Dashboard (do not set manually on Render).

---

### 2. Gmail OAuth (Application-Level Credentials)

> **Critical:** These identify **your Google Cloud OAuth client**, not a user mailbox. Every workspace authorizes its own mailbox through this single client. **Never** prefix with `NEXT_PUBLIC_`.

#### `GMAIL_CLIENT_ID`
- **Purpose:** Google Cloud OAuth 2.0 Client ID.
- **Required:** Yes (production & local dev).
- **Secret:** Yes — treat as a credential.
- **Source:** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs.
- **Configure in:** Render Dashboard → Environment (secret), `.env.local` (dev).

#### `GMAIL_CLIENT_SECRET`
- **Purpose:** Google Cloud OAuth 2.0 Client Secret.
- **Required:** Yes.
- **Secret:** Yes — high-value credential.
- **Source:** Same as Client ID.
- **Configure in:** Render Dashboard → Environment (secret), `.env.local` (dev).

#### `GMAIL_REDIRECT_URI`
- **Purpose:** Exact URI Google redirects to after consent.
- **Required:** Yes.
- **Format:** `https://<your-backend-host>/api/gmail/callback`
- **Derivation:** See [Deployment Guide §5](DEPLOYMENT.md#5-gmail-oauth-redirect-uri-derive--never-guess) — compose from verified deployed host + fixed route `/api/gmail/callback`.
- **Dev value:** `http://localhost:3000/api/gmail/callback`
- **Configure in:** Render Dashboard, Google Cloud Console (Authorized redirect URIs), `.env.local`.

---

### 3. Token Encryption (At-Rest Security)

#### `GMAIL_TOKEN_KEY`
- **Purpose:** AES-256-GCM key used to encrypt stored OAuth refresh/access tokens in the database.
- **Required:** **Yes in production** — boot fails fast / OAuth connect returns 503 if missing.
- **Secret:** Yes — loss = all stored tokens undecryptable.
- **Generation:** `openssl rand -hex 32` (produces 64 hex chars = 32 bytes).
- **Behavior:**
  - Production: **Must** be set via env var; file fallback is disabled.
  - Dev/test: Auto-generates a persistent key file at `<db-dir>/.token.key` (gitignored) if unset.
- **Rotate carefully:** Changing this invalidates all stored tokens — workspaces must re-connect Gmail.
- **Configure in:** Render Dashboard → Environment (secret), `.env.local` (dev).

---

### 4. Pilot / Workspace Bootstrap Seeds

> These are **one-time seeds** for the default workspace (`org_default`). After first boot, all values are managed from the UI (Settings → Workspace). Changing env vars later has **no effect** on existing rows.

#### `GMAIL_TARGET_EMAIL`
- **Purpose:** The mailbox the pilot monitors (used during OAuth connect flow).
- **Required:** Yes in production.
- **Format:** Single email address.
- **Configure in:** Render Dashboard, `.env.local`.

#### `PILOT_ALLOWED_SENDERS`
- **Purpose:** Comma-separated sender allowlist. **Empty = fail-closed** (all mail held for review).
- **Required:** Yes in production (at least one sender).
- **Configure in:** Render Dashboard, `.env.local`.

#### `PILOT_BATCH_2027_RECIPIENTS`
- **Purpose:** Comma-separated approved recipients for Batch 2027.
- **Required:** Yes in production.
- **Configure in:** Render Dashboard, `.env.local`.

#### `PILOT_BATCH_2028_RECIPIENTS`
- **Purpose:** Comma-separated approved recipients for Batch 2028.
- **Required:** Yes in production.
- **Configure in:** Render Dashboard, `.env.local`.

#### `PILOT_CC_EMAIL`
- **Purpose:** CC address applied to every forwarded email. **Empty = forwarding disabled**.
- **Required:** Yes in production.
- **Configure in:** Render Dashboard, `.env.local`.

#### `PILOT_ADMIN_EMAIL`
- **Purpose:** Default workspace admin email (seeded on first boot).
- **Required:** **Yes in production — boot fails fast if missing.**
- **Configure in:** Render Dashboard (secret), `.env.local`.

#### `PILOT_ADMIN_PASSWORD`
- **Purpose:** Default workspace admin password (seeded on first boot).
- **Required:** **Yes in production — boot fails fast if missing.**
- **Secret:** Yes.
- **Post-deploy:** **Must change in Settings → Profile after first login.**
- **Configure in:** Render Dashboard (secret), `.env.local`.

#### `DEFAULT_ORG_NAME`
- **Purpose:** Display name of the default workspace.
- **Required:** No (defaults to `"Main Workspace"`).
- **Configure in:** Render Dashboard (optional), `.env.local`.

---

### 5. Database & Persistence

#### `PILOT_DB_PATH`
- **Purpose:** Absolute path to SQLite database file.
- **Required:** Recommended for production (point at persistent disk).
- **Default:** `./data/pilot.db` (ephemeral on most PaaS).
- **Render value:** `/disks/pilot/data/pilot.db` (matches `render.yaml` disk mount).
- **Configure in:** Render Dashboard, `.env.local`.

---

### 6. Background Poller Tuning

#### `PILOT_SYNC_INTERVAL_MS`
- **Purpose:** Gmail poll interval in milliseconds.
- **Required:** No.
- **Default:** `60000` (60 s).
- **Minimum:** `15000` (15 s) — enforced in code.
- **Configure in:** Render Dashboard (optional), `.env.local`.

#### `PILOT_DISABLE_POLLER`
- **Purpose:** Disable background Gmail poller entirely.
- **Required:** No.
- **Use case:** Test environments only.
- **Never set in production.**

---

### 7. Frontend-Exposed Flags

#### `NEXT_PUBLIC_USE_MOCK_API`
- **Purpose:** Switches the entire frontend to isolated mock services (no real API calls).
- **Required:** No.
- **Frontend-exposed:** **Yes** — baked into browser bundle at build time.
- **Values:** `"true"` | unset (default: real API).
- **Use case:** Local demo / Cypress tests.
- **Never set in production.**

---

### 8. Express API Only (`apps/api`)

> These are **only** read by the standalone Express server in `apps/api`. The Next.js monolith at the repository root does **not** use them.

#### `CORS_ORIGIN`
- **Purpose:** Comma-separated list of allowed frontend origins for the Express API.
- **Required:** Yes in production.
- **Example:** `https://mail-automation.vercel.app,https://mail-automation-*.vercel.app`
- **Dev value:** `http://localhost:3000`
- **Configure in:** Render Dashboard, `.env.local` (apps/api).

#### `SUPABASE_URL`
- **Purpose:** Supabase project URL (PostgreSQL backend).
- **Required:** Optional* — if unset, Express API falls back to local SQLite (`PILOT_DB_PATH`).
- **Source:** Supabase Dashboard → Settings → API → Project URL.
- **Configure in:** Render Dashboard (optional).

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Purpose:** Supabase `service_role` key (bypasses RLS, admin access).
- **Required:** Optional* — paired with `SUPABASE_URL`.
- **Secret:** Yes — full database admin.
- **Source:** Supabase Dashboard → Settings → API → `service_role` secret.
- **Configure in:** Render Dashboard (secret).

---

## Deployment Target Configuration

### Render (Recommended — Single Web Service for Next.js App)

**File:** `render.yaml` (repository root)

| Variable | Value in `render.yaml` | Dashboard Action |
|----------|------------------------|------------------|
| `NODE_ENV` | `production` (hardcoded) | — |
| `PILOT_DB_PATH` | `/disks/pilot/data/pilot.db` (hardcoded) | Attach persistent disk first |
| `GMAIL_CLIENT_ID` | `sync: false` | **Set secret in dashboard** |
| `GMAIL_CLIENT_SECRET` | `sync: false` | **Set secret in dashboard** |
| `GMAIL_REDIRECT_URI` | `sync: false` | **Set in dashboard** (derived after deploy) |
| `GMAIL_TOKEN_KEY` | `sync: false` | **Set secret in dashboard** |
| `PILOT_ADMIN_EMAIL` | `sync: false` | **Set in dashboard** |
| `PILOT_ADMIN_PASSWORD` | `sync: false` | **Set secret in dashboard** |
| `GMAIL_TARGET_EMAIL` | `sync: false` | **Set in dashboard** |
| `PILOT_ALLOWED_SENDERS` | `sync: false` | **Set in dashboard** |
| `PILOT_CC_EMAIL` | `sync: false` | **Set in dashboard** |

> **Note:** `PILOT_BATCH_2027_RECIPIENTS` and `PILOT_BATCH_2028_RECIPIENTS` are **not** in `render.yaml` — add them manually in the Render dashboard.

### Render (Express API — `apps/api`)

**File:** `apps/api/render.yaml`

| Variable | Value in `render.yaml` | Dashboard Action |
|----------|------------------------|------------------|
| `NODE_ENV` | `production` (hardcoded) | — |
| `PILOT_DB_PATH` | `/disks/pilot/data/pilot.db` (hardcoded) | Attach persistent disk |
| `SUPABASE_URL` | `sync: false` | Set if using Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `sync: false` | **Set secret** if using Supabase |
| `CORS_ORIGIN` | `sync: false` | **Set** (Vercel frontend URL) |
| `GMAIL_CLIENT_ID` | `sync: false` | **Set secret** |
| `GMAIL_CLIENT_SECRET` | `sync: false` | **Set secret** |
| `GMAIL_REDIRECT_URI` | `sync: false` | **Set** (derived after deploy) |
| `GMAIL_TOKEN_KEY` | `sync: false` | **Set secret** |
| `PILOT_ADMIN_EMAIL` | `sync: false` | **Set** |
| `PILOT_ADMIN_PASSWORD` | `sync: false` | **Set secret** |
| `GMAIL_TARGET_EMAIL` | `sync: false` | **Set** |
| `PILOT_ALLOWED_SENDERS` | `sync: false` | **Set** |
| `PILOT_CC_EMAIL` | `sync: false` | **Set** |

> **Note:** Batch recipient variables (`PILOT_BATCH_2027_RECIPIENTS`, `PILOT_BATCH_2028_RECIPIENTS`) are missing from `apps/api/render.yaml` — add manually if using Express API.

### Vercel (Frontend Only — Not Currently Supported)

> **The Next.js monolith at repository root is NOT designed for Vercel deployment** (SQLite filesystem + background poller). Vercel deployment would require:
> 1. Migrating database to Supabase PostgreSQL (see `packages/database/schema.sql`).
> 2. Moving background poller to a dedicated worker (e.g., Render Background Worker or Upstash QStash).
> 3. Splitting frontend (Vercel) from API (Render).

**If/when frontend is split to Vercel**, only `NEXT_PUBLIC_*` variables go to Vercel:
- `NEXT_PUBLIC_USE_MOCK_API` (dev/demo only)

All other variables (especially secrets) **must remain on the backend host (Render)**.

### Supabase (PostgreSQL Backend — Optional)

Used only by `apps/api` Express server when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set.

**Required Supabase Setup:**
1. Create project at https://supabase.com
2. Run migrations from `packages/database/schema.sql` (and `policies/rls.sql` for RLS).
3. Copy **Project URL** → `SUPABASE_URL`
4. Copy **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`
5. Enable Realtime if using live features (not currently used).