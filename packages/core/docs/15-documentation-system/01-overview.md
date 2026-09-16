# Documentation System Overview

## Introduction

NextSpark builds a documentation registry for the active theme. The registry provides navigation metadata without runtime discovery; `packages/core/docs/` and plugin documentation remain internal source reference and are not published routes.

This system follows the same **registry-based philosophy** as other core features, resolving documentation metadata at build time rather than during request handling.

## Key Features

### 1. **Theme Documentation Sources**

The active theme contributes two documentation trees:

- **Public docs** (`themes/[theme]/docs/public/`) → `/docs/[section]/[page]`
- **Superadmin docs** (`themes/[theme]/docs/superadmin/`) → `/superadmin/docs/[section]/[page]`

The active theme comes from `NEXT_PUBLIC_ACTIVE_THEME`, which the registry build requires. Core and plugin documentation are internal reference material and do not contribute entries to `DOCS_REGISTRY`.

### 2. **Build-Time Registry Generation**

`packages/core/scripts/build/registry.mjs` calls `generateDocsRegistry()` with the other registry generators. It:

- scans the active theme's `docs/public/` and `docs/superadmin/` directories;
- derives section and page metadata from numbered directory and file names;
- writes `.nextspark/registries/docs-registry.ts` in the consuming project; and
- enables lookup without runtime directory scanning.

In this monorepo, the consuming project is `apps/dev`, so the generated file is `apps/dev/.nextspark/registries/docs-registry.ts`.

### 3. **Automatic Navigation**

The documentation system automatically generates:

- **Hierarchical sidebar navigation** with expandable sections
- **Breadcrumb trails** for deep-linked pages

All navigation is derived from the docs registry structure, requiring no manual configuration.

### 4. **Documentation Routes**

The active theme's documentation is available through these route patterns:

```text
/docs/[section]/[page]                 → A public doc page
/superadmin/docs/[section]/[page]      → A superadmin doc page
```

For documentation configuration, see [Architecture](./02-architecture.md#documentation-configuration).

## Documentation Structure

### Directory Organization

```text
themes/[active-theme]/docs/
├── public/
│   └── 01-getting-started/
│       └── 01-introduction.md
└── superadmin/
    └── 01-setup/
        └── 01-configuration.md
```

### Naming Convention

**Sections (Directories):**
- Format: `{order}-{slug}/`
- Example: `01-getting-started/`
- Order determines navigation sequence

**Pages (Markdown Files):**
- Format: `{order}-{slug}.md`
- Example: `01-introduction.md`
- Order determines page sequence within sections

## How It Works

### Build Time (Development & Production)

1. **Documentation Discovery**
   - `generateDocsRegistry()` scans the active theme's public and superadmin documentation directories.
   - It extracts metadata from file and directory names.

2. **Registry Generation**
   - `registry.mjs` writes `.nextspark/registries/docs-registry.ts` in the consuming project.
   - The registry contains `public`, `superadmin`, and `all` section collections, plus lookup helpers.

3. **Static Output**
   - The generated registry is a TypeScript module.
   - Runtime code imports it as `@nextsparkjs/registries/docs-registry`.

### Runtime (User Visits Documentation)

1. **Navigation Rendering**
   - Documentation sidebars read `DOCS_REGISTRY`.
   - They render navigation from registry data without discovery scans.

2. **Page Rendering**
   - The route finds the page metadata in the appropriate registry collection.
   - It reads the markdown file at the stored path and renders it with the documentation components.

## Integration with Registry System

The documentation system is built on the same **registry architecture** that powers entities, plugins, and themes:

- **Build-time generation** via `packages/core/scripts/build/registry.mjs`
- **Static TypeScript output** in the consuming project's `.nextspark/registries/`
- **Package import** via `@nextsparkjs/registries/docs-registry`
- **Zero runtime discovery** using in-memory lookups

See [Docs Registry](./05-docs-registry.md) for registry structure and [Registry System](../03-registry-system/01-introduction.md) for architectural principles.

## Performance Characteristics

**Runtime:**
- Navigation is read from the generated registry
- Markdown parsing occurs only for the requested page
- No filesystem scanning or discovery overhead

## Next Steps

- **[Architecture](./02-architecture.md)** - Build process and rendering pipeline
- **[Writing Documentation](./04-writing-documentation.md)** - Authoring standards and conventions
- **[Docs Registry](./05-docs-registry.md)** - Registry structure and API reference
