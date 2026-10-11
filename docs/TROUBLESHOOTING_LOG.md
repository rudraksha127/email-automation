# 🔧 Troubleshooting & Issue Log

Running record of issues encountered, root causes diagnosed, and fixes applied.
Latest entries first. Append new entries below the heading — keep the format consistent.

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
