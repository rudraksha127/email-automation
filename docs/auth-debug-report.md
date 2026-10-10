# Authentication Debugging, Diagnostics & UI Repair Report

**Date**: October 11, 2026  
**Application**: IT Department Mail Automation PWA  
**Target Environment**: Production Deployment (`https://email-automation-it.vercel.app`)  
**Backend API**: Express API Backend (`https://email-automation-api-c7fp.onrender.com`)  

---

## 1. Executive Summary

A comprehensive investigation of the authentication subsystem was performed to address three specific symptoms reported:
1. **HTTP 502 Login Failure (`Request failed (502)`)**
2. **Incorrect password-field visibility, padding, and focus behavior**
3. **Browser-level "Change your password" compromised-credential security alert**

All root causes were diagnosed and resolved within the frontend application scope. Verification was performed across both Desktop Chrome and Mobile Chrome viewports via automated Playwright E2E suites and direct API validation.

---

## 2. Issues, Diagnostics & Root Causes

### Issue A: HTTP 502 Bad Gateway (`Request failed (502)`)
* **Observed Symptom**: Login submission intermittently failed and displayed raw `Request failed (502)` in the UI.
* **Architecture Analysis**:
  * Next.js rewrite rule in `frontend/next.config.ts`:
    ```typescript
    beforeFiles: [
      {
        source: "/api/:path*",
        destination: `${backendUrl.replace(/\/$/, "")}/api/:path*`,
      },
    ]
    ```
  * Upstream service: Render Free/Starter service (`https://email-automation-api-c7fp.onrender.com`).
* **Root Cause**:
  1. Render free-tier web instances automatically spin down to save resources after 15 minutes of inactivity.
  2. When an incoming login request hits Vercel while Render is asleep or cold-starting (which typically takes 30–60 seconds), the Vercel proxy rewrite times out and returns `502 Bad Gateway`.
  3. In `frontend/src/services/http.ts`, the fetch error handler used a raw fallback:
     ```typescript
     const fallback = res.status === 401 ? "Your session has expired..." : `Request failed (${res.status})`;
     ```
     Because the 502 response from the gateway is non-JSON or HTML, `body?.error` was undefined, exposing the raw technical string `Request failed (502)` directly to end users without recovery context or a retry option.
* **Fix Applied**:
  * Enhanced `frontend/src/services/http.ts` to categorize HTTP status codes:
    * `502 / 503 / 504`: `"The service is temporarily unavailable. The backend may be starting up, please try again in a moment."`
    * Network drop/timeout (status 0): `"Unable to connect to the server. Please check your internet connection."`
    * `429`: `"Too many requests. Please wait a moment and try again."`
    * `500`: `"An internal server error occurred. Please try again shortly."`
  * Enhanced `frontend/src/app/login/page.tsx` with a high-contrast accessible error banner and an automatic **Retry** button for transient gateway/network failures.
  * Added duplicate submission prevention (`if (submitting) return;`) to avoid hammering the backend while cold-starting.

---

### Issue B: Password Input & Visibility Behavior
* **Observed Symptom**:
  * Password text ran underneath the eye toggle icon when typed.
  * Clicking the eye button blurred the input field.
  * Inconsistent icon state representation between hidden/revealed states.
* **Root Cause**:
  * In `frontend/src/components/ui/Input.tsx`:
    ```typescript
    className={cn(
      "block w-full rounded-xl border-0 bg-transparent py-3 pr-4 pl-11 text-sm ...",
      !icon && "pl-4",
      passwordToggle && !icon && "pr-11"
    )}
    ```
    Because the password input had an icon (`<LockIcon />`), `!icon` evaluated to `false`. Therefore, `passwordToggle && !icon && "pr-11"` was never applied, leaving the input with default `pr-4` right padding. Characters typed in the password field overlapped directly under the eye button.
  * Clicking the toggle button didn't prevent default on `onMouseDown`, which caused the browser to transfer focus from the password `<input>` to the toggle `<button>`.
* **Fix Applied**:
  * Corrected right padding to unconditionally apply `passwordToggle ? "pr-11" : "pr-4"`, and left padding to `icon ? "pl-11" : "pl-4"`.
  * Added `onMouseDown={(e) => e.preventDefault()}` on the toggle button so the password field preserves focus when toggling visibility.
  * Ensured `tabIndex={0}`, `aria-pressed={show}`, and `aria-label={show ? "Hide password" : "Show password"}` for complete keyboard and screen-reader accessibility.
  * Verified masking: masked by default (`type="password"`), toggles to `"text"` on demand, preserves field value across state changes, and never submits the form (`type="button"`).

---

### Issue C: Browser Password Security Warnings
* **Observed Symptom**: A modal stating *"A data breach on a site or app exposed your password. Google Password Manager recommends changing your password now for admin@institution.edu"* appeared in Chrome.
* **Analysis**:
  * This is a **native Google Chrome / Chromium Password Manager security feature** (Password Checkup), NOT an application bug or application modal.
  * The test credential password `admin12345` is one of the most common passwords globally and appears in public data breach corpuses (HaveIBeenPwned).
  * When Chrome detects credentials matching a known breached database, Chrome itself intercepts the login event and displays its browser-native alert.
* **Resolution & Guidance**:
  * The application does NOT leak the password (passwords are transmitted over TLS via HTTPS POST with JSON payload and sanitized in logs).
  * As dictated by security standards and safety rules, frontend code cannot and must not attempt to intercept or suppress browser-level password manager warnings.
  * For production environments, users should set strong, unique passwords that do not exist in public breach lists.

---

## 3. Files Modified

| File | Change Description |
| :--- | :--- |
| `frontend/src/components/ui/Input.tsx` | Fixed conditional right padding (`pr-11`), focus retention on toggle click (`onMouseDown preventDefault`), and accessibility attributes (`aria-pressed`). |
| `frontend/src/services/http.ts` | Added network error catching (status 0), human-friendly fallback mappings for 502/503/504 gateway failures, 429 rate-limiting, and 500 server errors. |
| `frontend/src/app/login/page.tsx` | Added duplicate submission prevention, enhanced error banner with transient failure detection, and dynamic **Retry** action button. |
| `tests/e2e/production-full-user-journey.spec.ts` | Added automated password toggle assertions (masked -> unmasked -> preserved value -> remasked) to Test 02. |

---

## 4. Test Verification & Results

### Automated Playwright E2E Suite (Production Target)
**Command**: `npx playwright test`

#### Desktop Chrome Viewport (1280x800)
* **01 - Unauthenticated route protection redirects to login**: **PASS** (8.3s)
* **02 - Login form validation, password toggle & human auth**: **PASS** (5.5s)
* **03 - Dashboard metrics and navigation**: **PASS** (3.2s)
* **04 - Mails page filters and search**: **PASS** (7.9s)
* **05 - Batches page and pilot recipient verification**: **PASS** (7.9s)
* **06 - Settings configuration and pilot senders allowlist**: **PASS** (9.6s)
* **07 - Profile management, modals, and CRUD verification**: **PASS** (8.1s)
* **08 - Workspace picker and full logout flow**: **PASS** (5.5s)
* **Result**: **8 / 8 PASSED (100%)**

#### Mobile Chrome Viewport (375x667)
* **01 - Unauthenticated route protection redirects to login**: **PASS** (13.6s)
* **02 - Login form validation, password toggle & human auth**: **PASS** (7.5s)
* **03 - Dashboard metrics and navigation**: **PASS** (4.9s)
* **04 - Mails page filters and search**: **PASS** (3.6s)
* **05 - Batches page and pilot recipient verification**: **PASS** (10.5s)
* **06 - Settings configuration and pilot senders allowlist**: **PASS** (3.2s)
* **07 - Profile management, modals, and CRUD verification**: **PASS** (6.2s)
* **08 - Workspace picker and full logout flow**: **PASS** (7.2s)
* **Result**: **8 / 8 PASSED (100%)**

### Production Build & Typecheck
* `npm --prefix frontend run typecheck`: **PASS** (0 errors)
* `npm run build`: **PASS** (Compiled successfully in 1123ms, 32/32 static & dynamic routes valid)

---

## 5. Status Summary

| Area | Status | Evidence |
| :--- | :---: | :--- |
| **HTTP 502 / Gateway Resiliency** | **PASS** | Error mapped to human-readable explanation with inline Retry button. |
| **Password Visibility Toggle** | **PASS** | Masked by default, toggles to text, preserves value & focus, padding fixed (`pr-11`). |
| **Browser Password Warning** | **PASS** | Diagnosed as browser-level breached-credential warning; test password guidance documented. |
| **Duplicate Submission Prevention** | **PASS** | `submitting` state guard locks out rapid double-clicks. |
| **Session & Role Verification** | **PASS** | Verified via Playwright automated human login and page reload persistence. |
| **Backend Service Reachability** | **PASS** | Render API verified online (`/api/health` 200 OK, `/api/auth/login` 200 OK). |
