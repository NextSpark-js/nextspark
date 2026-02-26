---
name: premium-ui-design
description: |
  Premium visual design system rules for web dashboards and mobile apps.
  Covers 4-layer color theory, OKLCH color space, typography system, 8pt grid spacing,
  shadow/gradient discipline, iconography consistency, dark mode rules, corner radius math,
  visual hierarchy, card design, and layout optimization.
  Use this skill when building UI, reviewing visual design, or implementing design tokens.
allowed-tools: Read, Glob, Grep, Edit, Write
version: 1.0.0
---

# Premium UI Design

Technical visual design rules that transform amateur interfaces into production-grade,
enterprise-level products. Applies to BOTH web dashboards and mobile apps.

---

## When to Use This Skill

- Building or reviewing UI components
- Setting up a design system or theme tokens
- Implementing dark mode
- Choosing colors, fonts, or spacing values
- Designing cards, tables, or data visualizations
- Reviewing generated UI for "AI-generated" appearance
- Optimizing visual hierarchy
- Creating professional data dashboards

---

## 1. Four-Layer Color System

**Principle:** Don't use 60-30-10 rigidly. Use a four-layer system for rich, interactive, professional interfaces.

### Layer 1: Neutral Foundation (Backgrounds & Text)

You need MULTIPLE background levels for depth, not just one.

```
BACKGROUND HIERARCHY (Light Mode):
──────────────────────────────────────
Level 0: Page background    → 98% white with subtle blue tint
Level 1: Sidebar/Nav        → 96% white (slightly darker, acts as anchor)
Level 2: Cards/Containers   → Pure white (#FFFFFF)
Level 3: Elevated elements  → Pure white + subtle shadow
──────────────────────────────────────
```

**Text Hierarchy:**

| Role | Light Mode | Dark Mode |
|------|-----------|-----------|
| Title/Heading | 11% white (very dark gray) | 95% white |
| Body text | 15-20% white | 85-90% white |
| Subtext/Caption | 30-40% white | 60-65% white |
| Placeholder | 50-60% white | 40-50% white |

**Border Rules:**
- AVOID thick black borders
- Use subtle borders: 85% white (light mode) / 20% white (dark mode)
- Or use 1px borders with 5-8% opacity of the text color

### Layer 2: Brand Accent Scale (Interactive Elements)

Think of your brand color NOT as one color, but as a **10-level scale** from light to dark:

```
BRAND COLOR RAMP:
──────────────────────────────────────
50   → Very light tint (hover backgrounds, badges)
100  → Light tint (selected row background)
200  → Light (secondary button backgrounds)
300  → Medium-light (links, active states)
400  → Medium (secondary emphasis)
500  → Base (default button color)
600  → Medium-dark (hover on primary button)
700  → Dark (pressed state)
800  → Very dark (high emphasis text)
900  → Near-black (rare, extreme emphasis)
──────────────────────────────────────
```

**Button Hierarchy by Darkness:**

```
MORE IMPORTANT ──────────────────────> LESS IMPORTANT
[Solid Dark]  [Solid Base]  [Outline]  [Ghost/Text]
   900           500          300         200
```

> Rule: "The more important the button, the DARKER it must be" (in light mode)

**Secondary Button Trick (5% Opacity Primary):**

Use your primary color at very low opacity (5-10%) for secondary button backgrounds and subtle card highlights. This creates cohesion without competing with the primary CTA:

```css
/* Secondary button — tinted with primary at 5% */
.btn-secondary {
  background: oklch(var(--primary) / 0.05);
  color: oklch(var(--primary));
}

/* Tailwind: bg-primary/5 text-primary */
```

### Layer 3: Semantic Colors (Status & Meaning)

These are NON-NEGOTIABLE regardless of brand:

| Meaning | Color | Usage |
|---------|-------|-------|
| Destructive/Error | Red | Delete buttons, error messages, form errors |
| Success | Green | Confirmations, completed states, positive deltas |
| Warning | Amber/Orange | Alerts, approaching limits |
| Info | Blue | Informational banners, help text |

> **Design sin:** Using brand color for destructive actions. Red = destructive. Always.

### Layer 4: Data Visualization (OKLCH)

For charts and graphs with PERCEPTUALLY UNIFORM brightness:

```
OKLCH COLOR GENERATION FOR CHARTS:
──────────────────────────────────────
1. Pick a starting hue (e.g., 250° blue)
2. Keep Lightness (L) constant: 0.65
3. Keep Chroma (C) constant: 0.15
4. Rotate Hue by 25-30° for each data series

Example palette:
  oklch(0.65 0.15 250)  → Blue
  oklch(0.65 0.15 280)  → Purple
  oklch(0.65 0.15 310)  → Pink
  oklch(0.65 0.15 340)  → Red
  oklch(0.65 0.15 10)   → Orange
  oklch(0.65 0.15 40)   → Yellow
  oklch(0.65 0.15 70)   → Lime
  oklch(0.65 0.15 100)  → Green
──────────────────────────────────────
```

This ensures ALL chart colors have the SAME perceived brightness (no "screaming" green next to muted blue).

### Focus State Design (Accessibility)

Focus indicators are NOT optional — they're legally required (WCAG 2.2). Every interactive element must show a visible focus ring:

```css
/* Minimum viable focus indicator */
:focus-visible {
  outline: 2px solid oklch(var(--primary));
  outline-offset: 2px;
}

/* Hide on mouse clicks, show on keyboard */
:focus:not(:focus-visible) {
  outline: none;
}
```

**Rules:**
- Outline minimum: 2px solid, 3:1 contrast ratio against surrounding colors
- Use `outline-offset: 2px` to avoid clipping by `overflow: hidden`
- Tailwind: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`
- WCAG 2.2 requires minimum 24x24 CSS pixels target size (44px recommended for mobile)

### Tailwind Shortcut for Tinted Backgrounds

```
Light mode: bg-{color}-50 for background, text-{color}-500 for accent
Dark mode:  bg-{color}-950 for background, text-{color}-300 for accent
```

---

## 2. The 60-30-10 Rule (Simplified)

When in doubt, fall back to this:

| Percentage | Role | Examples |
|-----------|------|---------|
| **60%** | Neutral backgrounds | White, light gray, page background |
| **30%** | Complementary | Dark text, secondary elements, cards |
| **10%** | Brand/Accent | CTAs, alerts, active states, links |

**Key insight:** Replace complex gradients with flat colors that enhance data readability.

---

## 3. Typography System

### Font Size Discipline

**MAXIMUM 4 font sizes + 2 weights in your entire app:**

| Role | Size (example) | Weight |
|------|---------------|--------|
| Page title / Hero | 28-32px | Bold (700) |
| Section heading | 20-24px | Semi-bold (600) |
| Body / Content | 14-16px | Regular (400) |
| Caption / Label | 12-13px | Regular (400) |

> Using more than 4 sizes breaks visual harmony. Fight the urge.

### Line Height (Interlineado)

| Text Role | Line Height | Why |
|-----------|-------------|-----|
| Headings (hero, titles) | 1.1x – 1.3x | Tight = compact, professional feel |
| Body / Content | 1.3x – 1.5x | Loose = readable, scannable |
| Captions / Labels | 1.2x – 1.3x | Compact but still legible |

```css
/* Headings — tight */
.heading { line-height: 1.2; }

/* Body — comfortable reading */
.body { line-height: 1.5; }
```

### Maximum Text Width

Limit body text to a maximum of **600px** (or 50–75 characters per line) to prevent "wall of text" fatigue:

```css
.prose { max-width: 600px; }
/* Or in Tailwind: className="max-w-prose" (65ch ≈ 600px) */
```

> If a paragraph exceeds 75 characters per line, readability drops sharply. The eye loses its place on the next line return.

### Alignment Consistency

**NEVER mix alignments within a section:**

- If the title is centered → the body MUST be centered
- If the body text is more than 3 lines → **always left-align** (centered multi-line is hard to read)
- Buttons under centered text → center the button too

```
BAD:                              GOOD:
┌──────────────────┐              ┌──────────────────┐
│  Title Centered   │              │  Title Centered   │
│ Body text left    │              │  Body text also   │
│ aligned which     │              │  centered when    │
│ looks broken      │              │  short (≤3 lines) │
└──────────────────┘              └──────────────────┘
```

### Monospace for Dynamic Numbers

Use monospaced fonts for ANY number that changes frequently (counters, prices, stats, rewards) to prevent layout "jumping":

```tsx
// BAD: proportional font causes width changes
<span className="text-2xl font-bold">$1,234</span>

// GOOD: monospace tabular numerals prevent jumping
<span className="text-2xl font-bold tabular-nums font-mono">$1,234</span>
// Or with Tailwind: className="tabular-nums"
```

### Fluid Typography with CSS clamp()

Instead of jumping between sizes at breakpoints, use `clamp()` for smooth, continuous font scaling:

```css
/* FLUID TYPE SCALE (mobile 320px → desktop 1200px) */
--text-hero:    clamp(2rem, 1.5rem + 2.5vw, 3.5rem);    /* 32px → 56px */
--text-heading: clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem);  /* 24px → 36px */
--text-body:    clamp(0.875rem, 0.8rem + 0.4vw, 1rem);    /* 14px → 16px */
--text-caption: clamp(0.75rem, 0.7rem + 0.2vw, 0.8125rem); /* 12px → 13px */
```

**The clamp() Formula:** `clamp(MIN, PREFERRED, MAX)`
- `MIN` = smallest the font should be (mobile)
- `PREFERRED` = `rem + vw` (scales with viewport)
- `MAX` = largest the font should be (desktop)

**Accessibility Rule:** The max size must be ≤ 2.5x the min size to pass WCAG SC 1.4.4 (resize text). Example: min 16px, max 40px = 2.5x (passes).

**Fluid Spacing (same principle):**

```css
/* Apply clamp() to spacing too for fully fluid layouts */
--space-section: clamp(2rem, 1.5rem + 3vw, 5rem);   /* 32px → 80px */
--space-card:    clamp(1rem, 0.75rem + 1.5vw, 2rem); /* 16px → 32px */
```

> **Key:** Never use `vw` alone for font-size — it doesn't respond to zoom. Always combine `rem + vw` so that browser zoom still works.

### Large Text Kerning

For text larger than 70-80px, reduce letter-spacing by -2% to -4%:

```css
.hero-title {
  font-size: 80px;
  letter-spacing: -0.03em; /* -3% */
}
```

This prevents large text from looking "disjointed."

---

## 4. Spacing System (8pt Grid)

**All margins, paddings, and sizes must be divisible by 8 (or 4 for small details).**

```
SPACING SCALE:
──────────────────────────────────────
4px   → Micro spacing (icon-to-label gap)
8px   → Small (padding inside compact elements)
16px  → Medium (standard padding, gaps)
24px  → Large (section padding)
32px  → Extra large (major section breaks)
48px  → Hero spacing
64px  → Page-level spacing
──────────────────────────────────────
```

### Grouping Rules (The Relationship Multiplier)

Use **multipliers** based on how related elements are:

- Related elements: 8-16px gap (close = related)
- Between groups: 24-32px gap — **2x base** (separation = different topic)
- Between sections: 48-64px gap — **4x base** (major break)
- Between dashboard sections: **160px+** vertical space for full "breathing room"

> **Rule of Thumb:** If two elements are closely related, give them a base spacing (e.g., 16px). For the next less-related group, **double it** (32px). For major sections, **quadruple it** (64px+).

### Card Padding

A safe default for card internal padding is **32px** (Tailwind `p-8`). This prevents cards from feeling "cramped":

```
CARD PADDING:
┌─────────────────────────────┐
│ ← 32px →                   │
│         Title               │
│         Subtitle            │
│                             │
│         Content area        │
│                             │
│ ← 32px →                   │
└─────────────────────────────┘
```

For compact cards (mobile, dense dashboards), use 16-24px. Never go below 12px.

```
GROUPING EXAMPLE:
┌──────────────────────────┐
│ Section Title             │  ← 48px above
│                           │  ← 16px below title
│ ┌──────────────────────┐ │
│ │ Item 1                │ │  ← 8px between items
│ │ Item 2                │ │     (same group)
│ │ Item 3                │ │
│ └──────────────────────┘ │
│                           │  ← 32px between groups
│ ┌──────────────────────┐ │
│ │ Item A                │ │
│ │ Item B                │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

### Configure Nudge Settings

In design tools, set nudge amount to 8px to enforce consistency.
In code, use Tailwind's spacing scale (which is already 4px-based: `p-1`=4px, `p-2`=8px, `p-4`=16px).

---

## 5. Shadow & Gradient Discipline

### Shadows

- **NEVER use default shadow values** (they're usually too harsh)
- Change shadow COLOR to light gray (not black)
- Increase blur significantly
- Or eliminate shadows entirely if contrast is sufficient

```css
/* BAD: Default harsh shadow */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);

/* GOOD: Subtle professional shadow */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04),
            0 4px 12px rgba(0, 0, 0, 0.06);

/* BETTER: No shadow, use border instead */
border: 1px solid hsl(var(--border));
```

### Tinted Shadows (Background-Matched)

**Never use pure gray/black shadows.** Tint the shadow color to match the background hue for visual harmony:

```css
/* BAD: Generic gray shadow on purple background */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

/* GOOD: Shadow tinted with the background color */
/* If background is purple-ish, shadow should be a darker purple */
box-shadow: 0 4px 12px rgba(120, 80, 160, 0.15);

/* OKLCH approach: same hue as background, lower lightness, low chroma */
box-shadow: 0 4px 12px oklch(0.3 0.05 280 / 0.12);
```

> **Rule:** Look at the background hue → make the shadow a darker, more saturated version of that same hue. This creates seamless visual integration instead of "floating" elements.

### Gradients

- **NEVER mix different colors** (blue → green = amateur)
- **Allowed:** Variations of the SAME color (light green → dark green)
- **Best:** Use flat colors and add visual interest through layout/content instead

```css
/* BAD: Multi-hue gradient */
background: linear-gradient(135deg, #3b82f6, #10b981);

/* GOOD: Single-hue gradient */
background: linear-gradient(135deg, oklch(0.75 0.15 145), oklch(0.55 0.15 145));

/* BEST: Flat color with accent through content */
background: oklch(0.98 0.01 145);
```

---

## 6. Iconography Rules

### Consistency is Everything

| Rule | Description |
|------|-------------|
| **Single library** | Use ONE icon library everywhere (Phosphor, Lucide, Hero Icons) |
| **Single weight** | Choose thin OR regular OR bold — NEVER mix weights |
| **Standard size** | 20-24px for UI icons, 16px for inline icons |
| **No emojis as icons** | Replace emojis with professional icon library icons |

### State Differentiation

Use icon weight changes to indicate selection state:

```
INACTIVE TAB:  ○ [outline icon]   + muted color
ACTIVE TAB:    ● [filled icon]    + brand color + bold label
```

This is MORE effective than just changing the color.

### Icon Selection

- Use universally recognized symbols (magnifying glass = search, house = home)
- If an icon isn't universally known, ADD a text label
- For older or less technical audiences, labels are MANDATORY

---

## 7. Dark Mode Rules

### The Double-Distance Rule

Colors in dark mode look MORE similar to each other. You need MORE contrast:

```
LIGHT MODE: 2% difference between background levels
DARK MODE:  4-6% difference between background levels
```

### Elevation = Lighter (Not Darker)

In dark mode, surfaces that are "elevated" (closer to user) should be LIGHTER:

```
DARK MODE ELEVATION:
──────────────────────────────────────
Level 0: Page bg     → darkest  (e.g., oklch(0.15 0.01 250))
Level 1: Sidebar     → slightly lighter (+4% brightness)
Level 2: Card        → lighter (+6% brightness)
Level 3: Modal/Popup → lightest (+8% brightness)
──────────────────────────────────────
```

### Creating Dark Elevation Steps

Take the base dark color and for each elevation:
- Increase Brightness (B in HSB) by +4 to +6
- Decrease Saturation (S in HSB) by -10 to -20

```css
/* Dark mode elevation */
--bg-base:     oklch(0.15 0.02 250);  /* deepest */
--bg-surface:  oklch(0.19 0.015 250); /* cards */
--bg-elevated: oklch(0.23 0.01 250);  /* modals, popovers */
```

### Never Use Pure Black

Pure `#000000` is harsh on eyes. Use very dark blue-gray or warm dark:

```css
/* BAD */
background: #000000;

/* GOOD: Dark with subtle warmth */
background: oklch(0.14 0.01 260);  /* dark blue-gray */
```

### Brand Color Adjustment

In dark mode, use LIGHTER tints of your brand color (300-400 level instead of 500-600).

### OKLCH Token Swap Technique

Instead of maintaining two separate color palettes, use OKLCH lighting variables that invert in dark mode:

```css
:root {
  --lighting-bg: 0.97;
  --lighting-surface: 0.94;
  --lighting-text: 0.15;
}

@media (prefers-color-scheme: dark) {
  :root {
    --lighting-bg: 0.12;
    --lighting-surface: 0.16;
    --lighting-text: 0.92;
  }
}

/* Single declaration works for both modes */
body { background: oklch(var(--lighting-bg) 0.01 250); }
.card { background: oklch(var(--lighting-surface) 0.01 250); }
.text { color: oklch(var(--lighting-text) 0.01 250); }
```

> This eliminates duplicate stylesheets. One token set, two modes.

### Respect `prefers-reduced-motion`

Users with vestibular disorders set this preference. You MUST respect it:

```css
/* Reduce or remove all motion when requested */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

```tsx
// React: check programmatically
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches

// Framer Motion: automatic respect
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
/>
```

---

## 8. HSB Color Palette Creation (Practical Technique)

When you need to create color variations FROM a base color, use the HSB model (Hue, Saturation, Brightness) instead of guessing hex codes.

### Creating Darker Variations (Shadows)

From your base color:
1. Shift the **Hue** toward blues/purples (colder) for more natural-looking shadows
2. Increase **Saturation** by +15 to +25
3. Decrease **Brightness** by -10 to -20

```
BASE COLOR:     H:120  S:60  B:80  (green)
SHADOW:         H:135  S:80  B:60  (shifted blue, more saturated, darker)
```

### Creating Lighter Variations (Highlights)

From your base color:
1. Shift the **Hue** slightly toward yellows/warm (warmer)
2. Decrease **Saturation** by -20 to -30
3. Increase **Brightness** by +10 to +15

### Creating Accent/Highlighted Elements

For folders, cards, or elements that need to "pop":
- Increase Saturation (S) by +20
- Decrease Brightness (B) by -10

```
BASE:     H:210  S:50  B:90
ACCENT:   H:210  S:70  B:80  (more vivid, slightly darker)
```

> **Key insight:** NEVER generate random hex values. Always derive variations mathematically from your base using HSB shifts.

---

## 9. Corner Radius Math

### Nested Radius Rule

When you have a rounded container inside another rounded container:

```
INNER RADIUS = OUTER RADIUS - PADDING BETWEEN THEM
```

Example: Outer container has 16px radius and 8px padding → Inner element gets 8px radius.

```
┌──────────────────┐  ← outer: border-radius: 16px
│  ┌──────────────┐│  ← inner: border-radius: 8px (16-8=8)
│  │              ││     padding: 8px
│  │              ││
│  └──────────────┘│
└──────────────────┘
```

### iOS Corner Smoothing (Squircle Effect)

Standard CSS `border-radius` creates a circular arc that transitions abruptly. Premium apps use "squircle" smoothing for organic, fluid corners.

**In Figma:** Set "iOS Corner Smoothing" to maximum (100%) on the corner radius settings.

**In CSS/Tailwind:** There's no native squircle, but you can approximate:

```css
/* Standard — abrupt circular arc */
border-radius: 16px;

/* Premium approximation — slightly oversized for optical smoothing */
border-radius: 18px; /* 10-15% larger than mathematical for perception */

/* For React Native: iOS uses continuous corners natively */
/* Android: use borderCurve: 'continuous' (React Native 0.71+) */
```

**In React Native:**
```tsx
<View style={{
  borderRadius: 16,
  borderCurve: 'continuous', // iOS squircle effect
}} />
```

### Consistency Rule

Define ONE set of radius values and use them everywhere:

| Usage | Radius |
|-------|--------|
| Small elements (badges, chips) | 4-6px |
| Buttons, inputs | 8px |
| Cards, containers | 12-16px |
| Modals, large surfaces | 16-24px |

---

## 10. Visual Hierarchy

### Don't Saturate with Effects

- No abuse of gradients, blurs, or excessive shadows
- Opt for simplicity so information (especially charts) is easy to understand
- One effect maximum per element

### Visual Connectivity

Reuse visual patterns across screens so the user connects related information:
- Same dot style for status indicators
- Same color for related data points across different views
- Consistent icon style throughout

### Visual Connectivity (Cross-Screen Coherence)

Reuse the SAME visual patterns across different screens so the user subconsciously connects related information:

- Same dot/circle style for status indicators everywhere (don't use a dot on one screen and a badge on another)
- Same color coding for states (green = active, red = urgent) consistently across ALL views
- Same card layout proportions across different entity types
- If you use a specific animation for "success" in one place, use it everywhere

```
CONNECTIVITY EXAMPLE:
──────────────────────────────────────
Appointments list:  ● green dot = confirmed
Agenda view:        ● green dot = confirmed    ← SAME PATTERN
Client detail:      ● green dot = active       ← SAME PATTERN
Dashboard stat:     ● green dot = online       ← SAME PATTERN
──────────────────────────────────────
```

### Card Optimization

- Move secondary buttons to a "triple dot" menu (...)
- Use simple icons for status instead of text labels
- Leave MORE space for actual data
- Remove unnecessary borders if contrast is sufficient

```
BAD CARD:
┌──────────────────────────────┐
│ Title          [Edit] [Del]  │
│ Status: Active               │
│ Created: Jan 15, 2024        │
│ Description: Lorem ipsum...  │
│ [View] [Share] [Archive]     │
└──────────────────────────────┘

GOOD CARD:
┌──────────────────────────────┐
│ Title               ● Active │  ← dot for status
│ Jan 15              [⋯]     │  ← menu for secondary
│ Lorem ipsum dolor sit amet   │
└──────────────────────────────┘
```

---

## 11. Layout Optimization

### Maximum Container Width

For web dashboards, keep the main content within a **960px** max-width container to ensure comfortable scanning:

```css
.dashboard-content { max-width: 960px; margin: 0 auto; }
/* Tailwind: className="max-w-screen-lg mx-auto" */
```

This prevents content from spreading too wide on large monitors, which makes reading and scanning harder.

### Breaking the Grid (Intentional Overflow)

Follow the grid strictly for most content, but **intentionally break it** for moments of visual surprise:

```
STANDARD GRID:                    GRID-BREAKING ELEMENT:
┌──────────────────────┐          ┌──────────────────────────────→
│ ┌────┐ ┌────┐ ┌────┐│          │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ →
│ │Card│ │Card│ │Card││          │ │    │ │    │ │    │ │    │ → overflows
│ └────┘ └────┘ └────┘│          │ └────┘ └────┘ └────┘ └────┘ →
└──────────────────────┘          └──────────────────────────────→
  Content within container          Horizontal scroll / carousel
                                    extends to screen edge
```

Best candidates for grid-breaking:
- Image carousels / testimonials (overflow right edge)
- Hero sections (full-bleed backgrounds)
- Feature showcases (alternating full-width / contained)

> **Rule:** Breaking the grid is effective ONLY when the rest of the page follows the grid strictly. If everything breaks, nothing surprises.

### Sidebar/Navigation Cleanup

- Don't repeat KPIs on every screen (if user is in Settings, they don't need click counts)
- Group Account, Billing, and Usage into a single popover/menu
- Clean navigation = professional feel

### Modal vs Flyout Decision

| Scenario | Use |
|----------|-----|
| Few fields, simple action | Centered modal |
| Many fields, complex form | Side flyout/panel |
| Quick confirmation | Small centered modal |
| Data browsing + editing | Full-page or split view |

> If a "Create" modal has few fields but lots of space, a CENTERED modal is more appropriate than a sidebar panel. Hide advanced options by default.

### Dashboard Data Visualization

| Instead of... | Use... |
|-------------|--------|
| Plain lists for resource usage | Donut/ring charts |
| Bar charts for geographic data | Heat maps with side data |
| Single data views | Comparison toggles (compare items) |
| Text-only reports | Visual cards with sparklines |

### Responsive Data Tables

Data tables are the hardest UI element to make responsive. Use these patterns:

| Screen Width | Pattern | Implementation |
|-------------|---------|---------------|
| Desktop (1024px+) | Full table with all columns | Standard `<table>` |
| Tablet (768-1023px) | Priority columns (hide low-priority) | `display: none` on secondary columns |
| Mobile (<768px) | Card collapse (each row = card) | CSS Grid or stacked divs |

**Card Collapse Pattern:**

```
DESKTOP TABLE ROW:                MOBILE CARD:
┌────┬────────┬──────┬──────┐    ┌──────────────────────┐
│ ID │ Name   │ Date │ Amt  │    │ Maria Garcia          │
└────┴────────┴──────┴──────┘    │ Jan 15 · $120         │
                                 │ Status: Confirmed ●   │
                                 └──────────────────────┘
```

**Rules:**
- Show 3-4 key fields on mobile card, tap to expand full details
- Fixed/sticky header on desktop tables for long scrolling
- Column headers become inline labels on mobile cards
- Preserve sort/filter controls above the card list

---

## 12. Eliminating "AI-Generated" Look

### Common AI Design Mistakes

| Mistake | Fix |
|---------|-----|
| Emojis as icons | Use Phosphor Icons, Lucide, or Hero Icons |
| Too-bright colors without harmony | Use professional palette, tint backgrounds subtly |
| KPIs repeated everywhere | Show contextual data only |
| All buttons equally prominent | Hierarchy: primary → secondary → ghost |
| Generic stock-looking layouts | Add real product screenshots, actual data patterns |
| Default Figma shadows | Remove or soften dramatically |

### The Presentation Rule

- A good graphic of YOUR OWN interface elevates perceived value more than any icon or illustration
- Use styled screenshots of actual app screens on landing pages
- Presentation IS credibility

---

## 13. Line Elimination

### Replace Lines with Space

```
BAD:                          GOOD:
┌────────────────┐            ┌────────────────┐
│ Row 1          │            │ Row 1          │
│────────────────│            │                │
│ Row 2          │            │ Row 2          │
│────────────────│            │                │
│ Row 3          │            │ Row 3          │
└────────────────┘            └────────────────┘
  Lines everywhere              Space is enough
```

### Alternating Backgrounds

If space is tight, use subtle alternating row backgrounds instead of divider lines:

```css
/* Zebra striping */
tr:nth-child(even) {
  background: hsl(var(--muted) / 0.3);
}
```

---

## 14. Data Chart Legibility (Dashboard)

Don't over-design charts for beauty at the cost of readability.

### Rules

- **Keep vertical axes clear** — readable numbers, proper scale
- **Don't over-round bar charts** — excessive rounding makes it hard to read exact values
- **Simplify backgrounds** — charts should have minimal gridlines (2-3 horizontal lines max)
- **Use OKLCH for chart colors** (see Layer 4) so all series have equal perceived brightness
- **Label directly** — put labels on or near the data, not in a separate legend when possible

```
BAD CHART:                    GOOD CHART:
┌────────────────────┐       ┌────────────────────┐
│   ╭─╮              │       │   ┌─┐              │
│ ╭─╯ ╰─╮  ╭─╮      │       │ ┌─┘ └─┐  ┌─┐      │
│ ╯     ╰──╯ ╰──╮   │       │ ┘     └──┘ └──┐   │
│               ╰─╮  │       │               └─┐  │
│  (no axis, curvy)   │       │  100 ─── 50 ─── 0  │
└────────────────────┘       └────────────────────┘
 Looks pretty but             Clean, precise,
 hard to read values          easy to compare
```

### Dashboard Data Visualization Decision Table

| Data Type | Best Chart | Why |
|-----------|-----------|-----|
| Resource usage (% of total) | Donut/ring chart | Instant comprehension of proportion |
| Trends over time | Line chart (clean) | Shows direction clearly |
| Comparing categories | Horizontal bar chart | Easy to scan with labels |
| Geographic data | Heat map + side numbers | Rich context + precise values |
| Single KPI | Large number + sparkline | Prominent with trend context |
| A vs B comparison | Toggle comparison view | Direct side-by-side insight |

---

## 15. Card Information Grouping

When designing cards with multiple data points, GROUP related information together and ORDER by importance.

### Grouping Rule

```
CARD GROUPING:
┌──────────────────────────────┐
│ [Avatar]  Name + Location    │ ← Group 1: Identity
│           ★ 4.8 rating       │
│                              │
│ $120/night    2 beds         │ ← Group 2: Key decision data
│                              │
│ Jan 15 - Jan 20  [⋯]        │ ← Group 3: Secondary details
└──────────────────────────────┘
```

### Hierarchy Rules

1. **Most relevant = larger + higher position** (name, main image, price)
2. **Supporting info = normal size** (rating, distance, category)
3. **Least important = smaller + bottom** (dates, IDs, metadata)
4. **Remove labels when context is clear** — if a card is in the "Hotels" section, you don't need a "Hotel:" label

### Prioritize Values Over Labels (Data Cards)

In metric/stat cards, the **number/value must dominate** — not the label:

```
BAD:                              GOOD:
┌──────────────┐                  ┌──────────────┐
│ Total Sales  │ ← label big      │ Total Sales  │ ← label small, muted
│ 591          │ ← number small    │ 591          │ ← number BIG, bold
│ +12% ↑       │                  │ +12% ↑       │ ← semantic green
└──────────────┘                  └──────────────┘
```

```tsx
// Implementation
<div>
  <span className="text-xs text-muted-foreground">Total Sales</span>
  <span className="text-3xl font-bold tabular-nums">591</span>
  <span className="text-sm text-green-500">+12%</span>
</div>
```

---

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|-------------|-------------|-----|
| Pure black (#000) backgrounds | Harsh on eyes | Use dark blue-gray (oklch) |
| Multi-hue gradients (blue→green) | Amateur look | Same-hue gradient or flat color |
| More than 4 font sizes | Breaks harmony | Limit to 4 sizes + 2 weights |
| Default tool shadows | Too harsh | Soften color + increase blur |
| Random spacing values | Messy feel | 8pt grid system |
| Mixed icon libraries | Inconsistency | Single library, single weight |
| Emojis as UI icons | Unprofessional | Professional icon library |
| Same radius everywhere | Ignores nested math | Outer - padding = inner |
| Equal button prominence | No hierarchy | Primary → secondary → ghost |
| Lines between every row | Visual clutter | Space or alternating backgrounds |
| Body text wider than 600px | Wall of text, eye loses line | max-width: 600px or max-w-prose |
| Mixed text alignments | Feels broken, disjointed | Center or left-align consistently |
| Gray/black shadows on colored bg | Shadows "float" unnaturally | Tint shadows with background hue |
| Label bigger than value in stat cards | Buries the important data | Value 3x larger than label |
| No max-width on dashboard content | Content too spread on wide screens | max-width: 960px |
| No visible focus indicator | Keyboard users can't navigate | 2px outline + offset, 3:1 contrast |
| Full table on mobile | Impossible to read, horizontal scroll | Card collapse or priority columns |
| Ignoring prefers-reduced-motion | Vestibular disorder users get sick | Disable animations when requested |
| Duplicate dark/light stylesheets | Maintenance nightmare | OKLCH token swap (single source) |
| Font sizes jump at breakpoints | Jarring, unprofessional | Fluid typography with clamp() |
| Using vw alone for font-size | Breaks zoom accessibility | Always combine rem + vw in clamp() |

---

## Checklist

Before shipping ANY UI:

- [ ] Background has 3-4 depth levels (not flat single color)?
- [ ] Text follows 3-level hierarchy (heading/body/caption)?
- [ ] Brand color has a 10-level ramp (not single color)?
- [ ] Semantic colors are correct (red=destructive, green=success)?
- [ ] Maximum 4 font sizes used across the entire app?
- [ ] All spacing divisible by 8 (or 4 for micro)?
- [ ] Shadows are subtle (not default harsh values)?
- [ ] No multi-hue gradients?
- [ ] Icons from single library with consistent weight?
- [ ] No emojis used as functional icons?
- [ ] Dark mode uses double-distance between background levels?
- [ ] Dark mode elevation goes LIGHTER (not darker)?
- [ ] Nested border radius follows the subtraction rule?
- [ ] Dynamic numbers use monospace/tabular-nums?
- [ ] Large text (70px+) has negative letter-spacing?
- [ ] Lines replaced with spacing or alternating backgrounds?
- [ ] Chart colors use OKLCH for perceptual uniformity?
- [ ] Line height: 1.1-1.3x for headings, 1.3-1.5x for body text?
- [ ] Body text max-width: 600px (50-75 chars per line)?
- [ ] Text alignment consistent within each section (no mixing)?
- [ ] Shadows tinted with background hue (no pure gray/black shadows)?
- [ ] Stat cards: value dominates, label is small/muted?
- [ ] Dashboard content within max-width container (~960px)?
- [ ] Card padding at least 32px (or 16-24px on compact/mobile)?
- [ ] Focus indicators visible on all interactive elements (2px, 3:1 contrast)?
- [ ] `prefers-reduced-motion` respected (animations disabled/reduced)?
- [ ] Data tables collapse to cards on mobile (<768px)?
- [ ] OKLCH tokens used for dark mode swap (not duplicate stylesheets)?
- [ ] Fluid typography with clamp() (no breakpoint jumps)?
- [ ] Font clamp() uses rem+vw (not vw alone) for zoom accessibility?

---

## Theming (Multi-Theme Support)

To create color variations (red theme, blue theme, green theme):

1. Use OKLCH as the color space
2. Convert neutral grays to subtle tints by adjusting Hue to match the theme color
3. Keep Lightness and Chroma systematic across all tints

```css
/* Blue theme neutrals */
--bg: oklch(0.98 0.005 250);
--surface: oklch(0.96 0.005 250);

/* Green theme neutrals */
--bg: oklch(0.98 0.005 145);
--surface: oklch(0.96 0.005 145);
```

---

## Related Skills

- `premium-ux-patterns` - UX psychology and behavioral patterns
- `mobile-ux-design` - Mobile-specific design patterns
- `frontend-design` - Implementation patterns (code)
- `shadcn-theming` - shadcn/ui CSS variable system
- `tailwind-theming` - Tailwind CSS theming
- `design-system` - Design token mapping
