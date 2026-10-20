---
name: Cadence
description: Precision GitHub shipping telemetry, 3D contribution skylines, and 4-pillar cadence benchmarks.
colors:
  background: "#0b0c0e"
  foreground: "#ece9e2"
  card: "#121417"
  secondary: "#171a1f"
  muted: "#1b1e23"
  muted-foreground: "#96948d"
  accent: "#7ecfa5"
  heat-0: "#1a1d22"
  heat-1: "#193b2f"
  heat-2: "#29664e"
  heat-3: "#439670"
  heat-4: "#8bd4af"
  compare-sky: "#38bdf8"
  tier-apex: "#a7f3d0"
  tier-diamond: "#bae6fd"
  tier-gold: "#ddd6fe"
  neutral-zinc: "#a1a1aa"
typography:
  display:
    fontFamily: "Schibsted Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.028em"
  title:
    fontFamily: "Schibsted Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "Schibsted Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.22
    letterSpacing: "-0.022em"
  subheading:
    fontFamily: "Schibsted Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Schibsted Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.018em"
  body:
    fontFamily: "Schibsted Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  bodySm:
    fontFamily: "Schibsted Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Schibsted Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
  badgeSm:
    fontFamily: "Schibsted Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
  calendarCell:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.7rem"
    fontWeight: 500
    lineHeight: 1.2
  micro:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.2
  nano:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "9px"
    fontWeight: 500
    lineHeight: 1.1
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "18px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
---

# Design System: Cadence

## Overview

**Creative North Star: "The Telemetry Observatory"**

Cadence is an engineering telemetry instrument, not a marketing brochure. Every screen is built for immediate scanability: a restrained dark carbon canvas (`#0b0c0e`) lets the 5-stop botanical jade contribution scale (`#1a1d22` through `#8bd4af`) carry visual energy without competing neon noise.

**Key Characteristics:**
- **Single-family UI authority:** `Schibsted Grotesk` handles page titles, section headers, controls, and prose with crisp optical tracking (`-0.028em` on display headings).
- **Tabular numeric discipline:** `JetBrains Mono` with `tabular-nums` is strictly reserved for metrics, scores, dates, `@handles`, and code snippets—never used as a decorative costume on prose or standard UI labels.
- **Zero AI Slop:** No uppercase kickers/eyebrows above headings, no emoji-stuffed status badges, no thick side-tab accent borders, and no nested cards-in-cards.

## Colors

### Primary
- **Botanical Jade** (`#7ecfa5`): Primary interactive accent, active streak indicator, and top-quartile cadence highlight.

### Neutral
- **Obsidian Carbon** (`#0b0c0e`): Root viewport canvas.
- **Instrument Slate** (`#121417`): Primary surface container (`--color-card`).
- **Recessed Well** (`#171a1f`): Segmented controls, input wells, and subtle row dividers (`--color-secondary`).
- **Warm Alabaster** (`#ece9e2`): Primary ink (`--color-foreground`).
- **Weathered Stone** (`#96948d`): Secondary metadata and supporting labels (`--color-muted-foreground`).

### Named Rules
**The Jade Economy Rule.** Color on the canvas comes from the data (the 5-step contribution heat ramp). Never introduce random Tailwind rainbow utilities (`amber`, `purple`, `emerald`) that clash with the jade heat scale; use `--color-heat-1` through `--color-heat-4` and `--color-accent` (plus `#38bdf8` sky exclusively for the second builder in head-to-head comparisons).

## Typography

**Display & Body Font:** `Schibsted Grotesk` (with system-ui fallback)
**Data & Code Font:** `JetBrains Mono` (with `tabular-nums`)

### Hierarchy
- **Display** (`700`, `1.5rem–2.25rem`, `line-height: 1.15`, `letter-spacing: -0.028em`): Page titles and primary metric callouts.
- **Headline** (`600`, `1rem–1.25rem`, `line-height: 1.3`, `letter-spacing: -0.018em`): Section headings.
- **Body** (`400/500`, `0.875rem–1rem`, `line-height: 1.55`, `max-width: 68ch`): Descriptions and documentation prose.
- **Data / Mono** (`500/600`, `0.75rem`, `tabular-nums`): Contribution counts, Cadence scores, `@handles`, and ISO dates.

### Named Rules
**The No-Kicker Rule.** Never place an uppercase tracked-out eyebrow label above a heading. The heading states the subject directly.
**The Honest Mono Rule.** Use `font-mono` only on numbers, dates, `@handles`, URLs, and code—never on prose sentences or standard button labels.

## Layout

All routes share a unified `max-w-6xl` container (`1152px`) with consistent `AppHeader` navigation at the top, a `16px–24px` vertical section cadence, and responsive 12-column grid alignment.

## Elevation & Depth

Surfaces use a 1px structural rim combined with a soft downward ambient shadow (`0 8px 24px -8px rgba(0, 0, 0, 0.45)`). Avoid nested bordered cards inside cards; use subtle background wells (`bg-secondary/50`) or hairlines (`divide-y divide-border`) inside a parent surface.

## Shapes

- **Primary panels:** `16px` (`rounded-2xl`)
- **Controls, inputs, and buttons:** `10px` (`rounded-lg` / `rounded-xl`)
- **Data pills & tags:** `6px` (`rounded-md`) — compact, structured badges rather than bloated lozenges.

## Do's and Don'ts

### Do:
- **Do** use `AppHeader` across every route so brand placement and navigation never jump.
- **Do** enforce `tabular-nums` on every count, percentage, streak, and rank column.
- **Do** use drawn Lucide icons in a consistent `14px–16px` stroke rather than Unicode emojis.

### Don't:
- **Don't** place kickers or eyebrows above `<h1>` or `<h2>` elements.
- **Don't** nest bordered/shadowed cards three levels deep.
- **Don't** prefix tier or archetype badges with emojis (`💎`, `🏆`, `⚡`, `🚀`).
