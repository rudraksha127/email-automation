# Mail Automation Platform

Admin platform for an IT Department that automates incoming Gmail emails and
forwards them to the correct academic batch/year recipients.

## Architecture

| Folder | Deploy Target | Description |
|--------|---------------|-------------|
| `frontend/` | **Vercel** | Next.js 16 PWA — UI pages, components, client services |
| `backend/` | **Render** | Express API — Gmail OAuth, poller, REST endpoints |
| `database/` | **Supabase** | PostgreSQL DDL, migrations, RLS policies, seed data |

## Tech Stack

- **Frontend:** Next.js 16 (React 19) + TypeScript + Tailwind CSS v4, installable PWA
- **Backend:** Express.js + TypeScript — background Gmail poller + REST API
- **Database:** Supabase PostgreSQL (SQLite fallback for local dev)
- **Email:** Gmail API (OAuth 2.0) — credentials never in frontend code
- **Tests:** Vitest (unit + API integration)

## Quickstart (local development)

```bash
# Install all workspace dependencies
npm ci

# Frontend (Next.js)
cp frontend/.env.example frontend/.env.local
npm run dev                    # http://localhost:3000

# Backend (Express API) — separate terminal
cp backend/.env.example backend/.env.local
npm run dev:backend            # http://localhost:3001
```

Useful commands:

```bash
npm test              # frontend tests
npm run typecheck     # typecheck frontend + backend
npm run build         # production build (frontend)
npm run build:backend # production build (backend)
```

## Environment & Deployment

| Platform | Env File | Docs |
|----------|----------|------|
| Vercel (frontend) | [`frontend/.env.example`](frontend/.env.example) | Vercel dashboard → Environment Variables |
| Render (backend) | [`backend/.env.example`](backend/.env.example) | [`backend/render.yaml`](backend/render.yaml) blueprint |
| Supabase (database) | [`database/.env.example`](database/.env.example) | [`database/README.md`](database/README.md) |

Deployment guide: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

Real secrets never belong in git — `.env*`, `data/`, and token files are
gitignored and verified by CI.

## Repository Map

```
email-automation/
├── frontend/               ➔ VERCEL — Next.js 16 PWA
│   ├── src/
│   │   ├── app/            UI routes (pages + API proxy rewrites)
│   │   ├── components/     Shared React components
│   │   ├── hooks/          Auth context, custom hooks
│   │   ├── services/       API client services (real + mock)
│   │   ├── lib/            Shared utilities
│   │   └── types/          TypeScript interfaces
│   ├── tests/              Vitest test suites
│   ├── public/             PWA assets (manifest, sw.js, icons)
│   ├── next.config.ts      API proxy to backend via rewrites
│   └── .env.example
│
├── backend/                ➔ RENDER — Express API + Gmail Poller
│   ├── src/
│   │   ├── server.ts       Express server + background poller
│   │   ├── routes/         REST API route handlers
│   │   ├── lib/            Core logic (db, gmail, pipeline, crypto)
│   │   ├── middleware/     Auth middleware
│   │   └── types/          Shared type definitions
│   ├── render.yaml         Render Blueprint (rootDir: backend)
│   └── .env.example
│
├── database/               ➔ SUPABASE — PostgreSQL
│   ├── schema.sql          Table definitions (paste in SQL Editor)
│   ├── seed.sql            Initial roles & demo data
│   ├── migrations/         Incremental schema changes
│   └── policies/           Row-Level Security (RLS) policies
│
├── docs/                   Deployment & environment docs
├── scripts/                Build utilities (icon generation)
└── .github/workflows/      CI (lint, typecheck, tests, build)
```

## Status

🚧 Under active development — repository restructured for split deployment
(Vercel + Render + Supabase). Deployment pending hosting credentials and
Google OAuth configuration.
