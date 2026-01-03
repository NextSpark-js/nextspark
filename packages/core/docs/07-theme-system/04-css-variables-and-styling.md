# CSS Variables and Styling

The theme system uses CSS custom properties (variables) for flexible, runtime-independent styling. This guide covers the CSS variable system, build process, and styling conventions.

## CSS Variable System

### Overview

All theming is based on CSS custom properties defined in `:root`:

```css
:root {
  --primary: 200 89% 47%;
  --background: 0 0% 100%;
  /* ... more variables */
}
```

**Benefits:**
- Instant theme changes (no JavaScript)
- Native browser support
- Easy dark mode implementation
- Type-safe with TypeScript
- No build-time CSS processing needed

### Variable Format

**Critical: HSL Format WITHOUT `hsl()` Wrapper**

```css
/* ✅ CORRECT - HSL values only */
:root {
  --primary: 200 89% 47%;
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
}

/* ❌ WRONG - includes hsl() wrapper */
:root {
  --primary: hsl(200 89% 47%);
  --background: hsl(0 0% 100%);
}

/* ❌ WRONG - OKLCH format (use in theme.config.ts, not CSS) */
:root {
  --primary: oklch(0.7 0.15 200);
}
```

**Why?** Core CSS uses `hsl(var(--primary))`, so variables must be raw HSL values.

### Using Variables in Components

```tsx
// Tailwind classes reference CSS variables
<Button className="bg-primary text-primary-foreground">
  Click Me
</Button>

// Compiled to:
// background-color: hsl(var(--primary))
// color: hsl(var(--primary-foreground))
```

## Color Variables

### Complete Color System

```css
:root {
  /* Background & Foreground */
  --background: 0 0% 100%;           /* White */
  --foreground: 240 10% 3.9%;        /* Near black */
  
  /* Card */
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  
  /* Popover */
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  
  /* Primary */
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  
  /* Secondary */
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  
  /* Muted */
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  
  /* Accent */
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  
  /* Destructive */
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  
  /* Border & Input */
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
  
  /* Chart Colors */
  --chart-1: 12 76% 61%;
  --chart-2: 173 58% 39%;
  --chart-3: 197 37% 24%;
  --chart-4: 43 74% 66%;
  --chart-5: 27 87% 67%;
  
  /* Sidebar */
  --sidebar-background: 0 0% 98%;
  --sidebar-foreground: 240 5.3% 26.1%;
  --sidebar-primary: 240 5.9% 10%;
  --sidebar-primary-foreground: 0 0% 98%;
  --sidebar-accent: 240 4.8% 95.9%;
  --sidebar-accent-foreground: 240 5.9% 10%;
  --sidebar-border: 240 5.9% 90%;
  --sidebar-ring: 240 5.9% 10%;
  
  /* Border Radius */
  --radius: 0.5rem;
}
```

### Color Usage

**In Tailwind Classes:**

```tsx
// Background colors
<div className="bg-primary">Primary Background</div>
<div className="bg-secondary">Secondary Background</div>
<div className="bg-muted">Muted Background</div>

// Text colors
<p className="text-primary">Primary Text</p>
<p className="text-muted-foreground">Muted Text</p>

// Border colors
<div className="border border-border">With Border</div>
```

**In Custom CSS:**

```css
.custom-component {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--border));
}
```

## Dark Mode

### Dark Mode Variables

Define dark mode overrides using the `.dark` class:

```css
.dark {
  /* Background & Foreground */
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  
  /* Card */
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  
  /* Primary */
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  
  /* Secondary */
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  
  /* Muted */
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  
  /* Accent */
  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;
  
  /* Destructive */
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  
  /* Border & Input */
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
  
  /* Chart Colors (adjusted for dark mode) */
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
}
```

### Testing Dark Mode

```tsx
// Component automatically responds to dark mode
<div className="bg-background text-foreground">
  This text adapts to light/dark mode
</div>
```

## Typography Variables

### Font Families

```css
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-serif: 'Georgia', serif;
  --font-mono: 'Fira Code', monospace;
}
```

**Usage:**

```tsx
<p className="font-sans">Sans-serif text</p>
<code className="font-mono">Monospace code</code>
```

### Font Sizes

Use Tailwind's built-in size classes which reference CSS variables:

```tsx
<h1 className="text-4xl">Large Heading</h1>
<p className="text-base">Body Text</p>
<small className="text-sm">Small Text</small>
```

## Spacing Variables

### Border Radius

```css
:root {
  --radius: 0.5rem;
}
```

**Calculated Values:**

```css
border-radius: calc(var(--radius) - 2px);  /* Slightly smaller */
border-radius: var(--radius);               /* Default */
border-radius: calc(var(--radius) + 4px);  /* Slightly larger */
```

**Usage:**

```tsx
<div className="rounded-lg">Rounded corners</div>
<Button className="rounded-md">Rounded button</Button>
```

### Custom Spacing

Add custom spacing in `theme.config.ts`:

```typescript
styles: {
  variables: {
    '--spacing-xs': '0.125rem',
    '--spacing-sm': '0.25rem',
    '--spacing-md': '0.5rem',
    '--spacing-lg': '1rem',
    '--spacing-xl': '1.5rem',
    '--spacing-2xl': '2rem'
  }
}
```

## Build Process

### Build-Theme Script

**Location:** `core/scripts/build/theme.mjs`

**Purpose:** Compiles theme CSS and copies assets at build time.

**Process:**

```text
1. Read NEXT_PUBLIC_ACTIVE_THEME environment variable
   ↓
2. Locate theme directory: contents/themes/[theme]/
   ↓
3. Read CSS files from styles/ directory
   ↓
4. Concatenate globals.css + components.css
   ↓
5. Add header comment with metadata
   ↓
6. Write output to core/theme-styles.css
   ↓
7. Copy backup to .next/theme-generated.css
   ↓
8. Copy assets from public/ to public/theme/
```

### Running the Build

**Manual Build:**

```bash
pnpm theme:build
```

**Development Mode (Auto-rebuild):**

```bash
pnpm dev
# Theme rebuilds automatically on file changes
```

**Production Build:**

```bash
pnpm build
# Theme compiled as part of build process
```

### Output Files

**Generated CSS:**

```text
core/theme-styles.css         # Imported in application
.next/theme-generated.css     # Backup copy
```

**File Contents:**

```css
/*
 * Generated Theme CSS
 * Theme: my-theme
 * Build time: 2024-01-15T10:30:00.000Z
 *
 * This file is auto-generated. Do not edit manually.
 * To modify themes, edit files in contents/themes/my-theme/
 */

/* Content from globals.css */
:root {
  --primary: 200 89% 47%;
  /* ... */
}

.dark {
  --primary: 200 89% 60%;
  /* ... */
}

/* Content from components.css */
.custom-button {
  /* ... */
}
```

## Theme CSS Files

### globals.css

**Location:** `contents/themes/[theme]/styles/globals.css`

**Purpose:** CSS variable overrides for theming.

**Example:**

```css
/**
 * My Theme - Variable Overrides
 * 
 * Only override variables that differ from core theme.
 * Use HSL format without hsl() wrapper.
 */

:root {
  /* Primary color - blue */
  --primary: 200 89% 47%;
  --primary-foreground: 0 0% 98%;
  
  /* Radius - more rounded */
  --radius: 0.75rem;
}

.dark {
  /* Dark mode primary - lighter blue */
  --primary: 200 89% 60%;
}
```

### components.css

**Location:** `contents/themes/[theme]/styles/components.css`

**Purpose:** Component-specific style additions.

**Example:**

```css
/**
 * Component-specific styles
 */

/* Custom button variant */
.btn-gradient {
  @apply bg-gradient-to-r from-primary to-secondary;
  @apply shadow-lg hover:shadow-xl transition-shadow;
  @apply text-primary-foreground font-semibold;
}

/* Custom card hover effect */
.card-hover {
  @apply transition-transform hover:scale-105;
  @apply cursor-pointer;
}

/* Theme-specific utility */
.theme-glow {
  box-shadow: 0 0 20px hsl(var(--primary) / 0.3);
}
```

## Advanced Styling

### Gradient Backgrounds

```css
.gradient-primary {
  background: linear-gradient(
    135deg,
    hsl(var(--primary)) 0%,
    hsl(var(--secondary)) 100%
  );
}
```

**Usage:**

```tsx
<div className="gradient-primary p-8 text-primary-foreground">
  Gradient Background
</div>
```

### Transparent Colors

```css
.overlay {
  background-color: hsl(var(--background) / 0.8);
  backdrop-filter: blur(10px);
}
```

### Animation Variables

```css
:root {
  --animation-duration: 200ms;
  --animation-timing: cubic-bezier(0.4, 0, 0.2, 1);
}

.animated-button {
  transition: all var(--animation-duration) var(--animation-timing);
}
```

## OKLCH Support

While CSS variables use HSL format, you can define colors in OKLCH in `theme.config.ts`:

```typescript
config: {
  colors: {
    primary: 'oklch(0.7090 0.1592 293.5412)',
    secondary: 'oklch(0.9073 0.0530 306.0902)'
  }
}
```

**Build process converts OKLCH to HSL for CSS variables.**

**Benefits:**
- Better color perception
- Smoother gradients
- More vibrant colors
- Wide color gamut support

## Debugging

### Inspecting Variables

**In Browser DevTools:**

```javascript
// Get computed variable value
getComputedStyle(document.documentElement)
  .getPropertyValue('--primary')
// Returns: "200 89% 47%"
```

**In Components:**

```tsx
<div style={{
  backgroundColor: `hsl(var(--primary))`,
  color: `hsl(var(--primary-foreground))`
}}>
  Custom styled div
</div>
```

### Common Issues

**Issue**: Colors not applying

```bash
# Solution 1: Rebuild theme
pnpm theme:build

# Solution 2: Clear Next.js cache
rm -rf .next
pnpm dev
```

**Issue**: Wrong color format

```css
/* ❌ Wrong */
--primary: hsl(200 89% 47%);

/* ✅ Correct */
--primary: 200 89% 47%;
```

## Performance

### CSS Variables vs Preprocessors

| Feature | CSS Variables | SASS/LESS |
|---------|---------------|-----------|
| Runtime changes | ✅ Yes | ❌ No |
| Build time | ⚡ Instant | 🐌 Slow |
| Bundle size | 📦 Minimal | 📦 Larger |
| Browser support | ✅ Modern | ✅ All |
| Dark mode | 🎨 Easy | 🎨 Complex |

### Optimization Tips

1. **Minimize variables** - Only override what's necessary
2. **Use inheritance** - Variables cascade naturally
3. **Avoid duplication** - Reference other variables
4. **Leverage caching** - CSS files cached by browser

## Next Steps

1. **[Component Overrides](./05-component-overrides.md)** - Customize component styling
2. **[Dark Mode Support](./07-dark-mode.md)** - Implement dark mode
3. **[Creating Custom Themes](./09-creating-custom-themes.md)** - Build your theme

---

> 💡 **Tip**: Always use HSL format without `hsl()` wrapper for CSS variables. This is the most common mistake when creating themes.
