# Environment Variables Reference

> **Security Mandate:** This document contains **variable names and specifications ONLY**. No passwords, tokens, API keys, or secret values are permitted in this file.

---

## 1. Application-Level Environment Variables

| Variable Name | Component | Required in Prod? | Type | Description | Where to Set |
|---|---|:---:|:---:|---|---|
| `NODE_ENV` | Backend & Frontend | Yes | Non-secret | Controls production optimization, secure cookie flags, and error details suppression (`production`). | Hosting dashboard (Render / Vercel) |
| `PORT` | Backend API | No | Non-secret | Port Express listens on (defaults to `3001` or platform injected like `10000`). | Render environment |
| `CORS_ORIGIN` | Backend API | Yes | Non-secret | Comma-separated list of allowed frontend origins (e.g. `https://your-domain.vercel.app`). | Render environment |
| `FRONTEND_URL` | Backend API | Yes | Non-secret | Base URL of frontend application for OAuth redirects. | Render environment |
| `BACKEND_API_URL` | Frontend | Yes | Non-secret | Server-side API endpoint for Next.js proxy rewrites to Express backend. | Vercel / hosting environment |

---

## 2. Security & Encryption Credentials

| Variable Name | Component | Required in Prod? | Type | Description | Where to Set |
|---|---|:---:|:---:|---|---|
| `GMAIL_TOKEN_KEY` | Backend | **Yes** | **SECRET** | 256-bit AES-GCM encryption key (64 hex characters) used to encrypt stored OAuth refresh/access tokens at rest. | Render secret environment |
| `GMAIL_CLIENT_ID` | Backend | **Yes** | **SECRET** | Google Cloud OAuth 2.0 Client ID for Gmail API access. | Render secret environment |
| `GMAIL_CLIENT_SECRET` | Backend | **Yes** | **SECRET** | Google Cloud OAuth 2.0 Client Secret. | Render secret environment |
| `GMAIL_REDIRECT_URI` | Backend | **Yes** | Non-secret | Exact callback URL registered in Google Cloud Console (`https://<backend-host>/api/gmail/callback`). | Render environment & Google Console |

---

## 3. Departmental Mail & Routing Configuration

| Variable Name | Component | Required in Prod? | Type | Description | Where to Set |
|---|---|:---:|:---:|---|---|
| `GMAIL_TARGET_EMAIL` | Backend | Yes | Non-secret | Connected incoming institutional inbox (e.g. `placementit@acropolis.in`). | Render environment |
| `PILOT_CC_EMAIL` | Backend | Yes | Non-secret | Institutional department CC email address appended to all automated outgoing forwards for auditing. | Render environment |
| `PILOT_ALLOWED_SENDERS` | Backend | Yes | Non-secret | Comma-separated allowlist of authorized sender emails eligible for automatic distribution. | Render environment |
| `PILOT_BATCH_2027_RECIPIENTS` | Backend | Yes | Non-secret | Comma-separated recipient student emails for Batch 2027. | Render environment |
| `PILOT_BATCH_2028_RECIPIENTS` | Backend | Yes | Non-secret | Comma-separated recipient student emails for Batch 2028. | Render environment |

---

## 4. Administrative Credentials & Database

| Variable Name | Component | Required in Prod? | Type | Description | Where to Set |
|---|---|:---:|:---:|---|---|
| `PILOT_ADMIN_EMAIL` | Backend | **Yes** | Non-secret | Primary administrative administrator account email (e.g. `placementit@acropolis.in`). | Render environment |
| `PILOT_ADMIN_PASSWORD` | Backend | **Yes** | **SECRET** | Administrative account password for departmental sign-in. Never commit. | Render secret environment |
| `PILOT_DB_PATH` | Backend | No | Non-secret | Local SQLite database file path (e.g. `./data/pilot.db`). | Render persistent disk |
| `PILOT_SYNC_INTERVAL_MS` | Backend | No | Non-secret | Polling frequency for 24/7 background worker (defaults to `60000` = 60s). | Render environment |
| `PILOT_DISABLE_POLLER` | Backend | No | Non-secret | Set to `true` strictly in automated test runners to disable background timers. | Test runner only |

---

## 5. Client-Side Variables (Browser Exposed)

| Variable Name | Component | Required in Prod? | Type | Security Assessment |
|---|---|:---:|:---:|---|
| `NEXT_PUBLIC_USE_MOCK_API` | Frontend | No | Non-secret boolean | Safe. Used strictly for offline mock demos. Must NOT be true in production. |
| `NEXT_PUBLIC_API_URL` | Frontend | No | Non-secret URL | Safe. Public API host identifier if direct client calls are enabled. |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | No | Non-secret URL | Safe. Public project URL identifier if Supabase client is used. |
