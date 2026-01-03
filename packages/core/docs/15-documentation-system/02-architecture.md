# Documentation System Architecture

## Introduction

The documentation system architecture is built around **build-time registry generation** and **runtime markdown rendering**. This document explains the complete flow from documentation files to rendered pages, including the build script, registry structure, routing, and rendering components.

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     BUILD TIME                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. core/scripts/build/docs.mjs                          │
│     │                                                         │
│     ├─> Scan core/docs/                                     │
│     ├─> Scan contents/themes/[theme]/docs/                  │
│     └─> Scan contents/plugins/[plugin]/docs/                │
│                                                               │
│  2. Extract Metadata                                         │
│     │                                                         │
│     ├─> Directory names → Section metadata                  │
│     ├─> File names → Page metadata                          │
│     └─> Numeric prefixes → Order                            │
│                                                               │
│  3. Generate Registry                                        │
│     │                                                         │
│     └─> Output: core/lib/registries/docs-registry.ts        │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     RUNTIME                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User visits /docs/[category]/[section]/[page]              │
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

**Location:** `core/scripts/build/docs.mjs`

**Purpose:** Scans documentation directories and generates static registry

**Execution:**
```bash
# Automatic (during pnpm dev or pnpm build)
pnpm docs:build

# Manual
node core/scripts/build/docs.mjs
```

### Discovery Algorithm

**1. Directory Scanning:**
```typescript
// Scans each docs directory
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
// From: "03-directory-structure.md"
{
  slug: "directory-structure",
  title: "Directory Structure",  // Auto-generated from slug
  order: 3,                       // From numeric prefix
  path: "/core/docs/01-fundamentals/03-directory-structure.md",
  source: "core"
}
```

**3. Multi-Source Aggregation:**
```typescript
const registry = {
  core: scanDocsDirectory('core/docs/', 'core'),
  theme: scanDocsDirectory('contents/themes/default/docs/', 'theme'),
  plugins: scanPluginDocs(activePlugins),
  all: [...core, ...theme, ...plugins].sort(by order)
}
```

**4. TypeScript Generation:**
```typescript
// Output: core/lib/registries/docs-registry.ts
export const DOCS_REGISTRY: DocsRegistryStructure = {
  core: [...],
  theme: [...],
  plugins: [...],
  all: [...]
} as const
```

### Active Theme Detection

The build script automatically detects the active theme:

```javascript
const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
```

Only the active theme's documentation is included in the registry.

### Documentation Configuration

Documentation visibility and behavior is fully controlled via `app.config.ts`:

```typescript
export const appConfig = {
  documentation: {
    // Enable/disable search functionality in sidebar
    searchEnabled: true,

    // Show/hide breadcrumbs navigation
    breadcrumbs: true,

    // Theme documentation configuration
    theme: {
      enabled: true,           // Show/hide theme docs in sidebar
      open: true,              // Expand section by default on page load
      label: "Default Theme",  // Custom label for sidebar category
    },

    // Plugins documentation configuration
    plugins: {
      enabled: true,     // Show/hide all plugin docs in sidebar
      open: false,       // Collapse section by default
      label: "Plugins",  // Custom label for sidebar category
    },

    // Core documentation configuration
    core: {
      enabled: true,   // Show/hide core docs in sidebar
      open: true,      // Expand section by default
      label: "Core",   // Custom label for sidebar category
    },

    // Additional production check for plugin docs (legacy)
    showPluginsDocsInProd: false,  // Hide plugins in production even if enabled
  }
}
```

**Configuration Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | boolean | Show/hide the entire category in sidebar |
| `open` | boolean | Whether category is expanded by default on page load |
| `label` | string | Custom label displayed in sidebar for the category |

**Common Configurations:**

```typescript
// Only show theme docs (hide core and plugins)
documentation: {
  theme: { enabled: true, open: true, label: "Documentation" },
  plugins: { enabled: false, open: false, label: "Plugins" },
  core: { enabled: false, open: false, label: "Core" }
}

// Show all but collapse by default
documentation: {
  theme: { enabled: true, open: false, label: "Theme" },
  plugins: { enabled: true, open: false, label: "Extensions" },
  core: { enabled: true, open: false, label: "System" }
}

// Production config (hide technical docs)
documentation: {
  theme: { enabled: true, open: true, label: "Help Center" },
  plugins: { enabled: false, open: false, label: "Plugins" },
  core: { enabled: false, open: false, label: "Core" },
  showPluginsDocsInProd: false  // Additional prod check
}
```

## Routing System

### URL Structure

**Core Documentation:**
```text
/docs/core/[section]/[page]

Example:
/docs/core/fundamentals/project-overview
/docs/core/registry-system/introduction
```

**Theme Documentation:**
```text
/docs/theme/[section]/[page]

Example:
/docs/theme/customization/styling
/docs/theme/features/components
```

**Plugin Documentation:**
```text
/docs/plugins/[plugin]/[section]/[page]

Example:
/docs/plugins/ai/features/chat-interface
/docs/plugins/analytics/setup/configuration
```

### Route Handlers

**Core/Theme Pages:**
- **File:** `app/(public)/docs/[category]/[section]/[page]/page.tsx`
- **Dynamic Segments:** `category` (core | theme), `section`, `page`

**Plugin Pages:**
- **File:** `app/(public)/docs/plugins/[plugin]/[section]/[page]/page.tsx`
- **Dynamic Segments:** `plugin`, `section`, `page`

### Page Rendering Flow

```typescript
// 1. Resolve dynamic route parameters
const { category, section, page } = params

// 2. Lookup in registry
const sectionData = DOCS_REGISTRY[category].find(s => s.slug === section)
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
- Renders collapsible navigation tree
- Groups by category (Core, Theme, Plugins)
- Highlights active page
- Manages expand/collapse state

**Structure:**
```text
Sidebar
├── Core (category)
│   ├── Fundamentals (section)
│   │   ├── Project Overview (page)
│   │   └── Architecture (page)
│   └── Registry System (section)
│       └── ...
├── Theme (category)
│   └── ...
└── Plugins (category)
    ├── AI Plugin (plugin)
    │   └── Features (section)
    └── Analytics Plugin (plugin)
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
Documentation > Core > Registry System > Introduction
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

- **Build Script:** `core/scripts/build/docs.mjs`
- **Output Location:** `core/lib/registries/docs-registry.ts`
- **Import Pattern:** `import { DOCS_REGISTRY } from '@/core/lib/registries/docs-registry'`

### Theme System

Theme docs are automatically discovered based on active theme:

- **Location:** `contents/themes/[ACTIVE_THEME]/docs/`
- **Detection:** Via `NEXT_PUBLIC_ACTIVE_THEME` environment variable
- **Merging:** Theme docs appear as separate category in navigation

### Plugin System

Plugin docs integrate with plugin activation:

- **Location:** `contents/plugins/[plugin]/docs/`
- **Discovery:** Based on active plugins in `theme.config.ts`
- **Visibility:** Controlled via `documentation.plugins` configuration (`enabled`, `open`, `label` properties)

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
