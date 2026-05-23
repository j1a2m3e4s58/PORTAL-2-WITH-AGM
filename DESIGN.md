# Design Brief: Bawjiase Staff Portal

## Tone & Purpose
Premium banking portal with refined glassmorphism. Navy/green palette signals trust and stability. Depth through layered transparency, not skeuomorphism. Modern elegance for a rural bank's digital presence.

## Color Palette

| Role | Light | Dark |
|------|-------|------|
| Primary (Navy) | 0.32 0.18 260 | 0.68 0.18 260 |
| Secondary (Green) | 0.28 0.15 140 | 0.58 0.15 140 |
| Accent (Blue) | 0.54 0.11 250 | 0.72 0.11 250 |
| Foreground | 0.18 0.02 250 | 0.92 0.02 250 |
| Background | 0.98 0.01 250 | 0.12 0.01 250 |
| Muted | 0.92 0.01 250 | 0.22 0.01 250 |
| Border | 0.88 0.02 250 | 0.28 0.01 250 |

## Typography
- **Display**: Fraunces serif — distinctive headers, banking authority with personality
- **Body**: DM Sans — clean, professional, excellent readability
- **Mono**: Geist Mono — code/technical content
- **Scale**: 12/14/16/18/20/24/32px with 1.5x–1.8x line height

## Structural Zones

| Zone | Light | Dark |
|------|-------|------|
| Header/Nav | glass-card (0.98/250/20% white border) | glass-card (0.16/250/10% white border) |
| Sidebar | card (0.98/250) | card (0.16/250) |
| Content bg | background (0.98/250) | background (0.12/250) |
| Card layers | glass-card + backdrop-blur-md | glass-card + backdrop-blur-md |
| Elevated cards | glass-card-elevated (0.5 opacity + shadow-lg) | glass-card-elevated (0.7 opacity + shadow-lg) |

## Shape Language
- Card radius: 12px (0.75rem)
- Input radius: 10px
- Buttons: 10px with glass-button utility
- Full radius (24px) for badges/pills

## Component Patterns
- **Cards**: Glass + backdrop-blur-md, white/20 border light mode, white/10 dark mode
- **Buttons**: Primary (navy) with hover state, secondary (green), accent (blue)
- **Inputs**: glass-input utility (semi-transparent with backdrop-blur-sm)
- **Navigation**: Sidebar (responsive to drawer at mobile), top header with logo/theme toggle
- **Notifications**: Toast/snackbar fixed position, stacked vertically
- **Loading**: Skeleton cards using primary/muted colors with pulse animation
- **Empty states**: Centered illustration + descriptive text + CTA button

## Motion & Depth
- Default transition: cubic-bezier(0.4, 0, 0.2, 1) at 0.3s
- Entrance: fade-in + slide-up (combined)
- Hover: 2% scale increase + color shift on interactive elements
- Loading: pulse-slow animation on skeleton cards
- Backdrop blur: 32px for elevated modals, 16px for cards

## Signature Detail
Glassmorphism layer system: light mode uses white/40–50% with white borders; dark mode uses rgba(30,30,40,0.5–0.7) with white/10–15% borders. Every card and interactive element leverages backdrop-blur for depth and modernity. Logo badge (BCB) rendered as circular initials with navy background and white text.

## Constraints
- No raw hex or named colors — all OKLCH via CSS variables
- No arbitrary Tailwind classes — use glass-* utilities or semantic tokens
- Minimum 0.7 lightness difference for AA+ contrast in both modes
- Responsive breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px
- Mobile-first: drawer nav at sm, sidebar at md+

## Responsive Behavior
- **Mobile**: Bottom navigation drawer, full-screen cards, single-column layout
- **Tablet**: Split sidebar (collapsible), two-column grid for stat cards
- **Desktop**: Fixed sidebar, three-column grid for dashboards, hover states
