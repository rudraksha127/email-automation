# UI Migration Plan: Design Transfer from HOD Web

- **Reference**: `hod-web` (READ-ONLY)
- **Target**: `email-automation`
- **Scope**: Whole App
- **Fidelity**: HIGH
- **Current Branch**: `ui/2026-10-12` (Safety tag: `pre-ui`)
- **Mode**: PLAN_THEN_BUILD (Awaiting Approval)

---

## 1. Token Mapping (Reference -> Target)

| Reference Token | Target CSS / Tailwind Token | Computed Hex / Value | Purpose |
| :--- | :--- | :--- | :--- |
| `surface` | `bg-surface` / `--color-surface` | `#FAF8FF` | App page canvas background |
| `surface-container-lowest` | `bg-surface-lowest` / `bg-white` | `#FFFFFF` | Primary content cards, modals |
| `surface-container-low` | `bg-surface-low` / `--color-surface-low` | `#F2F3FF` | Secondary card fills, inputs |
| `surface-container` | `bg-surface-container` | `#EAEDFF` | Active nav items, chips |
| `surface-container-high` | `bg-surface-high` | `#E2E7FF` | Hover states |
| `on-surface` | `text-on-surface` | `#131B2E` | High-contrast body & headings |
| `on-surface-variant` | `text-on-surface-variant` | `#414754` | Subtitles, muted labels |
| `primary` | `bg-primary`, `text-primary`, `border-primary` | `#005BBF` | Brand blue, primary buttons |
| `primary-container` | `bg-primary-container` | `#1A73E8` | Selected navigation items |
| `primary-fixed` | `bg-primary-fixed` | `#D8E2FF` | Pill badges |
| `on-primary-fixed` | `text-on-primary-fixed` | `#001A41` | High-contrast text on blue badges |
| `secondary` | `text-secondary`, `bg-secondary` | `#076D2E` | Success badges |
| `error` | `text-error`, `bg-error` | `#BA1A1A` | Destructive alerts & actions |
| `shadow-card` | `shadow-card` | `0 1px 8px rgba(0,0,0,0.04)` | Subtle elevated cards |
| `shadow-dialog` | `shadow-dialog` | `0 8px 30px rgba(19,27,46,0.18)` | Modal overlays |
| `font-jakarta` | `font-sans` | `'Plus Jakarta Sans', system-ui` | Primary typography |

---

## 2. Component Migration Map

| Reference Pattern | Target Component / Screen | Strategy | Risk |
| :--- | :--- | :--- | :--- |
| **Material 3 Action Button** | `src/components/ui/Button.tsx` | Restyle with `bg-primary hover:bg-[#004EAA] active:scale-[0.99] rounded-xl h-11` | None (Props/handlers frozen) |
| **Floating Focused Input** | `src/components/ui/Input.tsx` | Restyle container `bg-surface-container-low focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/15` | None (Input names & IDs frozen) |
| **Institutional Status Pill** | `src/components/ui/Badge.tsx` | Restyle `Pill` & `StatusBadge` using `primary-fixed`, `secondary-container`, `error-container` | None |
| **Top App Header** | `src/components/AppShell.tsx` (`AppHeader`) | Restyle with sticky `bg-white/95 backdrop-blur-xl border-b border-slate-200/80` + IST date chip | None |
| **Responsive Sidebar & Drawer** | `src/components/AppShell.tsx` (`AppNav`) | Restyle desktop sidebar `w-64 border-r border-slate-200/80` and mobile drawer `bg-white shadow-2xl` with `label-lg` nav links | None (Routes frozen) |
| **User Identity Card** | `src/components/AppShell.tsx` (`UserCard`) | Restyle with `bg-surface-container-low border border-slate-200/60` | None |
| **Login View** | `src/app/login/page.tsx` | Restyle card container `rounded-2xl border border-slate-200/80 shadow-card bg-white` single-screen layout | None (Fields & handlers frozen) |
| **Dashboard Stat Cards** | `src/app/dashboard/page.tsx` | Restyle stat cards to 4-column responsive grid with `surface-container-lowest shadow-card` | None (Metrics & URLs frozen) |
| **Mails & Batches Data Tables** | `src/app/mails/page.tsx`, `src/app/batches/page.tsx` | Restyle table rows with hairline dividers `border-b border-slate-100`, hover `bg-surface-container-high/40` | None (Data & sort order frozen) |
| **Developer Credit Modal** | `src/components/DeveloperModal.tsx` | Restyle modal container `max-w-[380px] rounded-2xl shadow-dialog` with hairline row dividers | None (Data verbatim) |

---

## 3. Layout Map per Screen

1. **`/login`**:
   - Single-page zero-scroll layout.
   - Brand header with `GraduationCapIcon`, IT Department title, `Academic Session` chip.
   - Form card with email/password inputs, remember checkbox, and full-width primary button.
   - Context note chip and footer credit.
2. **`/dashboard`**:
   - Sticky header with current IST session chip and profile initials.
   - 4-card metric overview (`Total Mails`, `Batches`, `Pending`, `Success Rate`).
   - Recent mail activity list with status chips.
3. **`/mails` & `/mails/[id]`**:
   - Filter chips bar (All, Pending, Forwarded, Failed).
   - Search input and sync trigger button.
   - Detailed email reader with header metadata and recipient batch chip.
4. **`/batches` & `/batches/[id]`**:
   - Batch cards with total recipient counts and department tags.
   - Recipient management list with action buttons.
5. **`/settings` & `/profile`**:
   - Segmented section cards (Email connection, CC rules, security, password update).
   - Consistent form controls and primary save action buttons.

---

## 4. Fonts, Assets & Dependencies
- **Font**: `Plus Jakarta Sans` loaded offline/self-hosted via Next.js `next/font/google` (`display: swap`).
- **Icons**: Retain existing Lucide icons (`GraduationCapIcon`, `MailIcon`, `ShieldIcon`, `ClockIcon`, etc.) styled with 20px / stroke 1.8-2.2 matching reference.
- **New External Dependencies**: `0` (Zero new dependencies required; native Tailwind tokens and CSS utilities).

---

## 5. Non-Applied Elements & Deviations
- **Not Applied (Needs Content)**: Any reference attendance-specific badges (e.g. "Lecture Hall", "Present/Absent", "Biometric Logs") are omitted as target is Mail Automation.
- **Accessibility & Contrast**: All text color combinations (`on-surface` `#131B2E` on white/surface `#FAF8FF`) exceed WCAG 2.2 AA with contrast ratio `14.8:1`.
- **Content Freeze**: Guaranteed 100% preservation of all existing text, labels, IDs, ARIA, and logic.

---

## 6. Implementation Sequence & Rollback Plan

### Sequence (Step 5)
1. **Tokens & Theme Config**: Extend Tailwind theme in `frontend/src/app/globals.css` with reference Material 3 color tokens.
2. **Global Primitives**: Update `Button.tsx`, `Input.tsx`, `Badge.tsx`, `Modal.tsx`.
3. **Navigation Shell**: Update `AppShell.tsx` (Header, Desktop Sidebar, Mobile Drawer, Bottom Bar).
4. **Core Screens**: Update `/login`, `/dashboard`, `/mails`, `/batches`.
5. **Secondary Screens**: Update `/history`, `/settings`, `/profile`, `/workspace`.
6. **Freeze Check**: Run `scripts/verify-freeze.mjs` after every step to verify 0 content changes.

### Rollback Strategy
- Safety git tag: `pre-ui`
- Working branch: `ui/2026-10-12`
- Revert command if needed: `git checkout main && git branch -D ui/2026-10-12`
