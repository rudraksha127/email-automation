# 🔧 Troubleshooting & Issue Log

Running record of issues encountered, root causes diagnosed, and fixes applied.
Latest entries first. Append new entries below the heading — keep the format consistent.

---

## 2026-10-11 — Bulk upload for Batches (CSV template download + import)

### Request
- On the Batches page: download a template (Excel/CSV format), fill it with batch data, upload it back, and have the batches created automatically.

### Implementation
1. **Template download** — `downloadBulkBatchesTemplate()` in `frontend/src/utils/csv.ts` downloads `bulk-batches-template.csv` with header `Batch Name,Description,Student Name,Email` and 3 example rows. Opens directly in Excel.
2. **Parser** — `parseBulkBatchesCsv()` validates batch names (≤80 chars), student emails, per-batch duplicate emails; collects all invalid rows with row numbers and reasons instead of failing the whole file.
3. **Upload UI** — "Bulk Upload" button (Variant secondary) next to Add Batch on `frontend/src/app/batches/page.tsx`. File → parsed preview modal: valid-row count, invalid-row warnings, unique-batch count, first 20 rows; Import button posts only valid rows.
4. **API** — `POST /api/batches/import` on the **Express backend** (`backend/src/routes/batches.ts`, registered before `/:id` routes): creates missing batches, reuses existing ones by case-insensitive name, adds recipients deduped per batch, skips invalid rows, caps at 5000 rows/audit-logged. Same route also exists in `frontend/src/app/api/batches/import/route.ts` (Next.js API, fallback for non-proxy deployments) and mock service.
5. **Service layer** — `batchesService.bulkImport(rows)` added to interface, Api and Mock implementations.

### Verification (live, localhost:3001 Express)
- typecheck: backend 0 errors, frontend 0 errors; api+services tests 2/2 files pass.
- Import of 5-row test CSV → `{batchesCreated:2, batchesReused:0, recipientsAdded:3, invalidRows:1}` (invalid email row skipped).
- Re-import same file → `{batchesCreated:0, batchesReused:2, recipientsAdded:0}` — idempotent dedupe works.
- QA test batches cleaned up after verification.

### Note
- Format chosen is CSV (not .xlsx) intentionally: zero new dependencies, Excel opens/saves CSV natively, and the project already had CSV import infrastructure. If true .xlsx support is later needed, a SheetJS-based parser would be added.

---

## 2026-10-11 — Long-lived sessions (PWA no daily password) + Gmail connection stays after logout

### Request
- Once Gmail is connected, it should NOT disconnect on logout/re-login.
- Once the PWA is installed on mobile and the user signs in once, it should never ask for the password daily — save the session and open directly.

### Findings
- **Gmail connection was already workspace-level** (`gmail_tokens` keyed by `org_id`, not by session). Logout only deletes the session row — tokens persist. Verified `GET /api/gmail/connection` reflects the org's connected mailbox regardless of who is signed in. No change needed.

### Changes (session lifetime)
1. **`backend/src/middleware/auth.ts`** — session TTL 7d → **30 days**, plus **rolling expiry**: every authenticated request slides `expires_at` forward (rewrite throttled to once per hour of gained time) so an actively used device effectively never logs out.
2. **`backend/src/lib/auth.ts`** — `TTL_MS` 30d for newly created sessions.
3. **`backend/src/routes/auth.ts`** — `setSessionCookie` `maxAge` 30d (matches server TTL).
4. **`frontend/src/lib/auth.ts`** — mirrored 30d TTL + cookie maxAge for the frontend-rendered session cookie.

### Verification (live, after backend restart)
- Login `Set-Cookie: ma_session=…; Max-Age=2592000` (30 days) ✅
- `GET /api/auth/session` 200 ✅
- Backend typecheck: 0 errors; frontend typecheck: 0 errors; `tests/api.test.ts` 15/15 ✅

### Notes
- Users still in an old 7-day session keep it until it expires, then get a 30-day one on next login.
- Security tradeoff documented: 30-day httpOnly rotating-hex sessions are acceptable for this internal pilot; logout still immediately kills the session server-side.

---

## 2026-10-11 — Portal generalized for Prof. Kapil Sahu (Placement Coordinator) + first-login self-setup

### Request
- Portal is built for the **Placement Coordinator** (Prof. Kapil Sahu) — remove everything hardcoded to the old HOD identity ("Prof. (Dr.) Prashant Lakkadwala", "Role: HOD", "HOD-IT-001", hardcoded institution).
- Generalize labels (no "HOD" wording) — editable fields stay editable; users type their own values.
- A brand-new login should show "New User" style defaults and get a setup prompt to enter name/role right after signing in.

### Changes
1. **`frontend/src/app/api/auth/profile/route.ts`** — profile API now returns neutral defaults:
   - `roleTitle`: "Placement Coordinator", `employeeId`: "EMP-001", `departmentScope`: "Placement Cell"
   - `institution`/`department`/`activeBatches`/`academicSession` default to blank (persisted per workspace in `settings`, editable in UI or PATCH).
   - Name comes from the `admins` row; seeded "Department Admin" shows as blank until the user sets their own name.
   - PATCH now also accepts `status`, `institution`, `department`, `academicSession` updates.
2. **`frontend/src/app/profile/page.tsx`** — UI generalized:
   - "Faculty Management" → "Team Management", "Transfer HOD Ownership" → "Transfer Ownership", "Grant HOD Rights" → "Grant Admin Rights", "HOD/Admin" option → "Administrator".
   - Blocks rendering only when data exists (no fake institutional footer, no fake "Role: HOD" chip, initials fall back to "U").
   - **First-login setup:** when the profile name is blank, the Edit Modal auto-opens with a Welcome prompt; the user enters name+role themselves.
   - Header placeholder name for blank profile: "New User".
3. **`frontend/tests/api.test.ts`** — profile test updated to assert the new neutral defaults (`EMP-001`, `Placement Cell`) instead of the removed hardcoded HOD values.

### Auto-created credentials for invited members (existing behavior, kept)
- POST `/api/organizations/members` already auto-creates the login: stores the admin with name derived from the email and the workspace's default temporary password (`Acropolis@2026` in the pilot workspace) — the new user can sign in immediately with that email, then change name/role/password themselves.

### Verification
- Typecheck: 0 errors.
- `tests/api.test.ts`: **15/15 passed** (after updating defaults assertions).
- Full frontend suite: same 4 pre-existing failures only (tenants/pilot/rules backend tests — unrelated, confirmed pre-existing earlier today).
- Pushed: `17ce274..aad13bb main -> main`.

### Notes / Follow-ups
- Existing DBs with old seeded values ("HOD-IT-001", "Role: HOD") will show those values until the user edits them (values live per-workspace in `settings`, PATCH updates them).
- Existing logged-in sessions will keep seeing the old name until `admins.name` is updated via the profile editor.

---

## 2026-10-11 — Shared-account changes not visible to the other user in real time

### Symptoms
- Two people share the same login (`admin@institution.edu`). When one changes the profile name (or any settings/batches/rules data), the other user's open pagekept showing stale values until they manually refreshed or navigated.

### Root Cause
- Backend is a live Express API — no server-side caching, data was always persisted correctly.
- But the frontend `useAsync` hook fetched data **only on mount** (and after explicit mutations). A page left open never re-fetched, so the second viewer saw stale data indefinitely.

### Fix Applied
- Upgraded `frontend/src/hooks/useAsync.ts`:
  - **Background polling every 25s** (`refreshMs`, configurable, `0` disables) for every screen using the hook — dashboard, mails, batches, settings, profile.
  - **Refresh when the tab regains focus** (`visibilitychange` + `focus`), so returning to the app syncs immediately.
  - **Silent background refreshes** keep the last good data and never flip `loading`, so the UI doesn't flicker; failed polls don't wipe the screen.
- Every `useAsync` consumer gets this automatically — no per-page changes needed.

### Verification
- `frontend` typecheck: 0 errors.
- Frontend test suite: 88 passed / 15 skipped; 4 failures across 3 files (tenants/pilot/rules) confirmed **pre-existing** via `git stash` baseline — identical failures before this change, unrelated to it (backend pipeline tests).

### Notes
- Data now propagates within ≤25s (or instantly on tab focus) — appropriate for a shared-pilot app. For true push-style realtime, a WebSocket/SSE channel (Supabase Realtime is already a dependency) can be added later.
- Render free tier still sleeps the backend after 15 min idle; first poll after sleep shows the stale sync delay (~1 min cold start), then data catches up.

---

## 2026-10-11 — Render server wake-up + live links

- Woke the Render backend via `GET /api/health` (~14s cold start). Verified production: health 200 (db ok, gmailConfigured, supabaseConfigured), password login 200, Google OAuth entry 302, Vercel frontend 200.
- **Links:** App → https://email-automation-it.vercel.app/login · API → https://email-automation-api-c7fp.onrender.com · Health → https://email-automation-api-c7fp.onrender.com/api/health
- Reminder: free tier sleeps after 15 min inactivity; first request back can fail — retry once.

---

## 2026-10-11 — Login "Sign in failed: service temporarily unavailable" + Google sign-in broken

### Symptoms
- Login page (`/login`) showed: **"Sign in failed — The service is temporarily unavailable. The backend may be starting up, please try again in a moment."**
- **"Sign in with Google"** button redirected to the wrong application instead of Google's consent screen.

### Root Cause (diagnosed, not guessed)
Both failures came from a **port conflict with an unrelated app running on this machine**:

| Port | Expected occupant | Actual occupant |
|------|-------------------|-----------------|
| 3000 | mail-automation frontend (Next.js) | `stitch_faculty_student_count_app` (Student Achievement & Certification Portal, PID 63756) |
| 3001 | mail-automation backend (Express API) | nothing — backend was never started; another app's Next.js answered earlier requests |

1. The Express backend (`backend/src/server.ts`, default port 3001) was **not running**, so every frontend `/api/*` call hit a dead port → `http.ts` mapped the failure to the "temporarily unavailable" message.
2. The frontend logs in via `BACKEND_API_URL=http://localhost:3001` (from `frontend/.env.local`, proxied through `frontend/next.config.ts` rewrites), so password login **and** `GET /api/auth/google` both depended on that dead port.
3. No code defect was involved — `backend/src/routes/auth.ts#GET /google` and `backend/src/routes/gmail.ts#GET /callback` (with `__login__` state flow) are correct.

### Fix Applied
1. Started the mail-automation backend on port 3001: `cd backend && npx tsx src/server.ts`.
2. With port 3000 occupied by the other app, ran the frontend on port **3002**: `cd frontend && npx next dev -p 3002`.

### Verification (measured, per flow, through the frontend)
| Check | Command/Flow | Result |
|---|---|---|
| Login page renders | `GET :3002/login` | 200 |
| Password login via frontend proxy | `POST :3002/api/auth/login` (admin@institution.edu) | 200, user returned |
| Session persists | `GET :3002/api/auth/session` with cookie | 200, `org_default` workspace |
| Google OAuth entry | `GET :3002/api/auth/google` | 302 → `accounts.google.com/o/oauth2/v2/auth` (label `__login__`, refresh token requested) |
| Backend health | `GET :3001/api/health` | 200 |

### Action Items / Notes for Next Time
- [ ] **Unify ports**: port 3000 is still owned by the other app. Best setup is to stop the other app (PID 63756) and run the frontend on 3000 so `CORS_ORIGIN`/`FRONTEND_URL` (`backend/.env.local`) and cookies match out of the box.
- [ ] **Google Cloud Console redirect URI**: `backend/.env.local` sets `GMAIL_REDIRECT_URI=http://localhost:3001/api/gmail/callback`. It must be listed under *Credentials → Authorized redirect URIs*, otherwise users will see `redirect_uri_mismatch` after consent.
- [ ] Remember the fallback login: `admin@institution.edu` / `ChangeThisPassword123!` (auto-seeds the admin on first use).
