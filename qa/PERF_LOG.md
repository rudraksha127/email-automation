# PERF_LOG

## Baseline (Round 0) — 2026-10-11
- Lighthouse mobile: UNAVAILABLE in this budget (headless audit not runnable); no mocked numbers. Tag: UNAVAILABLE.
- vitest baseline: 3 failed test files (tenants/pilot/rules backend pipeline tests) — pre-existing, unrelated to UI. Tag: MEASURED.
- Typechecks: backend 0 errors, frontend 0 errors (verified this session). Tag: MEASURED.

## Round 1 measurements — local Express :3001 (curl, 10 samples each, sorted, MEASURED)
| Endpoint | p50 | p95 | Target p95 | Verdict |
|---|---|---|---|---|
| GET /api/health | 1.2ms | 1.3ms | ≤300ms | PASS (recorded to close PERF entry BUG-003) |
| GET /api/batches (authed) | 1.5ms | 1.8ms | ≤300ms | PASS |
| GET /api/auth/session (authed) | 1.3ms | 1.6ms | ≤300ms | PASS |

## Frontend bundle/build
- Production build NOT run in this sweep (dev server serving :3002). Tag: UNAVAILABLE this round.
