# Documentation System Overview

## Introduction

NextSpark includes a **build-time documentation system** that provides zero runtime I/O for documentation discovery and rendering. Documentation can be written for core, a theme, or a plugin, but only the active theme's own docs are indexed and published at `/docs`; core and plugin docs are internal reference material, read from source rather than served at a route.

This system follows the same **registry-based philosophy** as other core features, ensuring documentation metadata is resolved at build time rather than during request handling, resulting in instant page loads and optimal performance.

## Key Features

### 1. **Multi-Source Documentation**

Documentation can be written in three places:

- **Core Docs** (`core/docs/`) - System documentation covering core features, architecture, and APIs - internal reference, not published
- **Theme Docs** (`contents/themes/[theme]/docs/`) - Theme-specific documentation for customization and features - published for the active theme
- **Plugin Docs** (`contents/plugins/[plugin]/docs/`) - Plugin-specific documentation for each active plugin - internal reference, not published

Only the active theme's docs are indexed and served; core and plugin docs stay in the source tree for developers to read directly.

### 2. **Build-Time Registry Generation**

Documentation is indexed at build time via `core/scripts/build/registry.mjs`, alongside every other registry, which:

- Scans all documentation directories
- Extracts metadata from file/folder naming conventions
- Generates a static TypeScript registry (`core/lib/registries/docs-registry.ts`)
- Enables zero runtime filesystem access

**Performance Impact:**
```text
Runtime Doc Discovery:  ~140ms (filesystem I/O)
Registry Doc Access:    ~6ms (memory lookup)
Improvement:            ~17,255x faster
```

### 3. **Automatic Navigation**

The documentation system automatically generates:

- **Hierarchical sidebar navigation** with expandable sections
- **Breadcrumb trails** for deep-linked pages

All navigation is derived from the docs registry structure, requiring no manual configuration.

### 4. **Public Accessibility**

The active theme's documentation is publicly accessible via a flat URL pattern - there is no `core`, `theme` or `plugins` segment, since only one source is ever published at a time:

```text
/docs                          → Documentation home
/docs/[section]/[page]        → A public doc page
/superadmin/docs/[section]/[page] → A superadmin-only doc page
```

## Documentation Structure

### Directory Organization

```text
core/docs/
├── 01-fundamentals/           → Section (order: 1)
│   ├── 01-overview.md        → Page (order: 1)
│   ├── 02-architecture.md    → Page (order: 2)
│   └── 03-structure.md       → Page (order: 3)
├── 02-getting-started/
│   └── ...
└── 15-documentation-system/
    └── ...

contents/themes/[theme]/docs/
├── 01-theme-overview/
│   └── 01-introduction.md
└── 02-customization/
    └── ...

contents/plugins/[plugin]/docs/
├── 01-plugin-features/
│   └── 01-overview.md
└── 02-configuration/
    └── ...
```

### Naming Convention

**Sections (Directories):**
- Format: `{order}-{slug}/`
- Example: `01-fundamentals/`, `15-documentation-system/`
- Order determines navigation sequence

**Pages (Markdown Files):**
- Format: `{order}-{slug}.md`
- Example: `01-overview.md`, `03-architecture.md`
- Order determines page sequence within sections

## How It Works

### Build Time (Development & Production)

1. **Documentation Discovery**
   - The docs-registry generator inside `registry.mjs --build` runs during build
   - Scans `core/docs/`, active theme docs, and active plugin docs
   - Extracts metadata from file/directory names

2. **Registry Generation**
   - Generates `core/lib/registries/docs-registry.ts`
   - Contains all section and page metadata
   - Includes file paths for runtime markdown parsing

3. **Static Output**
   - Registry is a TypeScript constant
   - Zero runtime I/O for doc discovery
   - Instant access to all documentation metadata

### Runtime (User Visits /docs)

1. **Navigation Rendering**
   - `DocsSidebar` component reads `DOCS_REGISTRY`
   - Renders collapsible navigation from registry data
   - No filesystem access required

2. **Page Rendering**
   - Route handler loads page metadata from registry
   - Reads markdown file using path from registry
   - Parses markdown to HTML with `remark`
   - Renders with `DocsContent` component

3. **Server-Side Rendering**
   - All documentation renders server-side
   - Instant initial page load
   - SEO-friendly HTML output

## Integration with Registry System

The documentation system is built on the same **registry architecture** that powers entities, plugins, and themes:

- **Build-time generation** via `core/scripts/build/registry.mjs`
- **Static TypeScript output** in `core/lib/registries/`
- **Zero runtime discovery** using in-memory lookups
- **Type-safe access** with full TypeScript support

See [Docs Registry](./05-docs-registry.md) for detailed registry structure and [Registry System](../03-registry-system/01-introduction.md) for architectural principles.

## Use Cases

### Core Documentation
- System architecture and patterns
- API references and guides
- Development workflows
- Testing and deployment

### Theme Documentation
- Theme-specific features
- Customization guides
- Styling conventions
- Component overrides

### Plugin Documentation
- Plugin capabilities
- Configuration options
- Integration examples
- API extensions

## Performance Characteristics

**Build Time:**
- Documentation indexing: ~50-100ms
- Registry generation: ~10-20ms
- Total overhead: Negligible (~0.5% of total build)

**Runtime:**
- Navigation rendering: ~6ms (from memory)
- Markdown parsing: ~20-30ms per page (on-demand)
- No filesystem scanning or discovery overhead

## Next Steps

- **[Architecture](./02-architecture.md)** - Build process and rendering pipeline
- **[Writing Documentation](./04-writing-documentation.md)** - Authoring standards and conventions
- **[Docs Registry](./05-docs-registry.md)** - Registry structure and API reference
