# /how-to:customize-theme

Interactive guide to customize the visual design system in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/tailwind-theming/SKILL.md` - Tailwind CSS v4 theming
- `.claude/skills/shadcn-theming/SKILL.md` - shadcn/ui customization with tweakcn.com
- `.claude/skills/design-system/SKILL.md` - Token mapping

---

## Syntax

```
/how-to:customize-theme
```

---

## Key Concept: Single Source of Truth

```
┌─────────────────────────────────────────────────────────────────┐
│  NUEVA ARQUITECTURA: Theme es la ÚNICA fuente de verdad        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ANTES (problemático):                                         │
│  core/globals.css → theme/globals.css → app/globals.css        │
│                     (override confuso)                         │
│                                                                 │
│  AHORA (simple):                                               │
│  theme/styles/globals.css → app/globals.css (solo @import)     │
│  (TODO aquí)               (no editar)                         │
│                                                                 │
│  BENEFICIOS:                                                    │
│  • UN solo archivo para editar                                 │
│  • Hot reload inmediato                                        │
│  • Sin build destructivo                                       │
│  • Claude sabe exactamente qué editar                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Behavior

1. **Initial Question**: Ask about color source
2. **Generate or Guide**: Based on source, generate or guide manual edit
3. **Validate**: Check theme CSS is complete
4. **Hot Reload**: Changes visible immediately (no build required)

---

## Initial Question

Before starting, Claude asks:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CUSTOMIZE THEME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before we start, where are your design tokens coming from?

[1] tweakcn.com CSS export (Recommended)
    → I'll generate a complete globals.css from the exported CSS

[2] Design mock with Tailwind config (Stitch, UXPilot)
    → I'll extract tokens from the mock and generate globals.css

[3] Brand HEX colors only
    → Give me your primary color and I'll generate a full palette

[4] I want to learn manually first
    → I'll explain the structure step by step
```

---

## Option 1: From tweakcn.com (Recommended)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION 1: Generate from tweakcn.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: Go to tweakcn.com
        → Customize your theme visually
        → Export the CSS

STEP 2: Paste the exported CSS here

I'll convert it to the NextSpark format and update your theme.
```

**Claude's Actions:**
1. Parse the tweakcn CSS
2. Convert to OKLCH if needed
3. Generate complete globals.css
4. Write to `contents/themes/{activeTheme}/styles/globals.css`

---

## Option 2: From Design Mock

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION 2: Generate from Design Mock
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: Provide the mock path
        → Path to HTML/CSS from Stitch, UXPilot, or similar

STEP 2: I'll analyze the mock
        → Extract colors from tailwind.config
        → Map to NextSpark semantic tokens

STEP 3: Generate globals.css
        → Complete with light mode, dark mode, and @theme mapping
```

**Claude's Actions:**
1. Read mock HTML/CSS
2. Extract Tailwind config
3. Create ds-mapping.json
4. Generate complete globals.css

---

## Option 3: From Brand Colors

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION 3: Generate from Brand Colors
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Give me your brand color in HEX format:

Example: #3B82F6 (blue), #10B981 (green), #8B5CF6 (purple)

I'll generate:
• Light mode palette based on your color
• Dark mode with inverted lightness
• All semantic tokens (card, muted, accent, etc.)
• Complete @theme mapping for Tailwind v4
```

**Claude's Actions:**
1. Convert HEX to OKLCH
2. Generate full palette using OKLCH manipulation
3. Create dark mode by inverting lightness
4. Write complete globals.css

---

## Option 4: Manual Tutorial

### Step 1: Understanding the Structure

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 OF 4: Understanding the Structure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Single File to Edit:

contents/themes/{your-theme}/styles/globals.css

This file contains EVERYTHING:
├── @import "tailwindcss"
├── @import core utilities
├── :root (light mode variables)
├── .dark (dark mode variables)
├── @theme (Tailwind v4 mapping)
└── Base styles (* and body)
```

**📋 File Structure:**

```css
/* contents/themes/{theme}/styles/globals.css */

/* =============================================
   IMPORTS
   ============================================= */
@import "tailwindcss";
@import "@nextsparkjs/core/styles/utilities.css";
@import "@nextsparkjs/core/styles/docs.css";
@source "../../../**/*.{js,ts,jsx,tsx}";

/* =============================================
   THEME VARIABLES - LIGHT MODE (OKLCH)
   ============================================= */
:root {
  /* Surface Colors */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* ... more variables ... */
}

/* =============================================
   THEME VARIABLES - DARK MODE
   ============================================= */
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... more variables ... */
}

/* =============================================
   TAILWIND v4 THEME MAPPING
   ============================================= */
@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... more mappings ... */
}

/* =============================================
   BASE STYLES
   ============================================= */
* {
  border-color: var(--border);
}

body {
  background-color: var(--background);
  color: var(--foreground);
}
```

---

### Step 2: Customize Colors

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 4: Customize Colors
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 OKLCH Color Format:

oklch(lightness chroma hue)
     │         │      └── 0-360 (color wheel)
     │         └── 0-0.4 (saturation)
     └── 0-1 (black to white)

Examples:
• Pure white:  oklch(1 0 0)
• Pure black:  oklch(0 0 0)
• Vivid blue:  oklch(0.5 0.2 250)
• Muted gray:  oklch(0.5 0 0)
```

**📋 Semantic Color Groups:**

```css
:root {
  /* ========== SURFACE COLORS ========== */
  --background: oklch(1 0 0);              /* Page background */
  --foreground: oklch(0.145 0 0);          /* Main text */
  --card: oklch(1 0 0);                    /* Card backgrounds */
  --card-foreground: oklch(0.145 0 0);     /* Card text */
  --popover: oklch(1 0 0);                 /* Dropdown backgrounds */
  --popover-foreground: oklch(0.145 0 0);  /* Dropdown text */

  /* ========== INTERACTIVE COLORS ========== */
  --primary: oklch(0.5 0.2 250);           /* Primary actions (buttons) */
  --primary-foreground: oklch(0.985 0 0);  /* Text on primary */
  --secondary: oklch(0.97 0 0);            /* Secondary actions */
  --secondary-foreground: oklch(0.205 0 0);
  --accent: oklch(0.97 0 0);               /* Highlights */
  --accent-foreground: oklch(0.205 0 0);

  /* ========== STATE COLORS ========== */
  --muted: oklch(0.97 0 0);                /* Subtle backgrounds */
  --muted-foreground: oklch(0.556 0 0);    /* Secondary text */
  --destructive: oklch(0.577 0.245 27);    /* Errors, delete */
  --destructive-foreground: oklch(0.985 0 0);

  /* ========== STRUCTURE COLORS ========== */
  --border: oklch(0.922 0 0);              /* Borders */
  --input: oklch(0.922 0 0);               /* Input borders */
  --ring: oklch(0.5 0.2 250);              /* Focus rings */
}
```

---

### Step 3: Dark Mode

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 4: Dark Mode
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dark mode inverts lightness but keeps hue and chroma.

OKLCH makes this easy:
• Light: oklch(0.9 0.02 250)  → Dark: oklch(0.2 0.02 250)
• Just flip the first number!
```

**📋 Dark Mode Pattern:**

```css
.dark {
  /* Backgrounds become dark */
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);

  /* Cards slightly lighter than background */
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);

  /* Primary often stays similar or becomes brighter */
  --primary: oklch(0.6 0.2 250);
  --primary-foreground: oklch(0.145 0 0);

  /* Muted becomes darker gray */
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);

  /* Borders darker */
  --border: oklch(0.269 0 0);
}
```

---

### Step 4: Tailwind v4 Mapping

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 4: Tailwind v4 Mapping
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The @theme block connects CSS variables to Tailwind classes.

--color-primary → enables → bg-primary, text-primary, border-primary
```

**📋 Complete @theme Block:**

```css
@theme {
  /* Main semantic colors */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Chart colors */
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  /* Sidebar colors */
  --color-sidebar: var(--sidebar-background);
  --color-sidebar-background: var(--sidebar-background);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}
```

---

## Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL COMPLETE!

You've learned:
• Single source of truth architecture
• OKLCH color format
• Light and dark mode variables
• Tailwind v4 @theme mapping

📝 REMEMBER:
   Edit ONE file: contents/themes/{theme}/styles/globals.css
   Changes are visible immediately (no build required)

📚 Related tutorials:
   • /how-to:customize-dashboard - Dashboard layout
   • /how-to:create-block - Block styling

🔙 Back to menu: /how-to:start
```

---

## Claude Actions Summary

| Option | Claude Action |
|--------|---------------|
| tweakcn.com CSS | Parse, convert to OKLCH, write globals.css |
| Design Mock | Extract tokens, generate ds-mapping.json, write globals.css |
| Brand HEX | Convert to OKLCH, generate palette, write globals.css |
| Manual | Guide through structure, explain each section |

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:customize-dashboard` | Dashboard customization |
| `/how-to:create-block` | Create styled blocks |
| `/theme:design-system` | Initialize/update design system (if available) |
