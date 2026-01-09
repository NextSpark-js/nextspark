---
name: design-system
description: |
  Theme-aware design system analysis and token mapping.
  Covers extracting theme tokens, mapping mock values, and gap analysis.
  CRITICAL: All values are EXAMPLES - always read actual theme globals.css.
allowed-tools: Read, Glob, Grep
version: 1.0.0
---

# Design System Skill

Patterns for analyzing design tokens and mapping between mocks and NextSpark themes.

## Fundamental Principle

**THE DESIGN SYSTEM IS THEME-DEPENDENT.**

All values in this skill are EXAMPLES from the default theme.
You MUST read the actual theme's `globals.css` to get real values.

```bash
# Determine active theme
grep "NEXT_PUBLIC_ACTIVE_THEME" .env .env.local

# Read theme tokens
cat contents/themes/{THEME}/styles/globals.css
```

## Theme Token Locations

```
contents/themes/{THEME}/
├── styles/
│   ├── globals.css      # CSS variables (:root and .dark)
│   └── components.css   # Component-specific styles
├── config/
│   └── theme.config.ts  # Theme metadata
```

## CSS Variable Structure

### Light Mode (:root)

```css
:root {
  /* Surface Colors */
  --background: oklch(1 0 0);           /* Page background */
  --foreground: oklch(0.145 0 0);       /* Primary text */
  --card: oklch(1 0 0);                 /* Card surfaces */
  --card-foreground: oklch(0.145 0 0);  /* Card text */
  --popover: oklch(1 0 0);              /* Dropdowns */
  --popover-foreground: oklch(0.145 0 0);

  /* Interactive Colors */
  --primary: oklch(0.205 0 0);          /* Primary actions */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);         /* Secondary actions */
  --secondary-foreground: oklch(0.205 0 0);
  --accent: oklch(0.97 0 0);            /* Highlights */
  --accent-foreground: oklch(0.205 0 0);

  /* State Colors */
  --muted: oklch(0.97 0 0);             /* Muted backgrounds */
  --muted-foreground: oklch(0.556 0 0); /* Placeholder text */
  --destructive: oklch(0.577 0.245 27); /* Error/danger */
  --destructive-foreground: oklch(1 0 0);

  /* Border & Input */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);             /* Focus rings */

  /* Radius */
  --radius: 0.5rem;
}
```

### Dark Mode (.dark)

```css
.dark {
  --background: oklch(0.145 0 0);       /* Inverted */
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);

  --primary: oklch(0.922 0 0);          /* Adjusted for dark */
  --primary-foreground: oklch(0.205 0 0);

  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);

  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
}
```

## Color Format Conversion

Mocks often use HEX/RGB, themes use OKLCH.

### HEX to OKLCH Mapping

| Mock (HEX) | Approximate OKLCH | Notes |
|------------|-------------------|-------|
| `#ffffff` | `oklch(1 0 0)` | Pure white |
| `#000000` | `oklch(0 0 0)` | Pure black |
| `#137fec` | `oklch(0.55 0.2 250)` | Blue primary |
| `#101922` | `oklch(0.15 0.02 260)` | Dark background |
| `#00d4ff` | `oklch(0.75 0.15 200)` | Cyan accent |

### Similarity Calculation

Compare colors by:
1. **Lightness** (L) - Most important, weight 0.5
2. **Chroma** (C) - Saturation, weight 0.3
3. **Hue** (H) - Color angle, weight 0.2

```
similarity = 1 - (
  0.5 * |L1 - L2| +
  0.3 * |C1 - C2| / maxChroma +
  0.2 * |H1 - H2| / 360
)
```

## Token Categories

### Background Tokens

| Token | Tailwind Class | Usage |
|-------|----------------|-------|
| `--background` | `bg-background` | Page background |
| `--card` | `bg-card` | Card surfaces |
| `--popover` | `bg-popover` | Dropdowns, menus |
| `--muted` | `bg-muted` | Subtle backgrounds |
| `--accent` | `bg-accent` | Hover states |
| `--primary` | `bg-primary` | Primary buttons |
| `--secondary` | `bg-secondary` | Secondary buttons |
| `--destructive` | `bg-destructive` | Error states |

### Foreground Tokens

| Token | Tailwind Class | Usage |
|-------|----------------|-------|
| `--foreground` | `text-foreground` | Primary text |
| `--card-foreground` | `text-card-foreground` | Card text |
| `--muted-foreground` | `text-muted-foreground` | Secondary text |
| `--primary-foreground` | `text-primary-foreground` | On primary bg |
| `--destructive-foreground` | `text-destructive-foreground` | On error bg |

### Border Tokens

| Token | Tailwind Class | Usage |
|-------|----------------|-------|
| `--border` | `border-border` | Default borders |
| `--input` | `border-input` | Input borders |
| `--ring` | `ring-ring` | Focus rings |

## Mapping Process

### Step 1: Extract Mock Tokens

From Tailwind config or inline styles:
```javascript
// From mock's tailwind.config
const mockTokens = {
  colors: {
    primary: '#137fec',
    'bg-dark': '#101922',
    accent: '#00d4ff'
  }
}
```

### Step 2: Read Theme Tokens

```bash
# Extract all CSS variables
grep -E "^\s*--" contents/themes/{theme}/styles/globals.css
```

### Step 3: Create Mapping

For each mock token:
1. Check exact match (hex → hex)
2. Check semantic match (primary → --primary)
3. Calculate color similarity
4. Flag gaps if no good match

### Step 4: Document Gaps

```json
{
  "gaps": [
    {
      "mockValue": "#ff5722",
      "mockUsage": "accent icons",
      "closestToken": "--destructive",
      "similarity": 0.72,
      "recommendation": "USE_CLOSEST or ADD_TOKEN"
    }
  ]
}
```

## Output Format: ds-mapping.json

```json
{
  "theme": "default",
  "themeGlobalsPath": "contents/themes/default/styles/globals.css",
  "analyzedAt": "2025-01-09T12:00:00Z",

  "themeTokens": {
    "colors": {
      "--background": "oklch(1 0 0)",
      "--foreground": "oklch(0.145 0 0)",
      "--primary": "oklch(0.205 0 0)",
      "--secondary": "oklch(0.97 0 0)",
      "--accent": "oklch(0.97 0 0)",
      "--muted": "oklch(0.97 0 0)",
      "--destructive": "oklch(0.577 0.245 27.325)"
    },
    "radius": "0.5rem",
    "fonts": {
      "sans": "var(--font-sans)",
      "mono": "var(--font-mono)"
    }
  },

  "mockTokens": {
    "colors": {
      "primary": "#137fec",
      "background-dark": "#101922",
      "accent": "#00d4ff",
      "text-light": "#ffffff",
      "text-muted": "#94a3b8"
    }
  },

  "colorMapping": [
    {
      "id": "color-1",
      "mockValue": "#137fec",
      "mockName": "primary",
      "mockUsage": ["buttons", "links", "focus rings"],
      "themeToken": "--primary",
      "themeValue": "oklch(0.205 0 0)",
      "tailwindClass": "bg-primary text-primary-foreground",
      "matchType": "semantic",
      "similarity": 0.65,
      "notes": "Theme primary is darker, mock is more vibrant blue"
    },
    {
      "id": "color-2",
      "mockValue": "#101922",
      "mockName": "background-dark",
      "mockUsage": ["hero background", "footer"],
      "themeToken": "--background",
      "themeValue": "oklch(0.145 0 0)",
      "tailwindClass": "bg-background",
      "matchType": "closest",
      "similarity": 0.88,
      "notes": "Use dark mode or bg-gray-900"
    }
  ],

  "typographyMapping": [
    {
      "mockFont": "Inter",
      "themeToken": "--font-sans",
      "tailwindClass": "font-sans",
      "matchType": "exact"
    }
  ],

  "spacingMapping": [
    {
      "mockValue": "24px",
      "tailwindClass": "p-6",
      "matchType": "exact"
    }
  ],

  "radiusMapping": [
    {
      "mockValue": "8px",
      "themeToken": "--radius",
      "themeValue": "0.5rem",
      "tailwindClass": "rounded-lg",
      "matchType": "exact"
    }
  ],

  "gaps": [
    {
      "type": "color",
      "mockValue": "#00d4ff",
      "mockName": "accent",
      "mockUsage": ["terminal prompt", "code highlights"],
      "closestToken": "--primary",
      "similarity": 0.45,
      "recommendations": [
        {
          "option": "A",
          "action": "Use --primary",
          "impact": "Loses cyan accent, uses theme primary"
        },
        {
          "option": "B",
          "action": "Add --accent-cyan to theme",
          "impact": "Requires theme modification"
        },
        {
          "option": "C",
          "action": "Use inline text-[#00d4ff]",
          "impact": "Not recommended, breaks theming"
        }
      ]
    }
  ],

  "summary": {
    "totalMockTokens": 12,
    "mapped": 10,
    "gaps": 2,
    "overallCompatibility": 0.83,
    "recommendation": "PROCEED_WITH_GAPS"
  }
}
```

## Reusability

This skill applies to ANY design-to-code conversion:
- Landing pages (mocks → blocks)
- Email templates (design → HTML)
- PDF templates (design → React-PDF)
- Marketing materials

## Related Skills

- `tailwind-theming` - Detailed Tailwind CSS patterns
- `mock-analysis` - For extracting mock tokens
- `page-builder-blocks` - For applying tokens to blocks
