---
version: alpha
name: Project 54 Training Manual
description: The faithful visual system of the REFRESH training-manual template — a restrained, print-first document design for Project 54 training manuals.
colors:
  primary: "#A6A096"
  on-primary: "#FFFFFF"
  surface: "#FFFFFF"
  surface-subtle: "#FAF8F3"
  on-surface: "#000000"
  on-surface-muted: "#555555"
  bar: "#000000"
  on-bar: "#FFFFFF"
  accent: "#1F3864"
  accent-muted: "#9EA5B0"
  know: "#D6E4F0"
  do: "#C4D4BE"
  become: "#F4E5C8"
  highlight: "#DBCCA6"
  border: "#EAEAEA"
typography:
  display:
    fontFamily: Helvetica, Arial, sans-serif
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.01em
  display-sub:
    fontFamily: Helvetica, Arial, sans-serif
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: 0em
  session-title:
    fontFamily: Helvetica, Arial, sans-serif
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: 0em
  section-header:
    fontFamily: Helvetica, Arial, sans-serif
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.04em
  callout-header:
    fontFamily: Helvetica, Arial, sans-serif
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.06em
  label:
    fontFamily: Helvetica, Arial, sans-serif
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0em
  body:
    fontFamily: Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  caption:
    fontFamily: Helvetica, Arial, sans-serif
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0em
  eyebrow:
    fontFamily: Helvetica, Arial, sans-serif
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.15em
rounded:
  none: 0px
  sm: 2px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  page: 48px
components:
  cover-band:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-surface}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
    padding: "{spacing.xl}"
  session-band:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.session-title}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  section-tag:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.on-bar}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.none}"
    padding: "{spacing.sm}"
  section-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.section-header}"
    rounded: "{rounded.none}"
    padding: "{spacing.xs}"
  callout-bar:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.on-bar}"
    typography: "{typography.callout-header}"
    rounded: "{rounded.none}"
    padding: "{spacing.sm}"
  callout-box:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  outcome-know:
    backgroundColor: "{colors.know}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  outcome-do:
    backgroundColor: "{colors.do}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  outcome-become:
    backgroundColor: "{colors.become}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  goal-callout:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  framework-step:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  activity-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  overview-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "{spacing.xs}"
---

# Project 54 Training Manual Design System

## Overview

This is the faithful visual system of the REFRESH training-manual template — the layout, colour, and type of a real Project 54 discipleship manual, captured so every future manual looks like it belongs to the same family. It is a **print-first working document**, not a marketing piece: field facilitators across Africa read it, teach from it, and photocopy it. The system should feel **clear, grounded, and reproducible** — calm enough to teach from at a glance, plain enough to survive a black-and-white copier. The single governing rule is fidelity: *do not drift from the template.* The one intentional splash of colour is pedagogical, not decorative — the KNOW / DO / BECOME learning triad.

## Colors

The palette is deliberately restrained and earthy so nothing competes with the teaching content. `primary` (#A6A096) is the warm taupe that carries the cover wordmark and every session band — the single brand surface. `bar` (#000000) is the hard black used for section tags and callout bars; `surface` is white, `on-surface` black body text, and `on-surface-muted` (#555555) the grey used for subtitles and themes. `accent` (#1F3864) is a navy reserved for small emphasis, with `accent-muted` (#9EA5B0) for its hairline borders. The three learning-outcome colours — `know` (#D6E4F0 blue), `do` (#C4D4BE green), `become` (#F4E5C8 tan) — are a fixed triad that always appear together and always carry their text label, so meaning never depends on colour alone. `highlight` (#DBCCA6) is the muted gold border of the transformation-goal box, and `border` (#EAEAEA) is the hairline grey on cards. Black text on white and on all three pastel blocks clears WCAG AA comfortably; the pastels are never used behind small light text.

## Typography

One typeface does everything: **Helvetica**, falling back to Arial and the system sans. It is neutral, universally available, and prints reliably on any device — critical for mixed-literacy, low-resource contexts. Weight and case carry the hierarchy, not extra fonts. `display` and `display-sub` are the heavy cover wordmark and subtitle; `session-title` is the white name on the taupe session band; `section-header` sets the uppercase section titles (TRAINING OVERVIEW, LEARNING OUTCOMES) with slight tracking; `callout-header` is the small white uppercase label on black bars. `label` is the bold KNOW/DO/BECOME headings, `body` the 14px reading text at 1.5 line-height, `caption` the grey subtitle/theme text, and `eyebrow` the wide-tracked uppercase run for SESSION N and the cover descriptors. Never introduce a second family, and never a decorative, script, or display face — legibility for oral and mixed-literacy learners comes first.

## Layout

The page breathes: generous margins (`page` 48px) and a calm, one-idea-per-block rhythm where each section stands alone with clear air around it. Content flows in a single column, except the Learning Outcomes triad, which sits as three equal side-by-side blocks. Spacing follows a simple 4/8/12/16/24/32 scale — `md` (12px) is the default padding inside boxes and callouts, `lg`–`2xl` separate major sections. Nothing is crowded and nothing is centred except the cover; the eye always knows where the next block begins.

## Elevation & Depth

The system is **flat**. There are no drop shadows anywhere. Depth and separation come entirely from solid fills (taupe bands, black bars, pastel blocks) and single hairline `border` (#EAEAEA) lines around cards. This is a deliberate print choice: shadows muddy on photocopiers and add visual noise a teaching document does not need. Contrast, not elevation, does the work.

## Shapes

Corners are near-sharp. Structural elements — cover band, session band, black tags and bars, and the KNOW/DO/BECOME blocks — use `rounded.none` (0px) for a solid, architectural feel. Content containers that hold reading matter — activity cards, the transformation-goal callout, framework steps — soften to `rounded.sm` (2px), just enough to read as a contained card without looking rounded. Radius never exceeds 2px.

## Components

Every manual is assembled from a small, fixed kit. **cover-band** is the taupe block holding the black wordmark on the title page. **session-band** is the taupe bar with the white session name; a **section-tag** (black bar, wide-tracked white "SESSION N") sits directly above it. **section-header** is an uppercase title marking a major section. Callouts come in two stacked parts: a **callout-bar** (black header strip, e.g. "PURPOSE — Why This Session Exists") over a **callout-box** (the white body beneath it). The Learning Outcomes triad is three equal blocks — **outcome-know**, **outcome-do**, **outcome-become** — each filled with its pastel and led by a bold `label` heading. **goal-callout** is the gold-bordered transformation-goal box. **framework-step** pairs a solid black number square with a step title and bullets. **activity-card** is a hairline-bordered card of stacked rows (Goal, Type, Materials, Instructions, Facilitator Notes, Teaching Point). **overview-row** is a simple bold-label / plain-value line used in the Training Overview. Components are used exactly as the template uses them — same order, same styling, every time.

## Do's and Don'ts

**Do:**
- Use only Helvetica/Arial — the template font — at every size and weight.
- Keep the exact taupe/black/white palette and the KNOW/DO/BECOME triad as sampled.
- Always pair each learning-outcome colour with its text label so it reads in black-and-white.
- Preserve the calm, one-idea-per-block layout with generous margins.
- Keep surfaces flat: solid fills and hairline borders, never shadows.

**Don't:**
- Don't swap, mix, or add typefaces — no script, handwriting, or trendy display fonts.
- Don't recolour or restyle away from the sampled template palette.
- Don't rely on colour alone to convey meaning (it must survive a B&W copier).
- Don't crowd the page or stack blocks without breathing room.
- Don't add drop shadows, gradients, or rounded corners beyond 2px.
- Don't drift from the template layout — same components, same order, every manual.
