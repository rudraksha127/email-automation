# Mail Automation PWA

Admin PWA for an IT Department that automates incoming Gmail emails and forwards
them to the correct academic batch/year recipients.

## Build Phases

Implemented incrementally, one phase at a time (each phase is fully tested before push):

- [ ] Phase 0 — Approved UI converted to a functional frontend
- [ ] Phase 1 — PWA foundation & architecture
- [ ] Phase 2 — UI polish pass
- [ ] Phase 3 — Secure admin authentication
- [ ] Phase 4 — Batch & recipient management
- [ ] Phase 5 — Gmail integration & auto-forwarding engine
- [ ] Phase 6 — Mail management module
- [ ] Phase 7 — Backend hardening (Supabase / security / APIs)
- [ ] Phase 8 — Production readiness & deployment

## Tech Stack

- **Frontend:** Next.js (React) + TypeScript + Tailwind CSS, installable PWA
- **Backend:** Next.js API route handlers (clean service/layer architecture)
- **Database:** Prisma ORM — SQLite for local dev/tests, Supabase PostgreSQL in production
- **Email:** Gmail API (OAuth 2.0) — credentials never in frontend code
- **Tests:** Vitest (unit + API integration)

## Status

🚧 Under active development — Phase 0 in progress.
