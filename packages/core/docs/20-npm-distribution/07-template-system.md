# Template System

NextSpark uses EJS templates to generate the Next.js `/app` directory, allowing themes to customize routing and layouts.

## Overview

Templates solve a key problem: how can themes customize Next.js routing while maintaining core functionality?

**Solution:** Core provides base templates, themes can override any template.

## Template Locations

```
packages/core/templates/app/     # Core templates (defaults)
contents/themes/{theme}/templates/app/  # Theme overrides
```

## Template Priority

Theme templates always override core templates:

```javascript
// packages/core/scripts/generate-app.mjs

async function generateApp(projectRoot) {
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'

  for (const template of templates) {
    const themeVersion = join(themesDir, activeTheme, 'templates/app', template)
    const coreVersion = join(coreDir, 'templates/app', template)

    // Theme takes priority
    const source = existsSync(themeVersion) ? themeVersion : coreVersion

    await processTemplate(source, destination)
  }
}
```

## Template Structure

### Core Templates

The core provides base templates that can be extended:

```
packages/core/templates/app/
├── README.md           # Template documentation
└── layout.tsx.ejs      # Root layout template
```

> **Note:** The template system is designed to be minimal. Most routing is handled by Next.js conventions, and templates are used primarily for customizing layouts and shared components.

### Theme Template Overrides

Themes provide template overrides as **TypeScript files** (not EJS) in `contents/themes/{theme}/templates/`:

```
contents/themes/default/templates/
├── (public)/
│   ├── layout.tsx           # Public layout override
│   ├── page.tsx             # Homepage override
│   ├── support/
│   │   └── page.tsx         # Support page
│   └── blog/
│       └── [slug]/
│           └── page.tsx     # Blog post page
├── dashboard/
│   └── (main)/
│       ├── agent-multi/
│       │   └── page.tsx     # Multi-agent page
│       ├── agent-single/
│       │   └── page.tsx     # Single agent page
│       └── settings/
│           └── ai-usage/
│               └── page.tsx # AI usage settings
└── superadmin/
    └── ai-observability/
        ├── page.tsx         # AI observability list
        └── [traceId]/
            └── page.tsx     # Trace detail page
```

> **Note:** Theme templates are TypeScript components (`.tsx`) that override app routes. Core templates use EJS (`.ejs`) for initial app generation. Theme template overrides take priority during the build process.

## EJS Syntax

Templates use EJS (Embedded JavaScript) syntax:

### Variable Interpolation

```ejs
<%# page.tsx.ejs %>
import { getConfig } from '@/core/lib/config'

export const metadata = {
  title: '<%= appName %>',
  description: '<%= appDescription %>'
}
```

### Conditionals

```ejs
<% if (features.billing) { %>
import { PricingTable } from '@/core/components/billing/PricingTable'
<% } %>

export default function Page() {
  return (
    <div>
      <% if (features.billing) { %>
      <PricingTable />
      <% } %>
    </div>
  )
}
```

### Loops

```ejs
<%# Generate imports for all entities %>
<% entities.forEach(entity => { %>
import { <%= entity.name %>List } from '@/core/components/entities/<%= entity.slug %>'
<% }) %>
```

## Template Data

Templates receive this data object:

```typescript
interface TemplateData {
  // App metadata
  appName: string
  appDescription: string

  // Active theme
  activeTheme: string

  // Feature flags
  features: {
    billing: boolean
    teams: boolean
    superadmin: boolean
    aiChat: boolean
  }

  // Discovered entities
  entities: Array<{
    name: string
    slug: string
    plural: string
  }>

  // Active plugins
  plugins: string[]

  // Environment
  isDev: boolean
  isProd: boolean
}
```

## Server vs Client Components

Templates must handle the server/client component distinction:

### Server Component (Default)

```ejs
<%# page.tsx.ejs - Server Component %>
import { Suspense } from 'react'

export default async function Page() {
  const data = await fetchData()
  return <div>{data}</div>
}
```

### Client Component

```ejs
<%# interactive-component.tsx.ejs %>
'use client'

import { useState } from 'react'

export default function InteractiveComponent() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

### Metadata in Server Components

The `generateMetadata` function can only be in server components:

```ejs
<%# page.tsx.ejs - Server Component with metadata %>
import { Metadata } from 'next'

export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: '<%= appName %> - Page'
  }
}

export default async function Page() {
  return <div>Content</div>
}
```

**IMPORTANT:** Never add `'use client'` to files that export `generateMetadata`.

## Creating Theme Templates

### Step 1: Create Template Directory

```bash
# Create theme templates directory structure
mkdir -p contents/themes/mytheme/templates/(public)
```

### Step 2: Create Template Override

Create a TypeScript component file that follows Next.js app router conventions:

```typescript
// contents/themes/mytheme/templates/(public)/page.tsx

import { HeroSection } from '@/contents/themes/mytheme/components/HeroSection'

export default function HomePage() {
  return (
    <main>
      <HeroSection
        title="My SaaS"
        description="The best SaaS platform"
      />
    </main>
  )
}
```

### Step 3: Regenerate Registries

```bash
pnpm build:registries
# or
npx nextspark build
```

The template registry will automatically detect and register your new template override.

## Template Registry

Theme template overrides are tracked in the auto-generated template registry:

**File:** `packages/core/lib/registries/template-registry.ts`

```typescript
export interface TemplateOverride {
  name: string
  themeName: string
  templateType: string
  fileName: string
  relativePath: string
  appPath: string
  templatePath: string
  priority: number
  metadata?: any
}

export interface TemplateRegistryEntry {
  appPath: string
  component: any
  template: TemplateOverride
  alternatives: TemplateOverride[]
}

export const TEMPLATE_REGISTRY: Record<string, TemplateRegistryEntry> = {
  'app/(public)/page.tsx': {
    appPath: 'app/(public)/page.tsx',
    component: Template_0,
    template: {
      name: '(public)/page',
      themeName: 'default',
      templateType: 'page',
      fileName: 'page.tsx',
      relativePath: '(public)/page.tsx',
      appPath: 'app/(public)/page.tsx',
      templatePath: 'contents/themes/default/templates/(public)/page.tsx',
      priority: 10
    },
    alternatives: []
  }
}
```

The registry generator:
- Discovers all template overrides from active theme
- Maps them to their corresponding app paths
- Stores component references for runtime access
- Tracks alternative templates for multi-theme support

## Troubleshooting

### Template Not Applied

1. Check file exists in correct location (`contents/themes/{theme}/templates/`)
2. Verify theme name matches `NEXT_PUBLIC_ACTIVE_THEME`
3. Run `pnpm build:registries` to regenerate the template registry

### EJS Syntax Error

```
SyntaxError: Unexpected token in template
```

Check for:
- Unclosed `<% %>` tags
- Missing `%>` closers
- Unescaped `%` characters (use `%%` to escape)

### Client/Server Mismatch

```
Error: Cannot export generateMetadata from client component
```

Remove `'use client'` from the template or move `generateMetadata` to a separate file.

## Related

- [03-build-scripts.md](./03-build-scripts.md) - Build system
- [04-config-system.md](./04-config-system.md) - Configuration
