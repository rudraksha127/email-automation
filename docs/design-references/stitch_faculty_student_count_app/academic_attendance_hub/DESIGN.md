---
name: Academic Attendance Hub
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#424654'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0054d7'
  primary: '#0049be'
  on-primary: '#ffffff'
  primary-container: '#1d61e7'
  on-primary-container: '#e8ebff'
  inverse-primary: '#b3c5ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#754900'
  on-tertiary: '#ffffff'
  tertiary-container: '#965e00'
  on-tertiary-container: '#ffe8d1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b3c5ff'
  on-primary-fixed: '#00184a'
  on-primary-fixed-variant: '#003fa5'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.1px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.2px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.3px
  display-stat:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system delivers a focused, dependable, and swift administrative experience built specifically for academic faculty and department coordinators. Grounded in a modern corporate-institutional aesthetic, the interface balances precision with effortless mobile ergonomics. 

Faculty members often complete student headcounts under tight time constraints between lectures or during morning roll calls. The design reduces cognitive friction through high-contrast typography, large touch targets (minimum 48px), immediate visual verification, and tactile reassurance.

Key aesthetic qualities:
- **Calm & Institutional:** Crisp white layered cards floating on soothing ice-blue and slate backgrounds prevent eye fatigue in indoor fluorescent lighting.
- **Data Clarity:** Bold, prominent numerical badges and summary counters allow professors to audit and verify class strength at a glance.
- **Utilitarian Speed:** Linear workflows, explicit single-action screen progressions, and clear thumb-zone interactive buttons optimize rapid numeric entry.

## Colors

The palette is tuned for high legibility, clean visual segmentation, and unambiguous operational status.

- **Primary (`#1D61E7`):** The signature vibrant cobalt blue. Used for primary call-to-actions, active navigation states, radio/checkbox fills, and institutional brand marks. A lighter variant (`#EFF6FF`) serves as container fills for active pills, date chips, and timing selectors.
- **Secondary (`#10B981`):** Institutional success green. Reserved for positive affirmations, confirmed submissions, active status indicators ("Submitted"), and the highlighted total headcount counter cards.
- **Tertiary (`#F59E0B`):** Warm amber. Used strictly for contextual time markers (morning sun icon indicators) and pending actions that require attention before deadline lockouts.
- **Neutral & Surfaces:**
  - Base Background: `#F0F5FF` to `#F8FAFC` providing soft contrast without harsh glare.
  - Card & Modal Surfaces: Pure `#FFFFFF` to ensure high contrast against inputs.
  - Structural Borders: `#E2E8F0` for crisp, hairline separation.
  - Primary Text: `#0F172A` (deep slate navy) for maximum contrast against white cards.
  - Secondary Text: `#64748B` (neutral slate) for labels, timestamps, and secondary captions.
  - Destructive / Alert: `#EF4444` for logout and error notifications.

## Typography

The typography hierarchy uses **Inter** across all roles to maintain clean tabular numeral alignment and uniform vertical metrics. 

- **Display Stat (`display-stat`):** Specially assigned for the primary metric display (e.g., aggregate student count `438`). Must use tabular lining numbers (`font-variant-numeric: tabular-nums`) so numbers do not jump during rapid increments.
- **Section & Page Headers:** `headline-md` provides strong anchor points at the top of workflows without dominating the mobile viewport.
- **Row Titles & Section Dividers:** `label-lg` combined with `headline-sm` gives academic section headers ("2nd Year", "3rd Year") an organized catalog structure.
- **Readability Rules:** All input values and numerical count displays must be set with medium or semi-bold weights (`500` or `600`) to guarantee instant recognition under bright ambient light.

## Layout & Spacing

The system is architected for compact, single-column mobile viewports spanning 360px to 430px wide.

- **Grid & Margins:** A strict single-column flex flow constrained by a global outer margin of `16px` (`margin: 1rem`). Internal card paddings default to `16px` (`space-lg`), reducing to `12px` (`space-md`) in multi-row table configurations.
- **Thumb Zone Priority:** Primary submission actions are anchored to the bottom sheet using sticky containers padded at `16px` above the native safe-area inset.
- **Vertical Rhythm:**
  - `space-xs` (4px) separates tight inline labels and badge tags.
  - `space-sm` (8px) separates form field titles from input containers.
  - `space-md` (12px) structures entry rows inside a class group card.
  - `space-xl` (24px) creates distinct separation between academic year cohorts.
- **Adaptive Breakpoints:** While primarily mobile-first, on tablet screens (>600px), count entry groups reflow into a balanced 2-column card grid with `16px` gutters.

## Elevation & Depth

Visual depth is achieved through crisp surface contrast and subtle, cool-toned ambient shadows rather than dramatic drop shadows.

- **Level 0 (Flat / Canvas):** Applied to the base canvas (`#F0F5FF` to `#F8FAFC`). No shadow.
- **Level 1 (Card Rest):** Applied to content cards, data tables, and input containers. Pure white background `#FFFFFF` bordered by a 1px solid stroke of `#E2E8F0` and an ultra-subtle tinted shadow: `0px 2px 8px -2px rgba(15, 23, 42, 0.04)`.
- **Level 2 (Interactive Floating & Modals):** Applied to floating bottom action bars and confirmation bottom sheets: `0px 8px 24px -4px rgba(29, 97, 231, 0.08)`.
- **Level 3 (Count Focus & Popovers):** Active input boxes elevate slightly with a high-contrast focus ring: `0 0 0 3px rgba(29, 97, 231, 0.15)`.
- **Dividers & Structural Rules:** Soft lines (`1px solid #F1F5F9`) separate repeated rows within cards to avoid heavy visual breaks.

## Shapes

The design incorporates a welcoming, highly modern rounded profile (`roundedness: 2`).

- **Base Cards & Cohort Modules:** 16px (`rounded-2xl` / `1rem`) corner radius to create smooth visual envelopes around data tables.
- **Interactive Inputs & Counters:** 10px to 12px pill-softened boxes for headcount input cells, making each box feel like a distinct tactile target.
- **Buttons:** 12px border radius for full-width action bars; full pill (`rounded-full` / `9999px`) for metadata chips (e.g., date and status tags).
- **Avatars & Status Indicators:** Perfect circles (`rounded-full`) for profile badges, checkmarks, and time-of-day iconography containers.

## Components

### Buttons
- **Primary Action Button:** Full-width, 48px to 52px height, filled with `#1D61E7`, text in `#FFFFFF` (`label-lg`), with a 12px corner radius. States include hover (`#1952C4`) and disabled (opacity 40%).
- **Secondary / Back Button:** 48px height, outlined or soft neutral fill (`#F1F5F9`), text in `#0F172A`. In review screens, split 50/50 with primary button via an 8px gap.

### Input Fields & Count Cells
- **Text & Credential Inputs:** 48px height, `#FFFFFF` background, bordered with `#E2E8F0`, left-aligned icon in `#64748B`, with floating placeholder labels.
- **Numeric Count Cells:** Pill-softened inputs (40px height) centered with bold tabular numbers (`16px`, weight `600`). Accompanied by a trailing edit pencil icon (`#1D61E7`) indicating interactive tap-to-edit behavior.

### Cards & Section Containers
- **Class Group Card:** Wrapped in white `#FFFFFF` with 16px corner radius and `#E2E8F0` border. Headers feature soft blue pills for class labels (e.g., "2nd Year" in `#1D61E7` on `#EFF6FF`). Internal rows feature alternating subtle hover states.
- **Summary Stat Card:** Centered prominent box with soft emerald tint (`#ECFDF5`), emerald border (`#A7F3D0`), housing the auto-calculated total in `display-stat` (`#059669`).

### Chips & Badges
- **Status Pills:** Pill-shaped tags (`rounded-full`) with 4px vertical and 10px horizontal padding. "Submitted" uses green text (`#059669`) over soft green (`#D1FAE5`). "Pending" uses slate text (`#475569`) over `#F1F5F9`.
- **Date Selector Chip:** Centered top pill with calendar icon, displaying dates in `label-md` with soft `#F0F5FF` background and `#1D61E7` text.

### Navigation & Bottom Bar
- **Bottom Navigation Bar:** Fixed bottom container, height 64px, `#FFFFFF` with top border `#E2E8F0`. Four core destinations: Home, Entry, History, Profile. Active tab highlighted in vibrant cobalt blue (`#1D61E7`) with a 20px filled icon and 11px label.