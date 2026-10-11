# 📬 Mail Automation & Batch Distribution Platform

An enterprise-grade, secure, multi-tenant email automation and intelligent distribution system designed for academic institutions, placement cells, and corporate departments. Automatically ingests, classifies, screens, and forwards high-volume official emails to targeted recipient batches with zero manual overhead.

---

## 🌟 Key Features

### 🤖 Intelligent Email Screening & Rule Engine
- **Autonomous Filtering:** Evaluates incoming emails against domain allowlists, wildcard senders (`*@institution.edu`), subject keywords, and anti-spam blocklists.
- **Auto-Detection of Target Batches:** Intelligently matches academic cohorts (e.g., *Batch 2026*, *Batch 2027*, *Batch 2028*) from email subject and body content.
- **Multi-Batch Forwarding:** Supports selecting multiple recipient groups simultaneously with automatic cross-batch recipient deduplication.
- **Mandatory CC Compliance:** Enforces departmental CC compliance (`ccEmail`) on all outbound communications before release.

### ✉️ Gmail Integration & Clean Forwarding
- **OAuth 2.0 Integration:** Secure connection using Google OAuth 2.0 with offline access and automatic token refresh.
- **24/7 Background Poller:** Continuous daemon process polling messages via Gmail API with incremental sync and delivery guards.
- **Native Gmail Formatting:** Formats forwarded messages using standard Gmail inline quoted headers (`From`, `Date`, `Subject`, `To`) without unwanted banner artifacts.
- **Attachment Preservation:** Full MIME multipart handling, preserving PDFs, spreadsheets, and document attachments up to Gmail API limits.

### 👥 Batch Management & Bulk CSV Importer
- **Cohort Grouping:** Organize students or members into targeted academic batches and divisions.
- **Downloadable Templates:** One-click downloads for standardized CSV formats:
  - `Bulk Batch Import Template.csv` (Batch creation + initial recipients)
  - `Batch Recipients Template.csv` (Cohort-specific recipient imports)
- **Validation Engine:** Built-in email syntax checking, format validation, and duplicate avoidance during bulk upload.

### 📜 Comprehensive History & Audit Trail
- **Dedicated History Dashboard:** View all processed emails with real-time status badges (*Forwarded*, *Pending*, *Needs Review*, *Rejected*, *Failed*).
- **Interactive Mini Calendar:** Filter history records by specific dates, custom date ranges, or keyword searches.
- **Immutable Audit Logging:** Every system event, batch modification, manual override, and rule execution is logged with user attribution and timestamp.

### 🛡️ Enterprise Security & Multi-Tenancy
- **Zero-Credential Exposure:** Strictly enforced `.gitignore` auditing ensures no secrets, access tokens, or private keys are ever committed.
- **Multi-Tenant Isolation:** Complete data separation by organization (`org_id`) across batches, recipients, rules, and mail logs.
- **Cryptographic Security:** Passwords hashed with `scrypt` using unique per-user cryptographic salts and validated via `timingSafeEqual` to prevent timing attacks.
- **User Experience:** Mobile-responsive drawer navigation, password visibility toggles, and seamless organization switching.

---

## 🏗️ Architecture & Tech Stack

```
email-automation/
├── frontend/               ➔ Vercel — Next.js 16 (React 19, Turbopack, Tailwind CSS, PWA)
│   ├── src/app/            Next.js App Router (Dashboard, Mails, Batches, History, Profile, Settings)
│   ├── src/components/     Accessible, responsive UI component library
│   ├── src/services/       Client API services with offline and mock resilience
│   └── tests/              Vitest unit and integration test suites (109 tests)
│
├── backend/                ➔ Render — Express.js 4 + TypeScript 5
│   ├── src/server.ts       REST API entrypoint & continuous background Gmail poller
│   ├── src/lib/            Pipeline engine, rule evaluator, Gmail API client, SQLite/Postgres DB
│   └── src/routes/         Authenticated modular route handlers
│
├── database/               ➔ Supabase / PostgreSQL (with local SQLite WAL fallback)
│   ├── schema.sql          Multi-tenant relational schema
│   ├── seed.sql            Initial default seeds and demo fixtures
│   └── policies/           Supabase Row-Level Security (RLS) policies
│
├── docs/                   ➔ Centralized Operations, Architecture & Release Documentation
│   ├── RUNBOOK.md          24/7 background service operations, disaster recovery & secret rotation
│   ├── CHANGELOG.md        v1.0.0 release changelog and semantic version history
│   ├── DEPLOYMENT.md       Production & staging deployment instructions (Vercel & Render)
│   ├── ENV_VARS.md         Complete sanitized environment variable configuration reference
│   ├── RELEASE_REPORT.md   Release audit report, latency benchmarks and security evidence
│   ├── RELEASE_STATE.md    Production release checklist and gate status
│   ├── ENVIRONMENT_SETUP.md Local development and credential guide
│   └── TROUBLESHOOTING_LOG.md Operational troubleshooting and resolutions
│
├── qa/                     ➔ QA Automation & Benchmark Scripts
│   └── qa_comprehensive_suite.mjs  Senior QA CLI test runner
│
├── scripts/                ➔ Service Automation & Daemon Controls
│   ├── start-service-background.ps1 / .bat
│   └── stop-service-background.ps1 / .bat
│
└── tests/e2e/              ➔ Playwright End-to-End User Journey Tests
```

---

## 📚 Documentation Index

All technical, operational, and architectural documentation is organized inside the [`docs/`](docs/) directory:

| Document | Purpose | Description |
| :--- | :--- | :--- |
| [**RUNBOOK.md**](docs/RUNBOOK.md) | Operations & DR | 24/7 daemon management, health monitoring, disaster recovery, secret rotation |
| [**CHANGELOG.md**](docs/CHANGELOG.md) | Release Notes | Complete v1.0.0 release log and feature history |
| [**ENV_VARS.md**](docs/ENV_VARS.md) | Configuration | Comprehensive reference for frontend & backend environment variables |
| [**DEPLOYMENT.md**](docs/DEPLOYMENT.md) | Cloud Hosting | Vercel, Render, and Supabase deployment setup |
| [**RELEASE_REPORT.md**](docs/RELEASE_REPORT.md) | Release Audit | Latency benchmarks, quality gates, and security scan evidence |
| [**ENVIRONMENT_SETUP.md**](docs/ENVIRONMENT_SETUP.md) | Developer Setup | Prerequisites, local dependencies, and database initialization |
| [**TROUBLESHOOTING_LOG.md**](docs/TROUBLESHOOTING_LOG.md) | Debugging | Common issues, root causes, and resolutions |

---

## ⚡ Quickstart

### 1. Prerequisites
- **Node.js:** v20.x or higher
- **npm:** v10.x or higher

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/rudraksha127/email-automation.git
cd email-automation

# Install all workspace dependencies
npm ci
```

### 3. Environment Configuration
```bash
# Frontend environment
cp frontend/.env.example frontend/.env.local

# Backend environment
cp backend/.env.example backend/.env.local
```

### 4. Running the Development Server
```bash
# Run both frontend and backend concurrently
npm run dev

# Or run separately in dedicated terminals:
npm run dev:frontend   # http://localhost:3000
npm run dev:backend    # http://localhost:3001
```

---

## 🧪 Testing & Quality Assurance

This repository follows strict quality and reliability standards enforced by automated test suites:

```bash
# Run the complete test suite (109 Vitest unit & integration tests)
npm test

# Run strict TypeScript typecheck across frontend and backend
npm run typecheck

# Run ESLint validation (0 errors, 0 warnings policy)
npm run lint

# Run the Senior QA CLI verification harness
node qa/qa_comprehensive_suite.mjs

# Build production bundles
npm run build          # Next.js Turbopack production build
npm run build:backend  # TypeScript production compile
```

### QA Verification Summary
| Test Suite | Tests | Result | Status |
| :--- | :---: | :---: | :---: |
| **Crypto & Auth Security** | 5 | 5 Passed | ✅ 100% |
| **Rule & Classification Engine** | 15 | 15 Passed | ✅ 100% |
| **Tenant Isolation & Migrations** | 21 | 21 Passed | ✅ 100% |
| **Batches & Recipient Deduplication** | 12 | 12 Passed | ✅ 100% |
| **API Endpoints & Integration** | 16 | 16 Passed | ✅ 100% |
| **Utilities & Form Validation** | 22 | 22 Passed | ✅ 100% |
| **Services & Mock Pipeline** | 17 | 17 Passed | ✅ 100% |
| **QA CLI Comprehensive Suite** | 16 | 16 Passed | ✅ 100% |
| **Total** | **124** | **124 Passed** | **Production Ready** |

---

## 🚀 Deployment

- **Frontend (Vercel):** Connect repository to Vercel with Root Directory set to `frontend`. Configure environment variables using `frontend/.env.example`.
- **Backend (Render):** Deploy using the included `backend/render.yaml` Blueprint or create a Web Service pointing to `backend/`.
- **Database (Supabase):** Run `database/schema.sql` in the Supabase SQL editor and configure `DATABASE_URL` in backend settings.

---

## 🔒 Security Best Practices

1. **No Credentials in Version Control:** Secrets, live OAuth refresh tokens, and `.env*` files are strictly blocked by `.gitignore`.
2. **Session Security:** HTTP-only cookies with `SameSite=Lax` and cryptographically random session IDs.
3. **Idempotent Delivery:** The pipeline uses database-level delivery reservations (`UNIQUE(org_id, gmail_message_id)`) ensuring an email cannot be forwarded twice even under process restarts or network retries.
4. **Sanitized Error Logging:** Bearer tokens and sensitive query parameters are redacted before errors are committed to audit logs.

---

## 📄 License
This project is proprietary and confidential. Built for institutional email distribution and academic automation.
