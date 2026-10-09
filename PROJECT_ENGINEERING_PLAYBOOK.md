# Project Engineering Playbook

> A universal, technology-aware engineering instruction manual for AI coding
> agents and human engineers. Give this file to a repository-aware coding
> agent (Cline, Cursor, Codex, etc.) instead of writing one-off prompts for
> responsiveness, styling, testing, performance, security, SEO or DevOps.
>
> Version: 1.0 · Standalone: yes (no external context required)

---

## Table of Contents

1. [How to Use This Playbook](#1-how-to-use-this-playbook)
2. [Universal Agent Execution Protocol](#2-universal-agent-execution-protocol)
3. [Requirements and Project Discovery](#3-requirements-and-project-discovery)
4. [Architecture and Code Quality](#4-architecture-and-code-quality)
5. [UI/UX, Design System and Styling](#5-uiux-design-system-and-styling)
6. [Responsive Engineering](#6-responsive-engineering)
7. [Functional Completeness and Integration](#7-functional-completeness-and-integration)
8. [Performance Engineering](#8-performance-engineering)
9. [SEO and Web Discoverability](#9-seo-and-web-discoverability)
10. [Accessibility and Usability](#10-accessibility-and-usability)
11. [Security, Privacy and Data Protection](#11-security-privacy-and-data-protection)
12. [Testing and Quality Assurance](#12-testing-and-quality-assurance)
13. [Database and Data Integrity](#13-database-and-data-integrity)
14. [PWA and Mobile Applications](#14-pwa-and-mobile-applications)
15. [API and Backend Engineering](#15-api-and-backend-engineering)
16. [AI, ML and Automation Systems](#16-ai-ml-and-automation-systems)
17. [DevOps, CI/CD and Deployment](#17-devops-cicd-and-deployment)
18. [Git, GitHub and Change Management](#18-git-github-and-change-management)
19. [Documentation and Developer Experience](#19-documentation-and-developer-experience)
20. [Observability, Reliability and Maintenance](#20-observability-reliability-and-maintenance)
21. [Conditional Execution Matrix](#21-conditional-execution-matrix)
22. [Prioritization and Execution Control](#22-prioritization-and-execution-control)
23. [Completion Gate](#23-completion-gate)
24. [Execution Templates](#24-execution-templates)
25. [Reporting Templates](#25-reporting-templates)

---

## 1. How to Use This Playbook

This playbook teaches an agent **how to think about, plan, implement,
verify, optimize and deliver any software project**. It is not specific to
React, PWAs, SaaS or web applications. Sections apply **conditionally**:

1. **Classify the project first** (Section 21). Do not apply every section
   to every project.
2. **Skip irrelevant sections** and mark them `NOT APPLICABLE` with a short
   reason when the exclusion is meaningful.
3. **Follow the execution protocol** (Section 2) on every task.
4. **Respect the completion gate** (Section 23) before reporting done.

### Status vocabulary (use everywhere)

| Status | Meaning |
|---|---|
| `PASSED` | Actually executed and verified |
| `FAILED` | Executed and did not meet expectations |
| `BLOCKED` | Cannot proceed; external prerequisite missing |
| `NOT RUN` | Not executed (state why) |
| `NOT APPLICABLE` | Irrelevant to this project type |

**Never fabricate metrics, test results, security findings or deployment
confirmations. Never claim a test passed unless it actually ran and passed.**

---

## 2. Universal Agent Execution Protocol

Every task follows six stages. Never stop after Stage C when instructed to
implement.

### Stage A — Understand

- [ ] Identify the actual project type and objectives.
- [ ] Inspect repository structure (top 2–3 levels; do not read every file).
- [ ] Identify the technology stack: language, framework and version,
      package manager, runtime, build system.
- [ ] Read `README`, package manifests, lockfiles, config files
      (`next.config.*`, `tsconfig.*`, `Dockerfile`, CI workflows).
- [ ] Inspect `.env.example` (never `.env` secrets) and deployment config.
- [ ] Run `git status` and `git log --oneline -5`; preserve uncommitted work.
- [ ] Identify existing tests and how to run them.
- [ ] Identify external dependencies, services and missing credentials.
- [ ] Separate **explicit requirements** from **assumptions**.

### Stage B — Audit

- [ ] Architecture and maintainability.
- [ ] Functional completeness (every screen, endpoint, action).
- [ ] UI/UX, design-system fidelity and accessibility (visual projects).
- [ ] Responsiveness (web projects).
- [ ] Performance (frontend/backend/database as applicable).
- [ ] Security and privacy (Section 11).
- [ ] Data integrity and migrations.
- [ ] Testing coverage of critical paths.
- [ ] Deployment readiness.
- [ ] Broken functionality, duplication and technical debt.

### Stage C — Plan

- [ ] Build a requirements → implementation map.
- [ ] Prioritize: data-loss/security risks first (Section 22).
- [ ] Define acceptance criteria per change.
- [ ] Identify task dependencies.
- [ ] Propose the **smallest safe implementation plan**; avoid rewriting
      working components.
- [ ] Define the verification strategy **before** changing code.

### Stage D — Implement

- [ ] Work incrementally; keep each change reviewable.
- [ ] Reuse existing architecture, patterns and components.
- [ ] Implement **real** functionality — no placeholder buttons, no fake
      data in production-facing interfaces, no fabricated success responses.
- [ ] Preserve approved designs and working behavior.
- [ ] Avoid new dependencies unless they provide meaningful, justified value.
- [ ] Update documentation when behavior or setup changes.

### Stage E — Verify

- [ ] Run tests, build, lint, type checks (whatever the project has).
- [ ] Verify affected workflows end-to-end (interface → API → data store).
- [ ] Test error paths, not just happy paths.
- [ ] Review security implications of the change.
- [ ] Check responsive behavior for UI changes.
- [ ] Compare the result with requirements and supplied references.

### Stage F — Deliver

- [ ] Review the final diff; look for regressions and leftovers.
- [ ] Report actual check results using the status vocabulary.
- [ ] Document deployment requirements if changed.
- [ ] Preserve secrets; scan the diff for them.
- [ ] Commit/push **only when requested or explicitly authorized**.
- [ ] Provide a concise, evidence-based completion report (Section 25).

---

## 3. Requirements and Project Discovery

### Extraction methodology

1. **Explicit requirements** — quote them; do not reinterpret silently.
2. **Implicit requirements** — infer from the existing product (every
   visible control must have a real action; terminology must stay
   consistent).
3. **Constraints** — stack, hosting, credentials, deadlines, team norms.
4. **Non-functional** — performance, security, accessibility, scale.

### Distinguish and label

| Category | Action |
|---|---|
| Confirmed facts | From repo/docs; cite the file |
| Assumptions | State explicitly; keep reversible |
| Missing information | Ask **focused** questions |
| Blockers | Continue independent work; report precisely |

**Inspect the repository before asking the user for information it already
contains.** Never invent critical configuration (credentials, URLs, ports,
feature flags) — ask or use clearly-marked placeholders.

### Acceptance criteria

Write them per task: exact file paths, interfaces, schemas, formats,
performance constraints, and the checks that will prove them.

---

## 4. Architecture and Code Quality

### Stack discovery before decisions

Language/version · framework · ORM/query layer · database · auth model ·
deployment target · existing patterns (folder structure, naming, error
handling, DI, config loading).

### Principles

- **Proportionality**: architecture must match verified complexity. Do not
  introduce microservices, containers, Kubernetes, queues, event buses or
  GraphQL "because best practices". A simple optimized monolith usually wins.
- **Separation of concerns**: UI / business logic / data access / external
  integrations in distinct layers with clear boundaries.
- **Contracts first**: define API contracts, data schemas and shared types
  before implementing against them.
- **Smallest safe change**: before editing a file, find its importers
  (`rg "import.*from.*thisModule"`), understand callers, change narrowly.
- **Backward compatibility**: preserve response shapes, CLI flags and file
  formats unless a breaking change is explicitly requested.
- **Refactor incrementally** with tests green between steps; never combine a
  rewrite with a behavior change in one commit.
- **Technical debt**: fix what the task touches; log the rest — do not
  opportunistically rewrite unrelated code.

### Quality checklist

- [ ] Meaningful names (no `data2`, `handleStuff`).
- [ ] Errors carry context; no swallowed exceptions (`catch {}` banned
      unless justified with a comment).
- [ ] Configuration via env/config files, never hardcoded constants for
      environment-specific values.
- [ ] Dependencies minimal, pinned via lockfile, actively maintained.

---

## 5. UI/UX, Design System and Styling

### Reference inspection (mandatory when references exist)

If screenshots, Figma files, Google Stitch exports, HTML mocks or reference
layouts are provided:

1. **Locate them in the repository/filesystem first** — do not guess paths.
2. **Treat them as authoritative** for visuals (colors, typography,
   spacing, radii, shadows, icons, layout hierarchy).
3. **Map each reference to an actual screen** before implementing.
4. **Verify the rendered result against the references** (screenshot and
   compare).
5. Never replace an approved design with a generic template or your own
   interpretation. Where a breakpoint has no reference, adapt the approved
   design system — do not invent a new one.

If no reference exists, extract a coherent design system from the existing
UI (tokens: color, type scale, spacing, radii, shadows) and keep it
consistent.

### Design-system checklist

- [ ] Color tokens (not raw hex sprinkled per component).
- [ ] Typography: family, weights, sizes, line heights.
- [ ] Spacing scale; consistent padding/margins.
- [ ] Buttons: primary/secondary/danger/ghost; loading and disabled states.
- [ ] Inputs: labels (always visible), placeholders, error text, hints.
- [ ] Status badges consistent everywhere.
- [ ] Icons: one family, consistent sizing.
- [ ] Tables/data views: readable at target widths, truncation strategy.
- [ ] Navigation: consistent structure across breakpoints.
- [ ] **States for every data view**: loading, empty, error (with retry),
      success feedback.
- [ ] Modals/dialogs: consistent, dismissible, confirm destructive actions.
- [ ] Every interactive control has a **real** action. A visually complete
      but non-functional mockup is not a completed product.

---

## 6. Responsive Engineering

_Apply to visual web interfaces._

- [ ] Choose mobile-first or content-first strategy based on the primary
      audience; document the choice.
- [ ] Fluid sizing; prefer relative units and flexible grids.
- [ ] CSS Grid/Flexbox over absolute positioning for layout.
- [ ] Responsive typography (clamp or breakpoint steps).
- [ ] Breakpoints derived from **content**, not specific devices.
- [ ] Responsive images (sizes/srcset or framework image component).
- [ ] Touch targets ≥ 44×44 px on touch layouts.
- [ ] Navigation adapts (e.g., sidebar → bottom nav or drawer).
- [ ] Tables: horizontal scroll containers, card fallback, or column
      hiding — never clipped controls.
- [ ] Forms/modals: full-width on small screens, never cut off.
- [ ] Safe-area insets for fixed bottom/top bars (notches).
- [ ] Works in portrait and landscape.
- [ ] Text zoom (200%) does not break layout.
- [ ] **Zero horizontal overflow** at every supported width.

### Viewport verification (baseline — adapt to the project)

320–390 px mobile · 768 px tablet · 1024 px laptop · 1280–1440 px desktop.

Test **visually AND functionally** at each width. Automate where possible
(e.g., CDP/Playwright script measuring `scrollWidth > innerWidth` and
capturing screenshots). Fix overflow, broken navigation, clipped tables,
misaligned cards, unusable modals and overlapping fixed controls.

---

## 7. Functional Completeness and Integration

### Trace critical journeys end-to-end

For every user journey: UI action → network request → server handler →
validation/auth → database/external service → response → UI update →
**persisted state re-read** (reload and confirm).

- [ ] Every API the frontend calls exists, is authorized and returns the
      expected shape.
- [ ] Forms validate on both client **and** server; validation errors map
      to fields.
- [ ] Search actually searches; filters filter; pagination paginates.
- [ ] Create/edit/delete persist and reflect everywhere (same source of
      truth — no duplicated business logic per surface).
- [ ] Destructive actions have confirmation appropriate to impact.
- [ ] Uploads/downloads round-trip correctly, including edge cases
      (empty file, duplicates, oversized).
- [ ] Third-party integrations: handle timeout, rate-limit and auth expiry.
- [ ] Retry behavior: safe operations retry; unsafe ones do not retry
      blindly (idempotency).
- [ ] Loading states block double-submit; user input is preserved on
      recoverable errors.
- [ ] Background jobs are visible (status/queue) and failures surface.

**Rules:** never silently replace a failed request with a fabricated
success. Never leave placeholder buttons or fake metrics in
production-facing UI. Mocks belong in test/demo environments only.

---

## 8. Performance Engineering

### Measure before optimizing

Establish a baseline (actual measurements; if unavailable, say so — never
invent numbers). Optimize the top bottleneck, re-measure, keep or revert.
Repeat. Do not trade correctness or security for speculative gains.

### Frontend

- [ ] Bundle size per route; identify heavy dependencies (`npm ls`,
      bundle analyzer).
- [ ] Code-split genuinely heavy components (`dynamic import`); do not
      split tiny ones.
- [ ] Lazy-load below-the-fold content and images.
- [ ] Optimize images (format, sizing, `srcset`).
- [ ] Avoid unnecessary re-renders; memoize only with evidence.
- [ ] Cumulative Layout Shift ≈ 0 (reserved space; `font-display: swap`
      with preloaded/self-hosted fonts).
- [ ] Debounce/throttle API-triggering inputs.
- [ ] Cache static, content-hashed assets aggressively; never cache
      authenticated/personalized responses in shared caches.

### Backend

- [ ] p50/p95/p99 latency per critical endpoint (measure, e.g., with a
      small script or `wrk`/`k6`/Artillery).
- [ ] No N+1 queries; batch or join.
- [ ] Pagination on every potentially large dataset.
- [ ] Async I/O; no blocking the event loop with CPU-heavy work — move to
      background jobs **only when the architecture already supports it**
      or the load justifies it.
- [ ] Timeouts on external calls; bounded retries with backoff.
- [ ] Connection pooling; graceful shutdown.

### Infrastructure

- [ ] Cold-start and build time tracked.
- [ ] Logs and metrics exist for the bottleneck you are tuning.
- [ ] Capacity constraints documented.

**Report before/after with actual numbers only.**

---

## 9. SEO and Web Discoverability

_Apply only where public discoverability matters._

- [ ] Unique `<title>` and meta description per public page.
- [ ] Canonical URLs; heading hierarchy (single `h1`, logical outline).
- [ ] Semantic HTML.
- [ ] `robots.txt` and XML sitemap for public content.
- [ ] Structured data (JSON-LD) where it fits the content type.
- [ ] Open Graph/Twitter metadata for social previews.
- [ ] Meaningful image `alt` text.
- [ ] Clean URL structure; correct redirects (301 for permanent).
- [ ] No duplicate-content traps (trailing slashes, query params).
- [ ] Core Web Vitals healthy (see Section 8).
- [ ] Content indexable without JS where feasible for public pages.

### Private/authenticated applications

- Prevent indexing of private routes (`noindex` on app shells is fine);
  never list private routes in sitemaps. Do **not** bolt public-SEO
  requirements onto internal tools. **Never promise rankings.**

---

## 10. Accessibility and Usability

- [ ] Semantic elements (`button` not clickable `div`; landmarks).
- [ ] Full keyboard operation of every interactive control.
- [ ] Visible focus indicators (do not remove outlines without replacement).
- [ ] Accessible names: labels, `aria-label` for icon-only buttons.
- [ ] Form labels bound to inputs; descriptions via `aria-describedby`.
- [ ] Errors identified in text (not color alone) and announced
      (`role="alert"`).
- [ ] Color contrast ≥ 4.5:1 for text (WCAG AA baseline).
- [ ] Modals: focus moves in, is trapped, and returns on close; Esc closes.
- [ ] `prefers-reduced-motion` respected for non-essential animation.
- [ ] Text resizing to 200% without loss of function.
- [ ] Touch targets ≥ 44 px on touch layouts.

Automated tools (axe, Lighthouse) are a floor, not a ceiling — perform at
least one manual keyboard-only pass on changed flows.

---

## 11. Security, Privacy and Data Protection

### Application checklist

- [ ] **Threat model** the change: what can a malicious user send?
- [ ] Authentication: secure password hashing (bcrypt/argon2/scrypt — never
      invent or log credentials), session/token expiry, rotation on
      privilege change.
- [ ] Authorization enforced **server-side on every endpoint**. Hidden UI
      is not a security boundary. Deny by default.
- [ ] Least privilege for service accounts, API keys and DB users.
- [ ] Input validation (allowlist) on every server entry point; output
      encoding to prevent XSS; parameterized queries to prevent injection.
- [ ] CSRF protection for cookie-authenticated state-changing endpoints.
- [ ] CORS: explicit allowlist; never `*` with credentials.
- [ ] Rate limiting on auth and expensive endpoints.
- [ ] Cookies: `HttpOnly`, `Secure`, appropriate `SameSite`.
- [ ] Secrets only in env vars/server config — never in source, logs,
      client bundles (`NEXT_PUBLIC_*`-style prefixes) or error messages.
      Never commit `.env` files; ship `.env.example` with placeholders.
- [ ] Tokens encrypted at rest where required; never logged.
- [ ] TLS everywhere in transit.
- [ ] Dependency vulnerabilities checked (`npm audit` or equivalent).
- [ ] File uploads: type/size validation, random stored names, served
      outside the executable path, virus-scanned where appropriate.
- [ ] Logging redacts PII/secrets; data retention and deletion policy
      considered.
- [ ] Backups exist and restore has been tested where data matters.

### Multi-tenant

Explicitly test **cross-tenant isolation**: a row/object belonging to org A
must 404/403 for users of org B on every read AND write path (include IDs
injection tests).

### AI applications

Assess prompt injection, untrusted retrieved content, tool/permission
scope, and data leakage between users.

**Never weaken security to make an error go away. Never invent
credentials.** Destructive operations on production data require explicit
authorization; prefer backups over in-place risky changes.

---

## 12. Testing and Quality Assurance

### Strategy (use what the project has; add minimally where risk demands)

| Layer | Covers |
|---|---|
| Unit | Pure functions, business rules, validation, edge cases |
| Integration | API endpoints, DB interactions, auth, external services, error handling |
| E2E | Critical user journeys: forms, navigation, persistence, cross-component flows |
| Extra (as applicable) | Responsive, accessibility, visual regression, performance, load, security, migration, recovery |

### Rules

- Reproducible setup; isolated test data; deterministic assertions.
- Mock only at true boundaries (network, clock, randomness).
- Every bug fix gets a regression test proving the old behavior failed.
- Clean up test artifacts (rows, files, accounts) — verify zero leftovers.
- **No destructive testing against production without authorization.**
- Do not add arbitrary test-count targets; cover risk, not numbers.
- **Do not weaken assertions, skip tests or add suppressions to make a
  check pass.** Fix the cause; if a change to a check is required by the
  requested behavior, explain why and verify the behavior.
- Preserve exit status when piping test output
  (`cmd > log 2>&1; CODE=$?` — never trust the pipe's exit code).

Report every check as `PASSED` / `FAILED` / `BLOCKED` / `NOT RUN`.

---

## 13. Database and Data Integrity

- [ ] Schema: correct types, constraints (`NOT NULL`, `CHECK`, `UNIQUE`),
      foreign keys with intentional `ON DELETE` behavior.
- [ ] Indexes justified by **actual query patterns** (inspect with
      `EXPLAIN`/`EXPLAIN ANALYZE`); avoid blind index-everything.
- [ ] Transactions for multi-write operations; consistent isolation.
- [ ] Migrations: forward **and** rollback safety; run against a copy of
      real data before production; never destroy data to simplify
      development; take backups before risky migrations.
- [ ] Queries paginated; no unbounded `SELECT *` in hot paths.
- [ ] Connection handling sane under load (pooling, timeouts,
      `busy_timeout` for SQLite, etc.).
- [ ] Input validated before persistence; duplicates prevented at the DB
      level where it matters.
- [ ] Concurrency considered (optimistic locking, unique constraints).
- [ ] Backup and restore tested; retention policy defined.

---

## 14. PWA and Mobile Applications

### PWAs

- [ ] Valid manifest: name, icons (192/512 + maskable), theme/background
      colors, `standalone` display.
- [ ] Service worker registered correctly; **one** SW strategy (no
      conflicting libraries).
- [ ] Cache versioning + invalidation; old caches deleted on activate.
- [ ] Offline behavior honest: cache only static assets and public data.
      **Never cache authenticated API responses or private content** in a
      publicly accessible cache.
- [ ] Update lifecycle: new SW activates; user sees fresh content without
      hard reload.
- [ ] SPA navigations handled; offline fallback page (static, JS-free if
      possible) for unreachable backend.
- [ ] Installability verified (manifest + SW + icons + HTTPS).
- [ ] Do not claim background processing continues when the backend is
      unreachable — the backend owns background work.

### Mobile applications

- [ ] Platform conventions (navigation, back behavior, permissions
      prompts in context).
- [ ] Secure local storage for tokens (keystore/keychain, not plaintext).
- [ ] Network-state handling; graceful offline.
- [ ] Lifecycle: resume/pause, deep links, notifications permissions.
- [ ] Device/OS version compatibility matrix.
- [ ] Build config, signing and store distribution requirements met.

---

## 15. API and Backend Engineering

- [ ] Contracts documented (OpenAPI where appropriate); shared types.
- [ ] Request validation at the edge; response shapes stable.
- [ ] AuthN/AuthZ on every endpoint; consistent 401/403 semantics.
- [ ] HTTP status codes used correctly (400 validation, 401 unauthenticated,
      403 unauthorized, 404 not found, 409 conflict, 429 rate limit,
      5xx server fault).
- [ ] Consistent error format (message + machine code; never leak internals
      or stack traces to clients).
- [ ] Pagination (prefer cursor for high-throughput; offset acceptable for
      small admin lists), filtering and sorting server-side.
- [ ] Idempotency for retried writes where it matters (keys on payment/
      messaging endpoints).
- [ ] Timeouts, bounded retries, rate limiting.
- [ ] Structured logs per request (request id, route, duration, outcome).
- [ ] Health/readiness endpoints; graceful shutdown (drain in-flight).
- [ ] Versioning only when a compatibility break is needed.

**The server is the security boundary. Never trust frontend-only
validation.**

---

## 16. AI, ML and Automation Systems

_Apply only where AI/ML is part of the product._

- [ ] Choose models/services against explicit criteria (quality, cost,
      latency, privacy); document the choice.
- [ ] Evaluation before adoption: build a small evaluation dataset; define
      success metrics; run the model against it.
- [ ] Validate all inputs and outputs programmatically; schema-check model
      output before acting on it.
- [ ] Prompts/config versioned; changes re-evaluated.
- [ ] Tool/permission scope minimal; never let model output alone authorize
      sensitive actions.
- [ ] Treat all retrieved/untrusted content as attacker-controlled
      (prompt-injection defenses; delimiters; explicit instructions).
- [ ] Latency and token cost budgeted; caching where safe; fallback
      behavior defined (including "refuse/abstain").
- [ ] Monitoring: quality drift, error rates, cost.
- [ ] Human review for uncertain or high-impact decisions.

**Do not assume AI is needed when deterministic logic suffices.**

---

## 17. DevOps, CI/CD and Deployment

- [ ] Environment separation: dev / staging / production (config and data).
- [ ] Reproducible builds: lockfiles committed; pinned runtimes.
- [ ] CI on every change: install → lint → typecheck → test → build.
- [ ] Secret scanning in CI (e.g., gitleaks) and before commits.
- [ ] Containerize **only when justified** by deployment target or team
      practice — not by default.
- [ ] Environment variables documented (`.env.example`, placeholders only).
- [ ] Database migrations run as a defined deployment step with rollback.
- [ ] Health checks exposed; deployment verified by hitting them.
- [ ] Logs aggregated; errors tracked (Sentry or equivalent where budget
      allows); alerts on error-rate/latency budget.
- [ ] Rollback plan per deploy; backups automated and restore-tested.
- [ ] Never invent production URLs/credentials. Never claim deployment
      succeeded without verification (hit the health endpoint, check the
      version, run a smoke test).

Choose tools from the existing architecture and actual requirements. Do
not mandate Docker/Kubernetes/Terraform for projects that need none.

---

## 18. Git, GitHub and Change Management

### Before editing

- [ ] Current branch; `git status`; stash/commit uncommitted user work?
- [ ] Remote and recent history (`git log --oneline -10`, merge style).

### Before committing

- [ ] Review the full diff (`git diff --staged`).
- [ ] Run the relevant checks (tests/lint/build).
- [ ] Secret-scan the diff (tokens, keys, `.env`, credentials in fixtures).
- [ ] Confirm `.gitignore` covers artifacts, env files, DBs, screenshots.
- [ ] Meaningful commit message: why, not just what. Match repo style.

### When pushing is authorized

- [ ] Verified remote and branch; preserve history; **no force-push** to
      shared branches; never overwrite others' work.
- [ ] Report the actual commit hash and push result.
- [ ] If access fails, report the precise blocker — do not claim success.

**Never automatically publish secrets or private data.** Commit/push only
when the user requested it.

---

## 19. Documentation and Developer Experience

- [ ] README: purpose, features, architecture overview, prerequisites,
      install, local dev, commands (dev/build/test/lint), env var reference,
      database setup, deployment steps, troubleshooting, known limitations.
- [ ] `.env.example` with placeholders and comments per variable.
- [ ] API docs (OpenAPI or Markdown) for public/internal APIs.
- [ ] Documentation matches the **actual implementation** — update it in
      the same change; never document an imagined architecture.
- [ ] Avoid duplicate doc files; one canonical location per topic.

---

## 20. Observability, Reliability and Maintenance

- [ ] Structured logs (JSON or key=value) with request correlation.
- [ ] Metrics: traffic, error rate, latency, saturation for critical
      services.
- [ ] Health checks (liveness + readiness) used by the platform.
- [ ] Error tracking with release tagging.
- [ ] Background jobs observable (queue depth, failures, retries).
- [ ] Resource limits set (memory, connections, file sizes); no unbounded
      caches/arrays.
- [ ] Retry/recovery paths defined; dependencies updated on a cadence
      (Dependabot/Renovate where available).
- [ ] Never log passwords, tokens or private message content.

Prefer a few actionable alerts over dashboard sprawl.

---

## 21. Conditional Execution Matrix

**Mandatory**: classify the project, then select sections.

| Project type | Typically applies |
|---|---|
| Static website / landing | 2,3,4,5,6,7*,9,10,12,17,18,19 |
| Frontend application | 2,3,4,5,6,7,8,9*,10,11,12,17,18,19 |
| Full-stack application | 2–13,15,17,18,19,20 |
| Backend / API | 2,3,4,7,8,11,12,13,15,17,18,19,20 |
| PWA / mobile | full web set + 14 |
| Multi-tenant SaaS | full set; 11 multi-tenant tests mandatory |
| AI/ML system | full applicable set + 16 |
| Automation tool | 2,3,4,7,8,11,12,16*,17,18,19 |
| Data/CLI tool | 2,3,4,7,8,11,12,13*,17,18,19 |

\* where relevant. Skipped sections → `NOT APPLICABLE` + short reason when
meaningful (e.g., "SEO: NOT APPLICABLE — authenticated internal tool").

Examples of conditional judgment:
- SEO matters for public sites, not private dashboards.
- PWA checks apply only when PWA behavior is required.
- Migrations apply only when a database exists.
- Cross-tenant isolation applies only when tenants share infrastructure.
- ML evaluation applies only when models are in the product.
- DevOps depth scales with deployment complexity.

---

## 22. Prioritization and Execution Control

Work in this order (adjust for project-specific safety):

1. Data-loss and security risks
2. Broken critical workflows
3. Correctness and data integrity
4. Authentication and authorization
5. Build and deployment blockers
6. Functional completeness
7. Responsive UI and accessibility
8. Reliability and error handling
9. Performance
10. SEO and discoverability
11. Maintainability and documentation
12. Nonessential polish

### Execution control

- Prefer a targeted fix over broad change; widen scope only with reason.
- After each major phase: run checks → review diff → fix regressions →
  update the plan.
- Missing essential external info → ask focused questions; meanwhile
  continue all independent work. **A blocked task never blocks the whole
  project.**
- Never abandon a task after planning when implementation was requested.

---

## 23. Completion Gate

Compilation or a finished-looking UI ≠ complete. Before reporting done,
verify every applicable category and report status, checks performed,
findings, fixes and remaining blockers.

- [ ] Requirements met (acceptance criteria satisfied)
- [ ] Architecture sound and consistent
- [ ] Functional behavior verified end-to-end
- [ ] UI/UX matches references/design system
- [ ] Responsive behavior verified at representative viewports
- [ ] Accessibility baseline met (manual + automated)
- [ ] Backend integration verified against real endpoints
- [ ] Data integrity confirmed (persistence, constraints, migrations)
- [ ] Security reviewed (authZ server-side, secrets, input handling)
- [ ] Tests executed and passing (report counts honestly)
- [ ] Performance measured where relevant
- [ ] SEO applied/skipped appropriately
- [ ] PWA/mobile behavior verified where applicable
- [ ] CI green; deployment verified where performed
- [ ] Documentation updated
- [ ] Git hygiene: clean diff, no secrets, meaningful commits

Use the reporting template in Section 25.

---

## 24. Execution Templates

### 24.1 New Project Initialization

```text
1. Classify project type + primary user flows (Section 21).
2. Scaffold with the ecosystem's standard tooling (e.g., create-next-app,
   cargo new, uv init) — do not hand-roll conventions.
3. Establish in the first commit:
   - folder structure with separated concerns
   - lint + format + typecheck configured and passing
   - test harness with one passing smoke test
   - CI running install → lint → typecheck → test → build
   - .env.example + .gitignore appropriate to the stack
   - README with purpose, setup, commands, env reference
4. Define the design system (or locate references) BEFORE building screens.
5. Define API contracts/data schemas BEFORE implementing endpoints.
6. Implement the thinnest end-to-end vertical slice (UI → API → DB)
   to prove the architecture, then expand feature by feature.
7. Add security defaults at the start (authN/Z pattern, validation,
   secrets handling) — retrofitting is riskier.
```

### 24.2 Existing Project Improvement

```text
1. Stage A + B fully (understand + audit) before any edit.
2. Classify the request: bug fix / feature / refactor / audit.
3. Produce the smallest safe plan; keep working code intact.
4. Match existing conventions (naming, structure, patterns) even where a
   different style is personally preferable.
5. For each change: implement → verify (tests/build/manual) → review diff
   → next change. Keep the suite green throughout.
6. Run the FULL relevant check suite at the end (earlier passing results
   do not cover later edits).
7. Report what changed, why, how it was verified, and any regressions.
```

### 24.3 Task-Specific Execution (narrow change)

```text
1. Restate the acceptance criteria in one paragraph.
2. Locate every file the task touches; check importers/callers.
3. Skim only the relevant playbook sections (Section 21 matrix).
4. Implement the minimal diff; no drive-by refactors.
5. Verify: targeted tests + nearest integration path + one manual
   end-to-end pass through the changed flow.
6. Scan the diff for unrelated changes and secrets.
7. Report with the completion template, scoped to this task.
```

### 24.4 Verification command examples (adapt to stack)

```bash
# JS/TS
npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build
# Python
uv sync && ruff check . && mypy . && pytest
# Go
go vet ./... && go test ./... && go build ./...
# Rust
cargo clippy -- -D warnings && cargo test && cargo build --release
```

Always capture real exit codes:
`npm test > test.log 2>&1; CODE=$?` — a passing output filter is not a
passing test.

---

## 25. Reporting Templates

### 25.1 Task completion report

```markdown
## Task Report: <task name>

### Deliverables
- <file/endpoint/artifact> — <what it does>

### Verification
| Check | Command/Method | Result |
|---|---|---|
| Type check | `tsc --noEmit` | PASSED |
| Lint | `npm run lint` | PASSED |
| Unit tests | `npm test` (n passed) | PASSED |
| Build | `npm run build` | PASSED |
| Manual E2E | <flow tested> | PASSED |
| Responsive | <viewports> | PASSED / NOT APPLICABLE |

### Findings & fixes
- <issue found → fix applied>

### Known issues / blockers
- BLOCKED: <what> — needs <prerequisite>
- NOT RUN: <check> — reason

### Notes
- Assumptions made (if any)
```

### 25.2 Audit report (project-level)

```markdown
## Engineering Audit: <project>

### Classification
<Project type; applicable playbook sections; skipped sections + reason>

### Baseline
Stack · versions · test count · build status · measured metrics

### Findings (ranked: impact / confidence / risk / effort)
1. <finding> — evidence — recommended fix

### Plan
Phase 1 (critical) … Phase 3 (polish), each with acceptance criteria

### Execution log
Per change: files, verification, before/after measurements
```

### 25.3 Status line format

For every category in the Completion Gate:

```text
<category>: PASSED | FAILED | BLOCKED | NOT RUN | NOT APPLICABLE — <evidence or reason>
```

---

*End of playbook. This document is self-contained: hand it to a
repository-aware coding agent at the start of any project or task.*
