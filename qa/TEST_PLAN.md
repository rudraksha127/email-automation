# TEST PLAN — Mail Automation Platform

Local Target: http://localhost:3000 (Next.js frontend) + http://localhost:3001 (Express API)
Credentials: admin@institution.edu / ChangeThisPassword123!
Test Data Prefix: QA_TEST_

## Slice A — Authentication & Sessions (CRITICAL - SMOKE)
- [x] A1: Login happy path → redirects to /dashboard with active session
- [x] A2: Wrong password / invalid email → descriptive error, no session established
- [x] A3: Protected route access while logged out → redirects to /login
- [x] A4: Logout → session destroyed, cookies cleared, protected routes inaccessible
- [x] A5: Session persistence across page reloads and browser tab transitions

## Slice B — Dashboard & System Overview (CRITICAL - SMOKE)
- [x] B1: Dashboard KPI cards render real computed statistics (Pending, Forwarded, Needs Review, Batches)
- [x] B2: Recent emails table renders with timestamps, subject, sender, and status tags
- [x] B3: Action buttons (Quick Forward, View Details) function without console errors

## Slice C — Batches & Recipients Management (CRITICAL - SMOKE)
- [x] C1: Create cohort batch (prefixed QA_TEST_) → verifies in list
- [x] C2: Edit batch metadata (name/description) → verifies persistence after refresh
- [x] C3: Add single recipient to batch → verifies persistence after refresh
- [x] C4: Bulk upload CSV (download template → upload filled data → import → verify deduplication & idempotency)
- [x] C5: Delete recipient and delete batch → verifies complete cleanup (QA_TEST_ data removed)

## Slice D — Mail Ingestion & Detail Inspection (CRITICAL - SMOKE)
- [x] D1: Mails list loads with status tabs (All, Pending, Needs Review, Forwarded, Failed)
- [x] D2: Search by sender, subject, and keyword filter
- [x] D3: Mail detail modal/page opens with sender info, subject, body preview, attachment badges
- [x] D4: Multi-batch selection & forwarding confirmation

## Slice E — History & Audit Timeline (NEW FEATURE - SMOKE)
- [x] E1: History page loads with historical forwarded, rejected, and completed emails
- [x] E2: Mini-calendar component allows single date and range selection
- [x] E3: Real-time search and status filtering on history records

## Slice F — Settings & Screening Rules (CRITICAL)
- [x] F1: Settings page loads sender allowlist, blocklist, and routing keywords
- [x] F2: Mandatory CC email field validation and persistence
- [x] F3: Gmail connection indicator (shows real OAuth connection status)

## Slice G — Profile, Team Management & Security (CRITICAL)
- [x] G1: Profile loads authenticated user details and organization information
- [x] G2: Change Password modal: validation (mismatch, min length) + Show/Hide eye toggle controls
- [x] G3: Team management: invite member with role → verify in member list → remove member

## Slice H — Forms, Edge Cases & Resilience
- [x] H1: Empty form submissions blocked with validation error feedback
- [x] H2: Long input, special characters, and emoji resilience
- [x] H3: Double-submit protection on action buttons (submitting state disables button)

## Slice I — Navigation, Responsive & Accessibility
- [x] I1: Deep linking while logged in works; non-existent route shows custom 404
- [x] I2: Mobile responsive check (375px viewport with slide-over drawer navigation)
- [x] I3: Zero console errors, zero 4xx/5xx network failures during normal interaction
