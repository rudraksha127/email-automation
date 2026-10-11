# BUGS

| ID | Sev | Steps | Expected vs Actual | Evidence | Suspected root cause | Status |
|----|-----|-------|--------------------|----------|---------------------|--------|
| BUG-001 | Critical | Frontend on :3002, click Sign In with valid creds | Login succeeds vs "Origin is not allowed" | curl OPTIONS :3001 Origin 3002 → 403; browser error banner | `backend/.env.local` CORS_ORIGIN/FRONTEND_URL listed only :3000 | FIXED — .env.local now `http://localhost:3000,http://localhost:3002`; backend restarted; OPTIONS preflight → 204 + ACAO:3002; login via :3002 returns "Invalid email or password" for bad creds and 302→dashboard for good ones (MEASURED) |
| BUG-002 | Low | :3002 frontend adds a second dev port — CORS/cookies only worked for :3000 | Any non-3000 port breaks auth silently | BUG-001 | Same as BUG-001 — env not port-agnostic | FIXED with BUG-001. Note: production unaffected (Vercel origin listed). Recommendation: run frontend on the default :3000 to keep API/session config canonical |
| BUG-003 (perf) | Medium | :3001 Express health/batches/session under 10-req curl | — | p95 batches 1.8ms, health 1.3ms, session 1.6ms (MEASURED, local) — all far below the 300ms target | none at this scale | CLOSED — no action needed (pilot scale) |
