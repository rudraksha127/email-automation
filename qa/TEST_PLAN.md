# TEST PLAN — Mail Automation Portal (local: :3002 frontend, :3001 Express API)

Credentials (local pilot): admin@institution.edu / ChangeThisPassword123!

## Slice A — Auth (CRITICAL)
- A1 Login happy path → dashboard
- A2 Wrong password → error shown, no session
- A3 Protected route while logged out → redirect to /login
- A4 Logout → session destroyed; protected routes inaccessible
- A5 Session persistence across reload after login

## Slice B — Dashboard (CRITICAL)
- B1 Dashboard loads stats without errors (pending/forwarded counts)
- B2 Recent mails list renders
- B3 Loading/error states behave

## Slice C — Batches CRUD (CRITICAL)
- C1 Create batch (QA_TEST_ prefix) → appears in list
- C2 Edit batch name/description → persists after refresh
- C3 Add recipient → appears; refresh → persists
- C4 Bulk upload: download template, upload filled CSV, import → batches created; re-upload → no duplicates
- C5 Delete batch (empty) → gone after refresh
- C6 Delete QA_TEST data created during the sweep

## Slice D — Mails (CRITICAL)
- D1 Mails list loads
- D2 Search/filter
- D3 Mail detail page opens

## Slice E — Settings
- E1 Settings page loads, CC/allowlist read
- E2 Gmail connection status shows Not Connected/Connected (no fake calls to Google)

## Slice F — Profile (CRITICAL)
- F1 Profile loads with user name/email
- F2 Edit profile (QA name change) → persists after refresh → revert
- F3 Change password modal validation (mismatch, short)
- F4 Team management: invite QA member → lists → remove

## Slice G — Forms & validation (cross-cutting)
- G1 Empty submits blocked with messages
- G2 Emoji/long input handling
- G3 Double-submit protection (button loading)

## Slice H — Navigation & a11y
- H1 Deep link while logged in works; 404 page for bad route
- H2 Responsive spot check 375px viewport
- H3 No console errors / failed 4xx-5xx network calls on key pages
