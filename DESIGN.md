---
version: alpha
name: OpenStudy
description: A warm, approachable learning workbench — Claude Code-inspired terracotta and limestone palette with system-native typography.
colors:
  primary: "#c96442"
  primary-hover: "#b35a3b"
  primary-active: "#9a4d31"
  primary-subtle: "#f5e6dc"
  primary-fg: "#ffffff"
  bg: "#faf9f5"
  bg-elev: "#ffffff"
  bg-subtle: "#f3f1ea"
  bg-hover: "#ebe8de"
  bg-active: "#e1ddcf"
  fg: "#2b2925"
  fg-muted: "#6b6862"
  fg-subtle: "#9a978d"
  fg-inverse: "#faf9f5"
  border: "#e0ddd1"
  border-strong: "#c5c1b3"
  border-focus: "#c96442"
  danger: "#c1372b"
  danger-subtle: "#fbeae6"
  danger-hover: "#fde2dd"
  danger-fg: "#ffffff"
  success: "#5d7a3a"
  success-subtle: "#eef2dc"
  success-hover: "#e8efd9"
  success-fg: "#ffffff"
  warning: "#b07d1a"
  warning-subtle: "#f8efd6"
  warning-border: "#d4a04b"
  warning-fg: "#1f1d18"
  info: "#4a6b8a"
  info-subtle: "#e2eaf2"
  info-fg: "#ffffff"
typography:
  h1:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif'
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  h2:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif'
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.015em
  h3:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif'
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.015em
  body-lg:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif'
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.7
  body-md:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif'
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif'
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 4px
  md: 6px
  lg: 10px
  xl: 14px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary-active}"
  button-primary-solid:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.md}"
  button-danger-solid:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.danger-fg}"
    rounded: "{rounded.md}"
  button-success-solid:
    backgroundColor: "{colors.success}"
    textColor: "{colors.success-fg}"
    rounded: "{rounded.md}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  button-ghost-hover:
    backgroundColor: "{colors.bg-hover}"
    textColor: "{colors.fg}"
  button-icon-only:
    size: 32px
    padding: 0
  button-danger:
    backgroundColor: "{colors.bg-elev}"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
  button-danger-hover:
    backgroundColor: "{colors.danger-hover}"
    textColor: "{colors.danger}"
  sidebar-link:
    backgroundColor: transparent
    textColor: "{colors.fg-muted}"
    rounded: 12px
    typography: "{typography.body-sm}"
  sidebar-link-active:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary}"
  card:
    backgroundColor: "{colors.bg-elev}"
    rounded: "{rounded.lg}"
    padding: 20px
  card-error:
    backgroundColor: "{colors.danger-subtle}"
    textColor: "{colors.danger}"
  card-success:
    backgroundColor: "{colors.success-subtle}"
    textColor: "{colors.success}"
  card-warning:
    backgroundColor: "{colors.warning-subtle}"
    textColor: "{colors.warning}"
  input:
    backgroundColor: "{colors.bg-elev}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: 7px 11px
  input-focus:
    backgroundColor: "{colors.bg-elev}"
    textColor: "{colors.fg}"
  badge:
    backgroundColor: "{colors.bg-subtle}"
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.full}"
  badge-primary:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary}"
  badge-success:
    backgroundColor: "{colors.success-subtle}"
    textColor: "{colors.success}"
  badge-danger:
    backgroundColor: "{colors.danger-subtle}"
    textColor: "{colors.danger}"
  badge-warning:
    backgroundColor: "{colors.warning-subtle}"
    textColor: "{colors.warning}"
  badge-info:
    backgroundColor: "{colors.info-subtle}"
    textColor: "{colors.info}"
  toast:
    backgroundColor: "{colors.bg-elev}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
  tooltip:
    backgroundColor: "{colors.bg-elev}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
---

## Overview

OpenStudy is a desktop learning workbench — an Electron app for reading, practicing, and AI-assisted study. The UI must feel warm, calm, and focused, never cold or corporate.

The design language draws from Claude Code's warm terracotta-and-limestone palette. It evokes a quiet study room: natural paper tones, a single warm accent for interaction, and generous whitespace that invites sustained focus. Nothing blinks, nothing shouts. Every element earns its place.

Typography runs on the system-native sans-serif stack, tuned for CJK-Latin mixed text. Spacing follows a strict 4px grid. All interactive elements carry a subtle press-down feedback. The UI supports light and dark themes with the same token structure — only the values shift, not the intent.

## Colors

The palette is built on warm limestone neutrals and a single terracotta accent. Semantic colors (danger, success, warning, info) are desaturated to sit comfortably alongside the warm neutrals.

- **Primary (#c96442):** "Warm Terracotta" — the sole driver of interaction. Used for primary buttons, active nav states, links, focus rings, and progress bars. Never used as a large-surface background.
- **Primary Subtle (#f5e6dc):** A pale peach tint for selected states, hover pre-highlights, and the soft glow behind primary elements.
- **Background (#faf9f5):** "Warm Limestone" — the page-level background. Slightly warm, softer than pure white, reduces eye strain over long study sessions.
- **Elevated Background (#ffffff):** Pure white for cards, sidebars, and input fields. The 4% brightness step from `bg` to `bg-elev` creates a gentle layering effect without harsh borders.
- **Foreground (#2b2925):** "Deep Ink" — a near-black with a hint of warmth. Used for body text and headlines. Not pure #000, which would feel sterile.
- **Muted Foreground (#6b6862):** Secondary text, captions, metadata. Warm gray that recedes without disappearing.
- **Border (#e0ddd1):** Subtle warm gray borders that define structure without drawing attention.

### Dark Theme

In dark mode, the palette inverts while preserving the same warm undertone:

- Background becomes a deep warm gray (#1f1f1e, #262626) rather than cold blue-black
- Primary shifts lighter (#d97757) to maintain contrast against dark surfaces
- Semantic colors brighten proportionally (#e76a5c danger, #91b35c success)
- Shadows deepen for realistic elevation on dark surfaces

## Typography

The app uses the system-native sans-serif stack, optimized for Chinese-Latin mixed content. All text runs at 14px base with 1.5 line-height.

- **Headlines:** Weight 600–700 with tight tracking (−0.015em to −0.02em). Headlines lead with confidence but stay compact — this is a tool, not marketing.
- **Body:** 14px Regular (400) at 1.5 leading. Question stems bump to 16px/600 for readability during practice.
- **Code:** The monospace stack (`SF Mono`, `JetBrains Mono`, `Fira Code`) is used for code questions, keyboard shortcuts, and data displays. Rendered at 0.9em relative to surrounding text.
- **Captions:** 11px for badges, timestamps, and legend text. Small but never below 11px — accessibility floor.
- **Sidebar Labels:** 11px uppercase with 0.08em tracking for navigation section headers. All-caps at small sizes signals hierarchy without adding visual weight.

The `font-feature-settings: 'cv11', 'ss01', 'ss03'` rule enables refined glyph variants on supporting system fonts for a more polished reading experience.

## Layout

The app follows a **sidebar + main content** layout with a resizable sidebar (200–360px, default 240px).

- **Spacing scale:** Strict 4px base grid — 4, 8, 12, 16, 20, 24, 32px. No ad-hoc values. The 4px half-step from the common 8px grid allows tighter packing where needed (icon gaps, badge padding).
- **Page padding:** 32px top, 40px horizontal, 48px bottom on desktop. Proportional reductions at narrower viewports (24px/24px at 1050px, 20px/16px at 760px).
- **Card grid:** Two-column grids at desktop (Overview panels, Insights, Settings). Single-column below 900px.
- **Practice layout:** Two-column — main question area (flexible) + sidebar (280–480px). On narrow viewports, sidebar stacks below main.
- **Header:** 56px implicit height, bottom border separates it from content. Action buttons pack into the right side.

## Elevation & Depth

Depth is conveyed through subtle layering rather than heavy shadows:

- **Level 0 (Page):** `bg` — the base canvas
- **Level 1 (Surface):** `bg-elev` — cards, sidebars, inputs sit 4% brighter
- **Level 2 (Hover):** `bg-hover` — interactive surfaces on hover
- **Level 3 (Active/Pressed):** `bg-active` — momentary press feedback

Shadows are sparse and soft:
- `shadow-sm`: Subtle lift for hovered buttons and option cards
- `shadow-md`: Cards with interactive hover states
- `shadow-lg`: Modal overlays and toast notifications

The sidebar link active state uses an `inset` box-shadow (1px primary at 18% opacity) to create a subtle inner border rather than a heavy outline.

Pressed buttons translate 0.5px down (`translateY(0.5px)`) — enough to feel tactile, not enough to look like a glitch.

## Shapes

The design uses a moderate rounding scale that prioritizes clarity:

- **4px (sm):** Inputs, inline code, small interactive elements
- **6px (md):** Default button radius, option cards, form fields
- **10px (lg):** Cards, panels, page sections — the default container radius
- **14px (xl):** Large blocks like AI bubbles, profile cards
- **9999px (full):** Badges, progress bars, segmented control pills

Sidebar links use 12px rounding — between md and lg — to feel distinct from content-area elements.

## Components

### Button

The default button is bordered, with `bg-elev` background. Three priority levels:

- **Primary:** Subtle terracotta tint background + terracotta text + matching border. On hover, the tint deepens and a subtle shadow appears. No solid fill — the warm-tint approach keeps primary actions prominent without screaming.
- **Ghost:** Transparent background, no border. Gains `bg-hover` background and border on hover. Used for secondary actions and toolbar items.
- **Danger:** White background + red border + red text. On hover, a light red tint background appears.

Icon-only buttons are 32×32px squares with zero padding — the icon itself carries the meaning.

Size variants: `sm` (4px/8px padding), default (6px/12px), `lg` (8px/16px).

### Card

The foundational container: `bg-elev` background, `radius-lg` (10px) corners, 20px padding, 12px bottom margin for stacking. A 1px `border` line defines the edge. Cards with `.interactive` gain a hover border-color shift and `shadow-md`.

Semantic variants: `.error` (danger border + danger-subtle background), `.success`, `.warning` (left border accent).

### Input

Bordered fields with `bg-elev` background and 7px/11px vertical/horizontal padding. On focus, the border shifts to `border-focus` (terracotta) and a 3px `primary-subtle` ring appears — matching the primary accent.

### Badge

Pill-shaped labels: `radius-full`, 2px/8px padding, 11px font. Defaults to `bg-subtle` + muted text. Semantic variants swap to the corresponding subtle background + text color (success green, danger red, warning amber, primary terracotta).

### Sidebar

240px default width, resizable between 200–360px. Navigation links are 40px tall with 12px horizontal padding and 12px border-radius. The active link fills with `primary-subtle` and `primary` text, plus an inset border-shadow. Section labels are 11px uppercase with 0.08em tracking.

### QuestionNav

A compact grid of numbered cells (5 columns) showing question status: correct (green), wrong (red), current (solid primary). Below 900px, expands to 10 columns. The current cell is inverted — primary fill with white text.

## Do's and Don'ts

- **Do** use `color-mix()` to derive hover/pressed states from base tokens rather than defining separate color values. Example: `color-mix(in srgb, var(--primary-subtle) 88%, var(--bg-elev))` for a primary button background.
- **Do** prefer the 4px spacing scale for all gaps and padding. The half-step from 8px grids allows tighter icon-to-label spacing.
- **Don't** use pure black (#000) or pure white (#fff) for backgrounds or text. Always use the warm-tinted equivalents (`--fg`, `--bg`).
- **Don't** exceed 3 shadow levels. The design relies on background brightness stepping more than elevation.
- **Don't** use the primary color for large background areas. It's an accent, not a theme.
- **Don't** go below 11px font size. This is a reading-heavy app — legibility is non-negotiable.
