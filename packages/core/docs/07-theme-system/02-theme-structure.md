# Theme Structure

This guide provides a complete reference for the theme directory structure, explaining the purpose of each file and directory, and how they work together to create a cohesive theme.

## Complete Directory Structure

```text
contents/themes/[theme-name]/
├── config/                      # All configuration files
│   ├── theme.config.ts         # Theme metadata and configuration
│   ├── app.config.ts           # Application-level overrides
│   ├── dashboard.config.ts     # Dashboard configuration (optional)
│   ├── permissions.config.ts   # Permissions configuration (optional)
│   └── billing.config.ts       # Billing/plans configuration (optional)
│
├── styles/                      # CSS files (compiled at build time)
│   ├── globals.css             # CSS variable overrides
│   └── components.css          # Component-specific styles
│
├── public/                      # Theme assets (auto-copied)
│   ├── brand/                  # Brand assets
│   │   ├── logo.svg           # Primary logo
│   │   ├── logo-dark.svg      # Dark mode logo
│   │   ├── logo-text.svg      # Logo with text
│   │   ├── favicon.ico        # Favicon
│   │   └── apple-touch-icon.png
│   │
│   ├── images/                 # General theme images
│   │   ├── hero-bg.jpg
│   │   ├── feature-1.png
│   │   └── ...
│   │
│   ├── fonts/                  # Custom fonts
│   │   ├── custom-font.woff2
│   │   ├── custom-font.woff
│   │   └── custom-font-license.txt
│   │
│   └── docs/                   # Documentation images
│       ├── screenshot-1.png
│       └── architecture-diagram.svg
│
├── entities/                    # Theme-specific entities
│   └── [entity-name]/
│       ├── [entity].config.ts # Entity configuration
│       ├── [entity].fields.ts # Field definitions
│       ├── [entity].types.ts  # TypeScript types for the entity
│       ├── [entity].service.ts # Data access service
│       ├── messages/           # Entity translations
│       │   ├── en.json
│       │   └── es.json
│       ├── migrations/         # Entity migrations (optional)
│       │   └── 001_create_table.sql
│       └── components/         # Custom UI components (optional)
│           └── [Entity]Header.tsx
│
├── messages/                    # Theme-wide translations
│   ├── en.json                 # English translations
│   ├── es.json                 # Spanish translations
│   └── [locale].json           # Additional locales
│
├── docs/                        # Theme documentation
│   ├── 01-overview/
│   │   ├── 01-introduction.md
│   │   └── 02-customization.md
│   └── 02-features/
│       ├── 01-components.md
│       └── 02-styling.md
│
├── templates/                   # Page templates (optional)
│   └── (public)/               # Public route templates
│       ├── layout.tsx          # Custom layout
│       ├── page.tsx            # Home page
│       ├── features/
│       │   └── page.tsx
│       ├── pricing/
│       │   └── page.tsx
│       └── support/
│           └── page.tsx
│
└── components/                  # Component overrides (optional)
    ├── overrides/              # Core component replacements
    │   ├── Button.tsx
    │   └── Card.tsx
    └── custom/                 # Theme-specific components
        ├── CustomHeader.tsx
        └── CustomFooter.tsx
```

## Core Files

### theme.config.ts

**Purpose:** Primary theme configuration file defining metadata, styles, colors, and component overrides.

**Required:** Yes

**Example:**

```typescript
import type { ThemeConfig } from '@/core/types/theme'

export const myThemeConfig: ThemeConfig = {
  name: 'my-theme',
  displayName: 'My Custom Theme',
  version: '1.0.0',
  description: 'A beautiful custom theme',
  author: 'Your Name',
  
  plugins: ['ai'],  // Plugins used by this theme
  
  styles: {
    globals: 'globals.css',
    components: 'components.css',
    variables: {
      '--spacing-lg': '1rem'
    }
  },
  
  config: {
    colors: {
      primary: 'oklch(0.7090 0.1592 293.5412)',
      // ... more colors
    },
    fonts: {
      sans: 'Inter, sans-serif'
    }
  },
  
  components: {
    overrides: {
      // Component overrides
    },
    custom: {
      // Custom components
    }
  }
}

export default myThemeConfig
```

**Key Properties:**

| Property | Type | Purpose |
|----------|------|---------|
| `name` | string | Theme identifier (used in env variable) |
| `displayName` | string | Human-readable name |
| `version` | string | Semantic version |
| `plugins` | string[] | Required plugins |
| `styles` | object | CSS file references |
| `config` | object | Theme-specific configuration |
| `components` | object | Component overrides |

### app.config.ts

**Purpose:** Override core application configuration values for this theme.

**Required:** No

**Example:**

```typescript
export const APP_CONFIG_OVERRIDES = {
  app: {
    name: 'My Custom SaaS',
    version: '2.0.0',
  },
  
  i18n: {
    supportedLocales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
  },
  
  features: {
    enableBlog: true,
    enableDocs: true,
    enableApiKeys: true,
  },
  
  dashboard: {
    sidebarPosition: 'left',
    showBreadcrumbs: true,
  }
}
```

**Use Cases:**
- Change app name and branding
- Enable/disable features per theme
- Customize navigation structure
- Override default locales

### dashboard.config.ts

**Purpose:** Dashboard-specific configuration for navigation, layout, and features.

**Required:** No

**Example:**

```typescript
export const DASHBOARD_CONFIG_OVERRIDES = {
  navigation: {
    primary: [
      { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
      { label: 'Projects', path: '/dashboard/projects', icon: 'FolderOpen' },
    ]
  },
  
  layout: {
    sidebarCollapsible: true,
    showUserMenu: true,
  },
  
  features: {
    showQuickActions: true,
    enableNotifications: true,
  }
}
```

## Styles Directory

### globals.css

**Purpose:** CSS variable overrides for theming.

**Required:** Yes (if customizing colors)

**Format Requirements:**
- HSL format WITHOUT `hsl()` wrapper
- Variables must match core variable names
- Supports light and dark mode (`.dark` class)

**Example:**

```css
/**
 * My Theme - Variable Overrides
 */

:root {
  /* Background & Foreground */
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  
  /* Primary Colors */
  --primary: 200 89% 47%;
  --primary-foreground: 0 0% 98%;
  
  /* Secondary Colors */
  --secondary: 200 18% 94%;
  --secondary-foreground: 200 18% 11%;
  
  /* Muted */
  --muted: 200 18% 94%;
  --muted-foreground: 200 8% 46%;
  
  /* Borders */
  --border: 200 18% 87%;
  --input: 200 18% 87%;
  --ring: 200 89% 47%;
  
  /* Border Radius */
  --radius: 0.5rem;
}

.dark {
  /* Dark mode overrides */
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  
  --primary: 200 89% 60%;
  --primary-foreground: 240 5.9% 10%;
  
  /* ... more dark mode variables */
}
```

**Critical Notes:**
- ✅ `--primary: 200 89% 47%` (Correct - HSL values only)
- ❌ `--primary: hsl(200 89% 47%)` (Wrong - includes wrapper)
- ❌ `--primary: oklch(0.7 0.15 200)` (Wrong - different format)

### components.css

**Purpose:** Component-specific style additions or overrides.

**Required:** No

**Example:**

```css
/**
 * Component-specific styles
 */

/* Custom button styles */
.btn-theme-special {
  @apply bg-gradient-to-r from-primary to-secondary;
  @apply shadow-lg hover:shadow-xl transition-shadow;
}

/* Custom card hover effect */
.card-theme-hover {
  @apply transition-transform hover:scale-105;
}

/* Theme-specific utilities */
.theme-gradient {
  background: linear-gradient(
    135deg,
    hsl(var(--primary)) 0%,
    hsl(var(--secondary)) 100%
  );
}
```

## Public Directory

Theme assets are automatically copied from `contents/themes/[theme]/public/` to `public/theme/` during the build process.

### brand/

**Purpose:** Brand identity assets

**Common Files:**
- `logo.svg` - Primary logo (light mode)
- `logo-dark.svg` - Dark mode logo
- `logo-text.svg` - Logo with text
- `logo-icon.svg` - Icon only
- `favicon.ico` - Browser favicon (32x32 ICO)
- `favicon.svg` - Modern SVG favicon
- `apple-touch-icon.png` - iOS home screen icon (180x180)
- `og-image.png` - Social media preview (1200x630)

**Usage:**

```tsx
import Image from 'next/image'

<Image 
  src="/theme/brand/logo.svg" 
  alt="Logo" 
  width={120} 
  height={40}
/>
```

### images/

**Purpose:** General theme images (hero backgrounds, features, etc.)

**Organization:**
- `hero-bg.jpg` - Hero section background
- `feature-1.png` - Feature illustrations
- `testimonial-avatars/` - User photos
- `patterns/` - Background patterns

**Usage:**

```tsx
<div 
  className="hero" 
  style={{ backgroundImage: 'url(/theme/images/hero-bg.jpg)' }}
>
  {/* Content */}
</div>
```

### fonts/

**Purpose:** Custom web fonts

**Files:**
- `[font-name].woff2` - Modern font format (best compression)
- `[font-name].woff` - Fallback format
- `[font-name]-license.txt` - Font license

**Loading fonts:**

```css
/* In styles/globals.css or components.css */
@font-face {
  font-family: 'My Custom Font';
  src: url('/theme/fonts/my-font.woff2') format('woff2'),
       url('/theme/fonts/my-font.woff') format('woff');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

**Reference in theme.config.ts:**

```typescript
config: {
  fonts: {
    sans: 'My Custom Font, system-ui, sans-serif',
    mono: 'Fira Code, monospace'
  }
}
```

### docs/

**Purpose:** Documentation images and diagrams

**Common Files:**
- Screenshots
- Architecture diagrams
- Feature demonstrations
- Tutorial images

**Usage in markdown:**

```markdown
![Architecture Diagram](/theme/docs/architecture.svg)
```

## Entities Directory

Theme-specific entities that extend the core entity system.

### Structure

```text
entities/
└── tasks/
    ├── tasks.config.ts      # Entity configuration
    ├── tasks.fields.ts      # Field definitions
    ├── tasks.types.ts       # TypeScript types
    ├── tasks.service.ts     # Data access service
    ├── messages/             # Entity translations
    │   ├── en.json
    │   └── es.json
    ├── migrations/           # Database migrations (optional)
    │   ├── 001_tasks_table.sql
    │   └── 002_task_metas.sql
    └── components/           # Custom UI components (optional)
        └── TaskHeader.tsx
```

### Required Files

| File | Purpose |
|------|---------|
| `[entity].config.ts` | Entity configuration (slug, access, ui, permissions) |
| `[entity].fields.ts` | Field definitions (name, type, display, api) |
| `[entity].types.ts` | TypeScript interfaces for the entity |
| `[entity].service.ts` | Data access methods with RLS support |
| `messages/` | Internationalization files |

### Example: tasks.config.ts

```typescript
import type { EntityConfig } from '@/core/lib/entities/types'
import { tasksFields } from './tasks.fields'

export const tasksConfig: EntityConfig = {
  name: 'tasks',
  displayName: 'Tasks',
  tableName: 'tasks',
  fields: tasksFields,
  permissions: {
    read: ['admin', 'colaborator', 'member'],
    create: ['admin', 'colaborator', 'member'],
    update: ['admin', 'colaborator'],
    delete: ['admin']
  },
  ui: {
    icon: 'CheckSquare',
    color: 'blue'
  }
}
```

## Messages Directory

Theme-wide translation files for internationalization.

### Structure

```text
messages/
├── en.json       # English
├── es.json       # Spanish
├── fr.json       # French
└── de.json       # German
```

### Example: en.json

```json
{
  "common": {
    "welcome": "Welcome to {appName}",
    "signIn": "Sign In",
    "signOut": "Sign Out"
  },
  "dashboard": {
    "title": "Dashboard",
    "overview": "Overview",
    "stats": "Statistics"
  },
  "features": {
    "title": "Features",
    "subtitle": "Everything you need to succeed"
  }
}
```

**Usage:**

```tsx
import { useTranslations } from 'next-intl'

function Component() {
  const t = useTranslations('common')
  
  return <h1>{t('welcome', { appName: 'My SaaS' })}</h1>
}
```

## Docs Directory

Theme-specific documentation.

### Organization

```text
docs/
├── 01-overview/
│   ├── 01-introduction.md
│   └── 02-customization.md
├── 02-features/
│   ├── 01-components.md
│   └── 02-styling.md
└── 03-guides/
    ├── 01-deployment.md
    └── 02-maintenance.md
```

**Frontmatter:**

```markdown
---
title: Getting Started
description: Quick start guide for the theme
order: 1
---

# Getting Started

Content here...
```

## Templates Directory

Custom page templates that override core routes.

### Structure

```text
templates/
└── (public)/             # Public routes
    ├── layout.tsx       # Custom layout
    ├── page.tsx         # Home page
    ├── features/
    │   └── page.tsx
    ├── pricing/
    │   └── page.tsx
    └── support/
        └── page.tsx
```

### Example: page.tsx

```tsx
import { Hero } from '../components/Hero'
import { Features } from '../components/Features'
import { CTA } from '../components/CTA'

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Features />
      <CTA />
    </main>
  )
}
```

**Note:** Templates follow Next.js App Router conventions.

## Components Directory

Theme-specific component overrides and custom components.

### Structure

```text
components/
├── overrides/            # Core component replacements
│   ├── Button.tsx
│   ├── Card.tsx
│   └── Input.tsx
└── custom/               # Theme-specific components
    ├── CustomHeader.tsx
    ├── CustomFooter.tsx
    └── BrandLogo.tsx
```

### Override Example

```tsx
// components/overrides/Button.tsx
import { ButtonHTMLAttributes } from 'react'
import { cn } from '@/core/lib/utils'

export function Button({ 
  className, 
  children, 
  ...props 
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-lg',
        'bg-gradient-to-r from-primary to-secondary',
        'text-white font-semibold',
        'hover:shadow-lg transition-shadow',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
```

### Custom Component Example

```tsx
// components/custom/BrandLogo.tsx
import Image from 'next/image'
import { useTheme } from 'next-themes'

export function BrandLogo() {
  const { theme } = useTheme()
  
  return (
    <Image
      src={theme === 'dark' ? '/theme/brand/logo-dark.svg' : '/theme/brand/logo.svg'}
      alt="Logo"
      width={120}
      height={40}
    />
  )
}
```

## File Naming Conventions

### General Rules

- **Config files:** `*.config.ts`
- **Type files:** `*.types.ts`
- **Components:** PascalCase `MyComponent.tsx`
- **Utilities:** camelCase `myHelper.ts`
- **Styles:** kebab-case `my-styles.css`

### Entity Files

- **Config:** `[entity].config.ts`
- **Fields:** `[entity].fields.ts`
- **Types:** `[entity].types.ts`
- **Service:** `[entity].service.ts`
- **Migrations:** `001_description.sql` (numbered)

### Translation Files

- **Format:** `[locale].json`
- **Examples:** `en.json`, `es.json`, `fr.json`

## Best Practices

### Organization

1. **Keep files flat** - Avoid deep nesting
2. **Use index files** - For clean imports
3. **Group related files** - Co-locate related functionality
4. **Follow conventions** - Match the default theme structure

### File Size

1. **Split large files** - Keep files under 500 lines
2. **Extract utilities** - Move reusable code to utils
3. **Separate concerns** - One responsibility per file

### Documentation

1. **Add README files** - Document complex directories
2. **Use comments** - Explain non-obvious code
3. **Write JSDoc** - Document component props

### Assets

1. **Optimize images** - Compress before committing
2. **Use appropriate formats** - WebP for photos, SVG for graphics
3. **Include licenses** - For fonts and other assets

## Next Steps

1. **[Theme Configuration](./03-theme-configuration.md)** - Configure theme settings
2. **[CSS Variables and Styling](./04-css-variables-and-styling.md)** - Customize appearance
3. **[Component Overrides](./05-component-overrides.md)** - Override core components
4. **[Asset Management](./06-asset-management.md)** - Work with theme assets

---

> 💡 **Tip**: Use the default theme as a template. Copy its structure and modify as needed rather than building from scratch.
