# Mail Automation PWA

Admin PWA for an IT Department that automates incoming Gmail emails and forwards
them to the correct academic batch/year recipients.

## Build Phases

Implemented incrementally, one phase at a time (each phase is fully tested before push):

- [x] Phase 0 — Approved UI converted to a functional frontend
- [x] Phase 1 — PWA foundation & architecture
- [ ] Phase 2 — UI polish pass
- [x] Phase 3 — Secure admin authentication
- [x] Phase 4 — Batch & recipient management
- [x] Phase 5 — Gmail integration & auto-forwarding engine
- [x] Phase 6 — Mail management module
- [x] Phase 7 — Backend hardening (security / APIs / rate limiting / health)
- [ ] Phase 8 — Production readiness & deployment

## Tech Stack

- **Frontend:** Next.js (React) + TypeScript + Tailwind CSS, installable PWA
- **Backend:** Next.js API route handlers (clean service/layer architecture)
- **Database:** SQLite via built-in `node:sqlite` (local/pilot) — schema is
  created idempotently on boot; a Supabase PostgreSQL migration is planned for
  multi-instance production
- **Email:** Gmail API (OAuth 2.0) — credentials never in frontend code
- **Tests:** Vitest (unit + API integration), 106 tests

## Quickstart (local development)

```bash
npm ci
cp .env.example .env.local   # then fill in real pilot values
npm run dev                  # http://localhost:3000
```

Useful commands:

```bash
npm test         # unit + API integration tests (uses isolated fixtures)
npm run typecheck
npm run lint
npm run build    # production build
npm start        # production server
```

Without `.env.local` the app still boots (fail-closed): empty allowlist, no CC,
and a dev admin seeded with a generated password printed to the console.

## Environment & deployment

- All supported variables: [`.env.example`](.env.example)
- Deployment instructions (Render, env vars, OAuth redirect URI derivation,
  rollback): [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (secret scan,
  lint, typecheck, tests, production dependency audit, build)

Real secrets never belong in git — `.env*`, `data/`, and token files are
gitignored and verified by the CI secret scan.

## Repository map

```
.
|-- src/                  # The application (Next.js App Router)
|   |-- app/              #   UI routes + backend API route handlers (same process)
|   |-- components/       #   Shared UI components + design tokens consumer
|   |-- hooks/ lib/ services/ routes/ types/ utils/
|-- tests/                # Vitest unit + API integration suites
|-- public/               # PWA runtime assets (manifest, sw.js, icons, offline.html)
|-- design/               # Approved Google Stitch references (NOT bundled)
|   `-- stitch-references/stitch_faculty_student_count_app/   (19 screens)
|-- database/             # Schema documentation (DDL lives in src/lib/db.ts)
|-- docs/                 # DEPLOYMENT.md
|-- scripts/              # Icon generation
|-- .github/workflows/    # CI (secret scan, lint, typecheck, tests, build)
`-- render.yaml           # Production blueprint (persistent disk + secrets)
```

The frontend and backend are **one deployable unit by design**: Next.js
route handlers (`src/app/api/**`) serve the same origin as the UI, so a
single Render web service runs everything (see `docs/DEPLOYMENT.md` §2).

## Design references

Approved Google Stitch layouts (19 screen folders, each with `code.html` +
`screen.png`) are preserved in
[`design/stitch-references/`](design/stitch-references/) and are the source
of truth for UI fidelity — they are documentation, never shipped in the
production bundle. PWA icons can be regenerated from the brand SVG with
`node scripts/generate-pwa-icons.mjs`.

## Status

🚧 Under active development — hardening/testing phase complete; deployment
pending hosting credentials and Google OAuth configuration.
