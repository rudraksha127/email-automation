# QA REPORT — Mail Automation Portal (AUTO mode, 5-round budget)

**App under test:** http://localhost:3002 (Next.js 16 frontend) + http://localhost:3001 (Express API)
**Baseline tag:** `qa-baseline` (56bd501) · **Test account:** admin@institution.edu

## 1. Coverage
- **Tested (browser, real-user flows):** Auth (login happy/wrong-password/protected-route/404/deep-links), Dashboard, Batches CRUD (create/edit via UI, recipient add + persistence-after-refresh, **bulk upload: template→preview→import→idempotency**, delete), Mails (list/empty/search toggle), Settings (Gmail connection status), Profile (display, team invite+remove), navigation header/workspace switcher.
- **API assertions (curl):** preflight CORS, bulk import create/dedupe/idempotency, batch recipient CRUD, health/session latency ×30.
- **Not tested & why:** Google OAuth real consent (needs interactive Google account + production redirect URI registration), real mail pipeline end-to-end (requires a live connected Gmail — "Not Connected" in local pilot), Lighthouse mobile (UNAVAILABLE in this environment), production build/bundle analysis (time budget), 3 pre-existing backend pipeline test files (tenants/pilot/rules — failing at baseline, out of scope per no-rewrite rule, flagged below).

## 2. Bugs
| ID | Severity | Status | Fix | Regression test |
|---|---|---|---|---|
| BUG-001 CORS rejects the QA frontend port (login impossible from :3002) | Critical | **FIXED** | `backend/.env.local`: `CORS_ORIGIN=http://localhost:3000,http://localhost:3002`, `FRONTEND_URL=http://localhost:3002`; backend restarted | Verified: OPTIONS preflight → 204 + `Access-Control-Allow-Origin: :3002`; browser login bad-creds → proper 401 message, good-creds → dashboard (MEASURED) |
| BUG-002 Frontend port not in env allowlist by default | Low | DOCUMENTED | Same as BUG-001 | covered by BUG-001 verification |
| BUG-003 API latency suspicion | Medium(perf) | CLOSED | none needed | /api/health, /api/batches, /api/auth/session: p50 1.2–1.5ms, p95 1.3–1.8ms (target ≤300ms) (MEASURED, 10 samples each) |

## 3. Performance
| Metric | Baseline | Final | Delta | Tag |
|---|---|---|---|---|
| GET /api/batches p95 | 1.8ms | 1.8ms | — | MEASURED, target PASS |
| GET /api/health p95 | 1.3ms | 1.3ms | — | MEASURED, target PASS |
| GET /api/auth/session p95 | 1.6ms | 1.6ms | — | MEASURED, target PASS |
| Lighthouse mobile | UNAVAILABLE | UNAVAILABLE | — | not runnable in env |
No optimization round triggered: no open Critical/High bugs and zero failing perf targets (Rule C). No fixes degraded any metric (nothing changed perf-wise except env).

## 4. Changes by commit
- `fix: BUG-001 CORS allowlist` — `backend/.env.local` (env-only, no code change; **rollback: restore previous two lines**)
- `test: regression for bulk batch import (dedupe + idempotency)` — frontend/tests/api.test.ts (16/16 pass; fails-before verified logically: new route had no test before)
- Previous commits already on main (`c85e5cc` sessions, `56bd501` bulk upload) unchanged.

## 5. BLOCKED / decisions needed
- 3 pre-existing failing backend pipeline test files (tenants.test.ts, pilot.test.ts, rules.test.ts): failing at baseline before any of today's changes. Root cause looks like changed pipeline semantics (expected `unauthorized_held` got `unauthorized_ignored`; `null` org lookups). **Decision needed:** are these stale tests to be updated (behavior change) or real bugs to fix in the pipeline? Confirming counts as a behavior-change approval.
- Lighthouse run needs a non-headless-restricted environment or production build — rerun on request.

## 6. Remaining bottlenecks / next steps
- Update the 3 stale pipeline tests (or fix the pipeline) once semantics are confirmed.
- Run `next build` + Lighthouse mobile against production build for bundle/TBT numbers.
- Real Gmail connection E2E (connect mailbox → poll → forward) in staging where a test Google account can consent.
