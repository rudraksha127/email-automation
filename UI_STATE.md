# UI Migration State Tracker

- **Target App**: `c:\Users\lucky\email-automation`
- **Reference App**: `c:\Users\lucky\OneDrive\Desktop\Data Collection\Certification data collection\hod-web` (READ-ONLY)
- **Branch**: `ui/2026-10-12`
- **Safety Tag**: `pre-ui`
- **Mode**: `PLAN_THEN_BUILD`

---

## Phase Checklist

- [x] **Phase 0: Safety & Baseline**
  - Working branch created: `ui/2026-10-12`
  - Safety tag set: `pre-ui`
  - Baseline checks:
    - Typecheck: 0 errors
    - Tests: 109 / 109 passed
    - Production build: Succeeded with all routes
  - Reference folder confirmed READ-ONLY outside repo.

- [x] **Phase 1: Freeze Snapshot**
  - Scripts created: `scripts/freeze-snapshot.mjs`, `scripts/verify-freeze.mjs`
  - Screen snapshots extracted: 14 screens saved to `/design-review/freeze/*.json`
  - Automated freeze verification: Verified with 0 violations.

- [x] **Phase 2: Extract Reference Design Language**
  - Extracted to: `DESIGN_DNA.md`
  - Colors: Material 3 institutional scale (`surface`, `container`, `primary`, `on-*`)
  - Typography: `Plus Jakarta Sans` full token scale
  - Elevations, spacing, motion, form autofill mitigations documented.

- [x] **Phase 3 & 4: Audit & Migration Planning**
  - Documented in: `UI_MIGRATION_PLAN.md`
  - Token map complete
  - Component map complete
  - Layout map per screen complete
  - Zero content/data change contract established
  - Status: **PAUSED (Awaiting User Approval to Build)**

- [ ] **Phase 5: Implementation (One commit per step)**
  - [ ] Step 5.1: Tokens & Theme CSS
  - [ ] Step 5.2: Base Primitives (`Button`, `Input`, `Badge`, `Modal`)
  - [ ] Step 5.3: AppShell & Navigation (Header, Sidebar, Drawer, Bottom Bar)
  - [ ] Step 5.4: Screens (Login, Dashboard, Mails, Batches, Settings, Profile)
  - [ ] Step 5.5: Freeze Check validation on all screens

- [ ] **Phase 6: Final Verification & Evidence**
- [ ] **Phase 7: UI Report (`UI_REPORT.md`)**
