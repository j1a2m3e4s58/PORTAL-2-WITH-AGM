# Design Brief

## Direction
Forest Green Governance — Premium dark green theme for institutional trust, designed for board-level AGM operations with clear hierarchy, accessibility, and refined polish.

## Tone
Institutional confidence: professional, restrained, deliberately composed—maximizing operational clarity over decoration, anchored by a vivid botanical green that signals governance and growth.

## Differentiation
Distinctive forest-green palette (not default Tailwind) paired with custom typography (Space Grotesk + DM Sans) and card-stacked layouts with clear elevation and status badging for real-time shareholder tracking.

## Color Palette

| Token             | OKLCH            | Role                              |
| ----------------- | ---------------- | --------------------------------- |
| background        | 0.13 0.018 155   | Deep forest black base             |
| foreground        | 0.93 0.01 155    | Cream text on dark backgrounds    |
| card              | 0.17 0.02 155    | Elevated surface for grouped data |
| primary           | 0.68 0.22 155    | Vivid botanical green—CTAs, active states |
| primary-foreground| 0.98 0.004 155   | High contrast text on green       |
| accent            | 0.72 0.14 85     | Warm gold—secondary actions, highlights |
| destructive       | 0.58 0.22 22     | Strong red for cancel/delete      |
| border            | 0.27 0.02 155    | Subtle green-tinted dividers      |
| chart-1–5         | varies           | Data visualization palette        |

## Typography
- Display: Space Grotesk — modern geometric headers, status labels, dashboard metrics
- Body: DM Sans — form fields, table content, descriptions, accessibility-focused
- Scale: Hero text-4xl md:text-5xl font-bold tracking-tight, H2 text-2xl md:text-3xl font-bold, Label text-sm font-semibold tracking-wider uppercase, Body text-base leading-relaxed

## Elevation & Depth
Card-stacked surfaces with soft shadows (shadow-sm for borders, shadow-md for interactive cards). No glow or neon effects—subtle depth through elevation hierarchy only.

## Structural Zones

| Zone    | Background      | Border              | Notes                                          |
| ------- | --------------- | ------------------- | ---------------------------------------------- |
| Header  | card + border-b | border-primary (1px)| Green-accented top bar for app title/user menu |
| Content | background      | —                   | Alternating card/background for rhythm        |
| Cards   | card            | border-sm           | Grouped data blocks, form containers, metrics |
| Footer  | secondary       | border-t            | Action row or status indicator                |

## Spacing & Rhythm
Spacer base 0.625rem. Sections: 2rem gaps (compact), cards: 1rem padding, list items: 3rem (44px minimum) for touch targets. Alternating bg-card and bg-background for visual rhythm.

## Component Patterns
- Buttons: Rounded (6px base), green primary with white text, 44px+ height for accessibility, gold accent for secondary
- Badges: Pill-shaped, status-specific colors (green=Active, yellow=Pending, red=Cancelled)
- Cards: Rounded corners, soft shadow-md, green border-top accent on primary actions
- Table rows: 44px minimum height, hover bg-muted/10 transition, badge status indicator in first column

## Motion
- Entrance: fade-in 0.3s + slide-up 0.3s for modals, forms, list items
- Hover: transition-smooth (all 0.3s cubic-bezier) on buttons, cards, rows
- Status updates: pulse-subtle animation on badge changes
- Decorative: none—motion is functional only

## Constraints
- No gradients, no glow, no decorative elements
- Minimum tap target: 44px (WCAG AA for touch)
- All colors expressed as OKLCH L C H values (no hex, no rgb)
- One font pair only (Space Grotesk + DM Sans)
- Dark mode is primary; light mode optional in future

## Signature Detail
Vivid forest-green primary color on deep charcoal base—instantly recognizable as premium institutional, not generic SaaS.
