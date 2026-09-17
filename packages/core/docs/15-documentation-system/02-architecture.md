# Documentation System Architecture

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark registry:watch`.

## Introduction

The documentation system architecture is built around **build-time registry generation** and **runtime markdown rendering**. This document explains the complete flow from documentation files to rendered pages, including the build script, registry structure, routing, and rendering components.

## Architecture Overview

Only the **active theme's** own docs are scanned, built, or served. Core's
own `core/docs/` (this directory tree) and any plugin's
`contents/plugins/[plugin]/docs/` are conventions for organizing reference
material in the source tree - the build never reads them and no route ever
serves them.

```text
┌─────────────────────────────────────────────────────────────┐
│                     BUILD TIME                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. core/scripts/build/registry/generators/docs-registry.mjs│
│     │                                                         │
│     ├─> Scan contents/themes/[ACTIVE_THEME]/docs/public/    │
│     └─> Scan contents/themes/[ACTIVE_THEME]/docs/superadmin/│
│                                                               │
│  2. Extract Metadata                                         │
│     │                                                         │
│     ├─> Directory names → Section metadata                  │
│     ├─> File names → Page metadata                          │
│     └─> Numeric prefixes → Order                            │
│                                                               │
│  3. Generate Registry                                        │
│     │                                                         │
│     └─> Output: <project>/.nextspark/registries/docs-registry.ts │
│         (imported as @nextsparkjs/registries/docs-registry) │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     RUNTIME                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User visits /docs/[section]/[page]                         │
│  (or /superadmin/docs/[section]/[page])                     │
│     │                                                         │
│     ├─> 1. Route Handler (page.tsx)                         │
│     │      - Import DOCS_REGISTRY                            │
│     │      - Lookup section/page metadata                    │
│     │      - Get markdown file path                          │
│     │                                                         │
│     ├─> 2. Markdown Parser (parseMarkdownFile)              │
│     │      - Read file from path                             │
│     │      - Parse frontmatter with gray-matter              │
│     │      - Convert to HTML with remark                     │
│     │                                                         │
│     └─> 3. Render Components                                │
│          - DocsLayout (responsive layout)                    │
│          - DocsSidebar (navigation)                          │
│          - DocsContent (HTML rendering)                      │
│          - DocsBreadcrumbs (navigation trail)                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Build Process

### Documentation Registry Builder

**Location:** `core/scripts/build/registry/generators/docs-registry.mjs`, invoked by `core/scripts/build/registry.mjs` alongside every other registry

**Purpose:** Scans the active theme's `docs/public/` and `docs/superadmin/` directories and generates a static registry

**Execution:**
```bash
# In the NextSpark monorepo, from the repository root
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
```

In a generated project, `pnpm dev` and `pnpm build` (`nextspark dev` and
`nextspark build`) run the registry build before Next starts, and
`pnpm build:registries` runs it on its own.

### Discovery Algorithm

**1. Directory Scanning:**
```typescript
// Scans docs/public/ and docs/superadmin/ of the active theme
scanDocsDirectory(docsPath, source) {
  - Read all subdirectories (sections)
  - Extract order from directory name (01-fundamentals)
  - Generate slug (fundamentals)
  - Scan markdown files within each section
  - Extract page metadata from filenames
}
```

**2. Metadata Extraction:**
```typescript
// From "01-overview/03-directory-structure.md" in the theme's docs/public/
{
  slug: "directory-structure",
  title: "Directory Structure",  // Auto-generated from slug
  order: 3,                       // From numeric prefix
  path: "../../themes/default/docs/public/01-overview/03-directory-structure.md",
  source: "public"
}
```

**3. Registry Shape:**
```typescript
const registry = {
  public: scanDocsDirectory('contents/themes/default/docs/public/', 'public'),
  superadmin: scanDocsDirectory('contents/themes/default/docs/superadmin/', 'superadmin'),
  all: [...public, ...superadmin].sort(by order)
}
```

**4. TypeScript Generation:**
```typescript
// Output: <project>/.nextspark/registries/docs-registry.ts
export const DOCS_REGISTRY: DocsRegistryStructure = {
  public: [...],
  superadmin: [...],
  all: [...]
} as const
```

### Active Theme Detection

The build script reads the active theme from the required environment variable:

```javascript
const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME?.replace(/'/g, '')
```

`validateEnvironment()` rejects a missing or empty `NEXT_PUBLIC_ACTIVE_THEME`.
`buildRegistries()` prints the validation errors and exits with code `1` before
writing registry files. Only the selected theme's documentation is included in
the registry. Core's own docs and any plugin's docs are never scanned - see
[Core vs Theme Documentation](./03-core-vs-theme-docs.md) for what that
means for cross-referencing between them.

### Documentation Configuration

Documentation access and the public sidebar are configured in the `docs` block
of `app.config.ts` (`DocsConfig` in `core/lib/config/types.ts`):

```typescript
export const appConfig = {
  docs: {
    enabled: true,
    publicAccess: true,      // false: /docs asks for a session
    searchEnabled: true,
    breadcrumbs: true,

    // Sidebar settings of /docs - the active theme's docs/public/
    public: {
      enabled: true,           // false: the /docs sidebar renders nothing
      open: true,
      label: "Documentation",  // Heading of the /docs sidebar
    },

    // /superadmin/docs - the active theme's docs/superadmin/
    superadmin: {
      enabled: true,
      open: false,
      label: "Admin Docs",
    },
  }
}
```

#### Who can read /docs

`docs.publicAccess` is the only access setting. The generated proxy
(`proxy.ts`, from `core/templates/proxy.ts`) reads it through `isDocsPublic()`
in `core/lib/docs/access.ts` on every request under `/docs`:

| `docs` block | `/docs` without a session |
|--------------|---------------------------|
| `publicAccess: false` | Redirects to `/login?callbackUrl=...` |
| `publicAccess: true`, or no `publicAccess` | Served |
| no `docs` block | Served |

`docs.public` is not an access setting: it holds the sidebar settings of the
public category, and hiding that category (`public.enabled: false`) does not
make `/docs` private.

`/superadmin/docs` is not affected by `publicAccess`: like every `/superadmin`
route, it needs a signed-in user with the `superadmin` or `developer` role.

**Older app configs.** Before `publicAccess` existed, an app config said
`public: false` for private docs. That boolean still means
`publicAccess: false`, and the proxy logs once per server process what to
write instead. Either one set to `false` keeps `/docs` private, so a leftover
`public: false` next to `publicAccess: true` still asks for a session. To
migrate, write `publicAccess: false` and turn `public` into its
`{ enabled, open, label }` settings.

#### What each property does today

| Property | Read by | Effect |
|----------|---------|--------|
| `publicAccess` | proxy | Whether `/docs` needs a session (see above) |
| `public.enabled` | `DocsSidebar` | `false` renders no `/docs` sidebar |
| `public.label` | `DocsSidebar` | Heading of the `/docs` sidebar |
| `enabled`, `searchEnabled`, `breadcrumbs`, `public.open`, `superadmin.*` | nothing yet | Declared in `DocsConfig`; no component or route reads them, so setting them changes nothing |

## Routing System

### URL Structure

```text
/docs/[section]/[page]              → active theme's docs/public/
/superadmin/docs/[section]/[page]   → active theme's docs/superadmin/

Example:
/docs/overview/introduction
/superadmin/docs/setup/deployment
```

Core and plugin docs have no URL - they are never scanned into the registry.

### Route Handlers

**Public Docs:**
- **File:** `app/(public)/docs/[section]/[page]/page.tsx`
- **Dynamic Segments:** `section`, `page`

**Superadmin Docs:**
- **File:** `app/superadmin/docs/[section]/[page]/page.tsx`
- **Dynamic Segments:** `section`, `page`

### Page Rendering Flow

```typescript
// 1. Resolve dynamic route parameters
const { section, page } = params

// 2. Lookup in registry
const sectionData = DOCS_REGISTRY.public.find(s => s.slug === section)
const pageData = sectionData.pages.find(p => p.slug === page)

// 3. Parse markdown file
const filePath = path.join(process.cwd(), pageData.path)
const { metadata, html } = await parseMarkdownFile(filePath)

// 4. Render with components
return (
  <DocsLayout>
    <DocsBreadcrumbs />
    <DocsContent html={html} />
  </DocsLayout>
)
```

## Rendering Components

### DocsLayout

**File:** `core/components/docs/docs-layout.tsx`

**Responsibilities:**
- Responsive layout container
- Mobile sidebar toggle
- Desktop fixed sidebar
- Main content area

**Features:**
- Mobile: Overlay sidebar with backdrop
- Desktop: Fixed sidebar, scrollable content
- Accessibility: ARIA labels and keyboard navigation

### DocsSidebar

**File:** `core/components/docs/docs-sidebar.tsx`

**Responsibilities:**
- Renders a collapsible navigation tree of the active theme's own sections
  (no categories - only public documentation is shown, per the component's
  own docstring: "Only shows public documentation (no plugins, no
  categories)")
- Highlights active page
- Manages expand/collapse state

**Structure:**
```text
Sidebar
├── Overview (section)
│   ├── Introduction (page)
│   └── Getting Started (page)
├── Customization (section)
│   └── ...
└── Features (section)
    └── ...
```

### DocsContent

**File:** `core/components/docs/docs-content.tsx`

**Responsibilities:**
- Renders parsed HTML from markdown
- Applies prose styling (Tailwind Typography)
- Handles code syntax highlighting
- Responsive typography

**Styling:**
- Uses `prose` classes for markdown content
- Dark mode support via `dark:prose-invert`
- Maximum width constraints for readability

### DocsBreadcrumbs

**File:** `core/components/docs/docs-breadcrumbs.tsx`

**Responsibilities:**
- Displays navigation trail
- Provides quick navigation to parent pages
- Shows current page context

**Example:**
```text
Documentation > Overview > Introduction
```

## Markdown Processing

### Parser Implementation

**File:** `core/lib/docs/parser.ts`

**Libraries:**
- **gray-matter** - Frontmatter parsing
- **remark** - Markdown to HTML conversion
- **remark-html** - HTML serialization

### Parsing Flow

```typescript
// 1. Read markdown file
const fileContent = fs.readFileSync(filePath, 'utf-8')

// 2. Parse frontmatter
const { data, content } = matter(fileContent)

// 3. Convert markdown to HTML
const processedContent = await remark()
  .use(html, { sanitize: false })
  .process(content)

// 4. Return metadata and HTML
return {
  metadata: data,          // { title, description, ... }
  content: rawMarkdown,    // Original markdown
  html: processedContent   // Rendered HTML
}
```

### Frontmatter Support

Optional frontmatter can override auto-generated metadata:

```markdown
---
title: Custom Title
description: Page description for SEO
---

# Markdown content starts here
```

## Integration Points

### Registry System

The docs system integrates with the core registry architecture:

- **Build Script:** `core/scripts/build/registry.mjs`
- **Output Location:** `<project>/.nextspark/registries/docs-registry.ts`
- **Import Pattern:** `import { DOCS_REGISTRY } from '@nextsparkjs/registries/docs-registry'`

### Theme System

The active theme's own docs are automatically discovered - and are the only
docs served at all:

- **Location:** `contents/themes/[ACTIVE_THEME]/docs/public/` and `docs/superadmin/`
- **Detection:** Via `NEXT_PUBLIC_ACTIVE_THEME` environment variable
- **Access and sidebar:** `docs.publicAccess`, `docs.public.enabled` and `docs.public.label` - see [Documentation Configuration](#documentation-configuration)

### Core and Plugin Docs

`core/docs/` (this tree) and any `contents/plugins/[plugin]/docs/` are never
scanned by the registry builder and have no route - see
[Core vs Theme Documentation](./03-core-vs-theme-docs.md) for what that means
in practice.

## Performance Characteristics

**Build Time:**
- Registry generation: ~50-100ms
- Scales linearly with documentation size
- Negligible impact on total build time

**Runtime:**
- Registry lookup: ~6ms (memory access)
- Markdown parsing: ~20-30ms per page
- Server-side rendering: Single-pass HTML generation
- No client-side hydration for content

## Next Steps

- **[Core vs Theme Documentation](./03-core-vs-theme-docs.md)** - Organization patterns
- **[Docs Registry](./05-docs-registry.md)** - Registry structure reference
- **[Public Rendering](./06-public-rendering.md)** - Rendering system details
