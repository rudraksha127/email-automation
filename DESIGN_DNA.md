# Design DNA: HOD Web Reference Transfer

Extracted from Reference Application: `hod-web` (READ-ONLY)
Target Application: `email-automation`
Analysis Mode: STATIC + CONFIG INSPECTION

---

## 1. Technical Stack & Styling Approach
- **Framework**: Next.js (App Router) + React 19 + Tailwind CSS
- **Styling Architecture**: Modern semantic utility tokens (Material 3 token mapping)
- **Viewport & Dynamic Height**: `100dvh` with `100vh` fallback (`@supports not (height: 100dvh)`), `-webkit-overflow-scrolling: touch`, `overscroll-behavior-y: none`.

---

## 2. Color System (Material 3 Institutional Palette)

### Surface & Canvas Tiers
| Token | Hex | Semantic Role |
| :--- | :--- | :--- |
| `surface` | `#FAF8FF` | Default page background canvas |
| `surface-dim` | `#D2D9F4` | Dimmed / recessed background state |
| `surface-bright` | `#FAF8FF` | Bright contrast background |
| `surface-container-lowest` | `#FFFFFF` | Primary cards, elevated modals, dialogs |
| `surface-container-low` | `#F2F3FF` | Secondary card fills, inputs, subtle chips |
| `surface-container` | `#EAEDFF` | Active navigation pills, icon containers |
| `surface-container-high` | `#E2E7FF` | Hover states on interactive surfaces |
| `surface-container-highest` | `#DAE2FD` | Hairline borders, dividers, chip backgrounds |

### Text & Contrast (`on-*`)
| Token | Hex | Semantic Role |
| :--- | :--- | :--- |
| `on-surface` | `#131B2E` | High-contrast primary text, headings |
| `on-surface-variant` | `#414754` | Subtitles, secondary text, muted metadata |
| `outline` | `#727785` | Unfocused borders, placeholders |
| `outline-variant` | `#C1C6D6` | Subtle dividers, card borders |
| `inverse-surface` | `#283044` | Dark mode / inverted tooltips, toasts |
| `inverse-on-surface` | `#EEF0FF` | Text on inverted tooltips |

### Primary Accent (Institutional Royal Blue)
| Token | Hex | Semantic Role |
| :--- | :--- | :--- |
| `primary` | `#005BBF` | Key brand actions, primary buttons, focus rings |
| `on-primary` | `#FFFFFF` | Text on primary buttons |
| `primary-container` | `#1A73E8` | Selected navigation items, prominent badges |
| `on-primary-container` | `#FFFFFF` | Text on active container chips |
| `primary-fixed` | `#D8E2FF` | Soft blue badge background |
| `on-primary-fixed` | `#001A41` | High-contrast text on soft blue badge |

### Status Accents (Functional Semantics)
- **Success / Green**: `secondary` (`#076D2E`), `secondary-container` (`#9CF7A7`), `on-secondary-container` (`#147434`)
- **Warning / Amber**: `tertiary-container` (`#DF3429`), `amber-600` (`#D97706`), `amber-50` (`#FFFBEB`)
- **Destructive / Red**: `error` (`#BA1A1A`), `on-error` (`#FFFFFF`), `error-container` (`#FFDAD6`), `on-error-container` (`#93000A`)

---

## 3. Typography Hierarchy (`Plus Jakarta Sans`)

Font Family: `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`  
Loaded via: `next/font/google` (`subsets: ["latin"]`, weights: `400, 500, 600, 700, 800`)

| Token | Size | Line Height | Letter Spacing | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `headline-lg` | 28px | 34px | -0.02em | 700 (Bold) | Major modal titles, primary screen headers |
| `metric-display` | 26px | 30px | -0.02em | 700 (Bold) | Key stats numbers, department headings |
| `title-lg` | 24px | 30px | -0.01em | 700 (Bold) | Section cards, card group headers |
| `title-md` | 22px | 28px | -0.01em | 700 (Bold) | Header page titles |
| `headline-md` | 20px | 26px | -0.01em | 700 (Bold) | Compact headers |
| `headline-sm` | 18px | 24px | normal | 600 (Semibold) | Sidebar brand title |
| `body-lg` | 16px | 24px | normal | 500 (Medium) | Prominent body text, touch input values |
| `body-md` | 14px | 20px | normal | 400 (Regular) | Standard body, table cells |
| `label-lg` | 14px | 18px | normal | 600 (Semibold) | Navigation links, button labels |
| `label-md` | 12px | 16px | 0.01em | 600 (Semibold) | Badges, date chips, table column headers |
| `body-sm` | 12px | 16px | normal | 400 (Regular) | Secondary notes, input hints |
| `label-sm` | 11px | 14px | 0.02em | 600 (Semibold) | Secondary pills, tab indicators |
| `body-xs` | 11px | 16px | normal | 400 (Regular) | Fine print, metadata timestamps |
| `label-xs` | 10px | 12px | 0.02em | 600 (Semibold) | Micro pills, status badges |

---

## 4. Spacing, Radii & Elevations

### Spacing Scale
- `space-xs`: `0.25rem` (4px)
- `space-sm`: `0.5rem` (8px)
- `space-md`: `0.75rem` (12px)
- `space-lg`: `1rem` (16px)
- `space-xl`: `1.5rem` (24px)
- `space-2xl`: `2rem` (32px)
- `gutter`: `0.75rem` (12px)
- `margin`: `1rem` (16px)

### Border Radius
- Default: `0.25rem` (4px)
- `rounded-lg`: `0.5rem` (8px) - Badges, micro chips
- `rounded-xl`: `0.75rem` (12px) - Buttons, input containers, nav items, cards
- `rounded-2xl`: `1rem` (16px) - Major cards, dialogs, slide-over drawer
- `rounded-full`: `9999px` - Avatars, pills, circular action triggers

### Shadows & Elevations
- `shadow-xs`: `0 1px 2px rgba(19, 27, 46, 0.06)`
- `shadow-card`: `0 1px 8px rgba(0, 0, 0, 0.04)`
- `shadow-dialog`: `0 8px 30px rgba(19, 27, 46, 0.18)`
- Hairline Borders: `border border-slate-200/80` or `border border-outline-variant/60`

---

## 5. Motion & Micro-Interactions
- **Entrance Utility**: `.animate-in` with duration `200ms` and `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Entrance Variants**: `.fade-in` (`--tw-enter-opacity: 0`), `.zoom-in-95` (`--tw-enter-scale: 0.95`), `.slide-in-from-bottom-2` (`--tw-enter-translate-y: 0.5rem`).
- **Button Active State**: `active:scale-[0.99]` (subtle, tactile institutional click feedback).
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce`.

---

## 6. Form Controls & Autofill Patterns
- **Inputs**: Rounded 12px container, leading icon chip, clean background (`bg-surface-container-low` or `bg-white`), focus ring `focus-within:ring-2 focus-within:ring-primary/15 focus-within:border-primary`.
- **Chrome Autofill Mitigation**:
  - `-webkit-box-shadow: 0 0 0 1000px #ffffff inset !important`
  - Long running transition hack: `transition: background-color 999999s step-end 0s, color 999999s step-end 0s`
  - Hides native `-webkit-contacts-auto-fill-button` so it never overlaps password toggles.

---

## 7. Layout Shell Patterns
- **Desktop (>=1024px)**: Fixed left navigation sidebar (`w-72` or `w-64`), sticky header with user identity and breadcrumbs, single-tier scrollable content container.
- **Mobile (<1024px)**: Slide-over drawer overlay (`bg-slate-900/60 backdrop-blur-xs`), fixed bottom tab bar (5 primary destinations), sticky header with hamburger button.
- **Safe Areas**: `pt-[env(safe-area-inset-top,0px)]`, `pb-[max(env(safe-area-inset-bottom),0.75rem)]`.
