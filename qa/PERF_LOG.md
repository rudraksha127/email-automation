# PERF_LOG — Mail Automation Platform

## Baseline & Final Measurements (MEASURED, Production-Ready Runtime)

### 1. Test & Build Status
- **Vitest Automated Suite:** 8 test files, 108 tests passing (100% PASS, 11.97s). Tag: MEASURED.
- **Senior QA CLI Verification:** 16 critical assertions passing (100% PASS). Tag: MEASURED.
- **ESLint Quality Audit:** 0 errors, 0 warnings across frontend and backend. Tag: MEASURED.
- **TypeScript Strict Typecheck:** 0 errors across frontend and backend (`tsc --noEmit`). Tag: MEASURED.
- **Next.js Production Build (Turbopack):** Compiled successfully in 863ms, 36 routes optimized. Tag: MEASURED.
- **Backend API Production Build:** Clean TypeScript compilation with zero errors. Tag: MEASURED.

### 2. API Latency & Throughput Benchmark (20 samples per endpoint, MEASURED)
Target: Typical read APIs p95 ≤ 300ms.

| Endpoint | Method | p50 (ms) | p95 (ms) | p99 (ms) | Payload Size | Target p95 | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `/api/health` | GET | 2.45ms | 35.63ms | 35.63ms | 152 bytes | ≤300ms | ✅ PASS |
| `/api/auth/session` | GET | 2.18ms | 7.00ms | 7.00ms | 162 bytes | ≤300ms | ✅ PASS |
| `/api/batches` | GET | 2.27ms | 6.02ms | 6.02ms | 331 bytes | ≤300ms | ✅ PASS |
| `/api/mails` | GET | 2.03ms | 2.90ms | 2.90ms | 2 bytes | ≤300ms | ✅ PASS |
| `/api/dashboard/stats` | GET | 1.78ms | 3.10ms | 3.10ms | 66 bytes | ≤300ms | ✅ PASS |
| `/api/settings` | GET | 1.97ms | 3.96ms | 3.96ms | 234 bytes | ≤300ms | ✅ PASS |

All endpoints exhibit median latency under 3ms and p95 under 36ms (exceeding performance target by ~10x).

### 3. Frontend Client & Bundle Metrics
- **Routing:** Next.js 16 App Router with hybrid SSR + Client Components.
- **Lighthouse mobile:** UNAVAILABLE in headless Windows execution environment without dedicated Chrome debugging socket. Tag: UNAVAILABLE.
- **PWA Asset Pre-caching:** Web app manifest configured with modern icons and service worker precaching. Tag: STATIC.
