# Theme System Introduction

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark registry:watch`.

NextSpark implements a powerful **build-time theme system** that provides complete UI customization without modifying core code, with zero runtime overhead and maximum performance.

## Overview

The theme system allows you to:

- **Customize appearance** - Complete control over colors, typography, spacing, and components
- **Override components** - Replace core components with theme-specific versions
- **Add custom entities** - Define theme-specific data models
- **Provide translations** - Multi-language support per theme
- **Manage assets** - Automatic asset copying and optimization
- **Support dark mode** - Built-in light/dark mode with system preference detection

**Key Features:**
- ✅ **Zero runtime overhead** - All themes compiled at build time
- ✅ **Type-safe** - Full TypeScript support with autocomplete
- ✅ **Hot reload** - Instant updates during development
- ✅ **Registry-based** - Ultra-fast theme loading (zero I/O)
- ✅ **Extensible** - Plugin integration and component overrides
- ✅ **Accessible** - WCAG 2.1 AA compliant

## Architecture

### Build-Time Compilation

The theme system operates at **build time**, not runtime:

```text
Development:
1. Set NEXT_PUBLIC_ACTIVE_THEME environment variable
2. Rebuild registries when the active theme or its configuration changes
3. Run `pnpm dev`
4. Next.js compiles the stylesheet imported by `apps/dev/app/globals.css`
5. Application loads with selected theme

Production:
1. Theme compiled during build process
2. CSS bundled and optimized
3. Assets served from CDN
4. Zero runtime theme switching overhead
```

**Performance Benefits:**
- No JavaScript theme switching logic
- Optimal CSS bundling
- Perfect browser caching
- Minimal bundle size impact

### Theme vs Core

The system maintains a clear separation between **core** and **theme**:

| Aspect | Core | Theme |
|--------|------|-------|
| **Purpose** | Base functionality | Visual customization |
| **Location** | `core/` | `contents/themes/[name]/` |
| **Modification** | Requires code changes | Configuration only |
| **Components** | shadcn/ui primitives | Overrides and customs |
| **Updates** | Can break themes | Independent updates |
| **Scope** | Global system | Specific project |

**Core Responsibilities:**
- Authentication system
- Entity management
- API infrastructure
- Database operations
- Registry system
- Component primitives

**Theme Responsibilities:**
- Visual appearance (colors, fonts, spacing)
- Component styling overrides
- Brand assets (logos, images, fonts)
- Custom page templates
- Theme-specific entities
- Localized translations

## Theme Selection

### Environment Variable

Themes are selected via the `NEXT_PUBLIC_ACTIVE_THEME` environment variable:

```bash
# .env.local
NEXT_PUBLIC_ACTIVE_THEME=default
```

**Available themes:**
- `default` - Reference implementation theme
- Custom themes you create

### Switching Themes

**Method 1: Environment Variable**

```bash
# .env.local
NEXT_PUBLIC_ACTIVE_THEME=my-theme
```

Then rebuild the registries and application:
```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
cd ../.. && pnpm build
```

The monorepo does not define per-theme package scripts. Keep `NEXT_PUBLIC_ACTIVE_THEME` in `apps/dev/.env` aligned with the theme imported by `apps/dev/app/globals.css`.

## Theme Directory Structure

Themes are organized in `contents/themes/[theme-name]/`:

```text
contents/themes/default/
├── config/                 # All configuration files
│   ├── theme.config.ts     # Theme metadata and configuration
│   ├── app.config.ts       # App-level overrides
│   ├── dashboard.config.ts # Dashboard configuration (optional)
│   ├── permissions.config.ts # Permissions (optional)
│   └── billing.config.ts   # Billing/plans (optional)
│
├── styles/                 # CSS files (compiled at build time)
│   ├── globals.css        # CSS variable overrides
│   └── components.css     # Component-specific styles
│
├── public/                 # Assets (auto-copied to public/theme/)
│   ├── brand/             # Logos, favicons, brand assets
│   ├── images/            # Theme images
│   ├── fonts/             # Custom fonts
│   └── docs/              # Documentation images
│
├── entities/               # Theme-specific entities
│   └── [entity]/
│       ├── [entity].config.ts   # Entity configuration (required)
│       ├── [entity].fields.ts   # Field definitions (required)
│       ├── [entity].types.ts    # TypeScript types (required)
│       ├── [entity].service.ts  # Data access service (required)
│       └── messages/            # i18n translations
│
├── messages/               # i18n translations
│   ├── en.json
│   └── es.json
│
├── docs/                   # Theme documentation
│   └── [sections]/
│
├── templates/              # Page templates (optional)
│   └── (public)/
│
└── components/             # Component overrides (optional)
    ├── overrides/
    └── custom/
```

## Build Process

### CSS Compilation

In the monorepo, `apps/dev/app/globals.css` imports the active theme stylesheet directly. Next.js follows that import in development and production; no root `theme:build` script runs first.

```bash
# Verify the checked-in import
grep -F 'themes/default/styles/globals.css' apps/dev/app/globals.css

# Compile it as part of the application
pnpm build
```

Theme metadata is a registry concern. Rebuild registries separately after changing theme configuration:

```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
```

Theme assets served by the monorepo app live under `apps/dev/public/theme/`; `pnpm dev` and `pnpm build` do not copy them.

## Integration with Registry System

Themes are automatically discovered and registered at build time:

```typescript
// Auto-generated: core/lib/registries/theme-registry.ts
export const THEME_REGISTRY = {
  default: {
    name: 'default',
    config: { /* ... */ },
    hasStyles: true,
    hasAssets: true,
    hasMessages: true,
    hasEntities: true,
    // ... metadata
  }
}
```

**Registry Benefits:**
- **Zero I/O** - No file system access at runtime
- **Type-safe** - Full TypeScript inference
- **Fast lookups** - Direct object access
- **Rich metadata** - Know exactly what each theme provides

### Using the Registry

```typescript
import { getTheme, getRegisteredThemes } from '@/core/lib/registries/theme-registry'

// Get active theme configuration
const theme = getTheme('default')

// Get all available themes
const themes = getRegisteredThemes()
```

## Core vs Theme Extensibility

### What Core Provides

**Immutable Foundation:**
- Authentication system
- Entity CRUD operations
- API infrastructure
- Database schema
- Component primitives (shadcn/ui)
- Registry system
- Build tools

**Core never changes based on theme** - This ensures stability and easy updates.

### What Themes Customize

**Visual Layer:**
- Colors (CSS variables)
- Typography
- Spacing and layout
- Component styling
- Dark mode appearance

**Content Layer:**
- Brand assets
- Custom components
- Page templates
- Entity configurations
- Translations

**Themes cannot:**
- Modify core authentication logic
- Change database schema
- Override core API routes
- Break core functionality

## Zero Runtime Overhead

The build-time approach eliminates runtime costs:

**Traditional Runtime Theming:**
```typescript
// ❌ Runtime overhead
const theme = await loadTheme(themeName)  // File I/O
applyTheme(theme)                         // DOM manipulation
recalculateStyles()                       // Layout recalc
```

**Build-Time Theming:**
```typescript
// ✅ Zero runtime cost
import '../../../themes/default/styles/globals.css'  // Imported by apps/dev/app/globals.css
// Theme applied instantly, no JavaScript needed
```

**Performance Comparison:**

| Metric | Runtime | Build-Time |
|--------|---------|------------|
| Initial load | ~200ms | ~5ms |
| Theme switch | ~150ms | 0ms (requires rebuild) |
| Bundle size | +15KB JS | +0KB JS |
| Layout shifts | Possible | None |
| CPU usage | High | Minimal |

## Development Workflow

### Creating a New Project

1. **Clone boilerplate**
2. **Create custom theme** (or use default)
3. **Configure theme** (colors, fonts, assets)
4. **Build the application and imported theme CSS**: `pnpm build`
5. **Start development**: `pnpm dev`

### Iterating on Theme

1. **Edit theme files** (`styles/`, `public/`, `theme.config.ts`)
2. **Let Next.js recompile imported CSS**; rebuild registries separately after configuration changes
3. **Refresh browser** to see updates
4. **Commit theme changes** to version control

### Deploying to Production

1. **Set production theme** in environment
2. **Build application**: `pnpm build`
3. **Theme compiled** during build
4. **Deploy** with optimized assets

## Use Cases

### White-Label SaaS

Create multiple themes for different clients:

```bash
contents/themes/
├── client-a/     # Client A branding
├── client-b/     # Client B branding
└── client-c/     # Client C branding
```

Deploy with different `NEXT_PUBLIC_ACTIVE_THEME` per instance.

### Multi-Brand Products

Maintain separate brands under one codebase:

```bash
contents/themes/
├── brand-pro/      # Professional brand
├── brand-creative/ # Creative brand
└── brand-minimal/  # Minimal brand
```

### Seasonal Themes

Temporary visual changes:

```bash
contents/themes/
├── default/        # Year-round theme
├── holiday/        # Holiday season
└── summer/         # Summer campaign
```

## Key Concepts

### CSS Variables

All theming uses CSS custom properties:

```css
:root {
  --primary: 200 89% 47%;
  --background: 0 0% 100%;
  /* ... */
}

.dark {
  --primary: 200 89% 60%;
  --background: 240 10% 3.9%;
  /* ... */
}
```

Components reference variables:

```tsx
<Button className="bg-primary text-primary-foreground">
  Click Me
</Button>
```

### Component Overrides

Themes can replace core components:

```typescript
// theme.config.ts
components: {
  overrides: {
    '@/core/components/ui/button': () => 
      import('./components/MyButton').then(m => m.MyButton)
  }
}
```

### Asset Management

Theme assets are automatically copied:

```text
contents/themes/my-theme/public/brand/logo.svg
  ↓ (build process)
public/theme/brand/logo.svg
```

Access in components:

```tsx
<Image src="/theme/brand/logo.svg" alt="Logo" />
```

## Getting Started

### Quick Start

1. **Explore default theme**:
   ```bash
   cd contents/themes/default
   ```

2. **Review theme.config.ts**:
   ```typescript
   export const myThemeConfig: ThemeConfig = {
     name: 'default',
     displayName: 'Default Theme',
     // ... configuration
   }
   ```

3. **Customize colors** in `styles/globals.css`:
   ```css
   :root {
     --primary: 200 89% 47%;
     /* ... */
   }
   ```

4. **Build the application and imported theme CSS**:
   ```bash
   pnpm build
   ```

5. **Start development**:
   ```bash
   pnpm dev
   ```

### Next Steps

Now that you understand the theme system architecture, dive deeper into specific topics:

1. **[Theme Structure](./02-theme-structure.md)** - Complete directory structure and file organization
2. **[Theme Configuration](./03-theme-configuration.md)** - Configuring theme metadata and options
3. **[CSS Variables and Styling](./04-css-variables-and-styling.md)** - CSS variable system and styling
4. **[Component Overrides](./05-component-overrides.md)** - Customizing and extending components
5. **[Asset Management](./06-asset-management.md)** - Managing logos, images, fonts
6. **[Dark Mode Support](./07-dark-mode.md)** - Implementing dark mode
7. **[Theme Registry](./08-theme-registry.md)** - Understanding the theme registry
8. **[Creating Custom Themes](./09-creating-custom-themes.md)** - Step-by-step theme creation guide

---

> 💡 **Tip**: The default theme serves as a reference implementation. Start by customizing it rather than creating a theme from scratch.
