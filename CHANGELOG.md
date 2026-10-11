# 📝 Changelog

All notable changes to the Mail Automation & Batch Distribution Platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-12

### 🚀 Production Release & Institutional Shift
- **Shift to Production Architecture:** Completed full transition from pilot prototype to enterprise-ready production deployment.
- **Institutional Alignment:** Set primary institutional target email to `placementit@acropolis.in` across backend, frontend, database fallbacks, and connection metadata.
- **Credential Rotation:** Rotated administrative master credentials using cryptographic `scrypt` key derivation with random UUID salt and `timingSafeEqual` comparison.
- **Zero Secret Commits:** Verified 100% exclusion of secrets, keys, and environment variables across git history and working tree.

### ✨ Features & Enhancements
- **Autonomous 24/7 Email Poller:** Implemented a continuous 60-second polling daemon for unattended background email ingestion and forwarding.
- **Idempotent Delivery Guarantee:** Added database-level unique constraints preventing duplicate message deliveries during process reboots or network latency.
- **Multi-Batch Forwarding & Deduplication:** Support for targeting multiple cohorts simultaneously with automated recipient deduplication.
- **Mandatory CC Compliance:** Enforced institutional CC compliance on all outbound mailings.
- **Modern Responsive UI & PWA:** Optimized responsive layout for all mobile viewports including iPhone SE; added accessible drawer navigation, password visibility controls, and progressive web app manifest with SVG/PNG icons.

### 🧹 Maintenance & Cleanup
- **Documentation Overhaul:** Removed obsolete debug reports, temporary loop states, and scratch files (`ALL_IN_ONE_MASTER_PROMPT.md`, `docs/auth-debug-report.md`, `qa/*.md`).
- **Standardized Operational Docs:** Added production `RUNBOOK.md`, `ENV_VARS.md`, and updated `README.md`.
- **Pre-Release Baseline Snapshot:** Tagged `pre-release` on commit `fb98039` and created database snapshot `data/pilot.db.prod-deploy-backup-*` for zero-downtime rollback capability.

### 🧪 Verification & Quality Gate
- **Unit & Integration Tests:** 109 / 109 tests passing in Vitest (100% pass rate).
- **Static Analysis:** 0 ESLint errors, 0 TypeScript errors across frontend and backend.
- **Production Build:** 37 / 37 Next.js pages successfully generated without errors.
- **API Performance:** p95 latency between 2.13ms and 54.07ms (well below the 500ms SLA threshold).
- **Vulnerability Audit:** 0 Critical, 0 High vulnerabilities in production dependencies.
