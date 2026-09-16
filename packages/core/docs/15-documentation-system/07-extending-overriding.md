# Extending and Overriding Documentation

## Introduction

The documentation system supports extending documentation through **themes** and **plugins**. While core documentation covers system-wide features, themes and plugins can add their own documentation to provide context-specific information for users.

This document explains how to add documentation to themes and plugins, the additive nature of the system, and best practices for maintaining clear, organized multi-source documentation.

## Adding Theme Documentation

### Directory Structure

Create a `docs/` directory within your theme:

```text
contents/themes/my-theme/
├── config/                       # Configuration files
│   ├── theme.config.ts
│   └── app.config.ts
├── docs/                         ← Theme documentation
│   ├── 01-overview/
│   │   ├── 01-introduction.md
│   │   └── 02-features.md
│   ├── 02-customization/
│   │   ├── 01-styling.md
│   │   └── 02-components.md
│   └── 03-deployment/
│       └── 01-production.md
├── messages/
└── public/
```

### Naming Conventions

Follow the same conventions as core documentation:

**Sections (Directories):**
```text
{order}-{slug}/

Examples:
01-overview/
02-customization/
03-deployment/
```

**Pages (Files):**
```text
{order}-{slug}.md

Examples:
01-introduction.md
02-styling.md
03-components.md
```

### Build-Time Discovery

Theme documentation is automatically discovered during build:

```javascript
// core/scripts/build/registry/generators/docs-registry.mjs
const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'

const publicDocs = scanDocsDirectory(
  `contents/themes/${activeTheme}/docs/public/`,
  'public'
)
```

**Key Points:**
- Only the **active theme's** documentation is included
- Automatic discovery (no manual registration)
- Appears in the docs sidebar (no separate "Theme Documentation" category -
  it is the only thing the sidebar ever shows)
- Accessible at `/docs/[section]/[page]`

### Example Theme Documentation

**File:** `contents/themes/my-theme/docs/01-overview/01-introduction.md`

```markdown
---
title: My Theme Introduction
description: Overview of My Theme features and capabilities
---

# My Theme Introduction

My Theme provides a modern, responsive design optimized for SaaS applications.

## Key Features

- Custom dashboard layouts
- Advanced analytics widgets
- Branded authentication pages
- Optimized performance

## Getting Started

To customize this theme, start by exploring the [Customization Guide](../02-customization/01-styling.md).

For core system features, refer to core's own documentation (`packages/core/docs`, kept as internal monorepo reference and not published).
```

## Adding Plugin Documentation

A plugin's `docs/` directory is never scanned into the docs registry (see
below), so nothing written here is ever served at a route. It is still
useful as reference material for anyone reading the plugin's source, and the
same directory/naming conventions as core and theme docs keep it consistent
with the rest of the monorepo.

### Directory Structure

Create a `docs/` directory within your plugin:

```text
contents/plugins/my-plugin/
├── plugin.config.ts
├── docs/                          ← Plugin documentation
│   ├── 01-getting-started/
│   │   ├── 01-installation.md
│   │   └── 02-configuration.md
│   ├── 02-features/
│   │   ├── 01-feature-one.md
│   │   └── 02-feature-two.md
│   └── 03-api/
│       └── 01-endpoints.md
├── entities/
└── messages/
```

### Not Discovered at Build Time

Unlike theme docs, a plugin's own `docs/` directory is **never scanned** by
`docs-registry.mjs` - only `contents/themes/[ACTIVE_THEME]/docs/public/` and
`.../docs/superadmin/` are. Activating a plugin (adding it to
`theme.config.ts`) has no effect on the docs registry: writing
`contents/plugins/my-plugin/docs/01-getting-started/01-installation.md`
keeps that file as source-tree reference material, not a served page - it
has no route at all.

If a plugin's documentation needs to reach an actual reader, write it into
the active theme's own `docs/public/` (or `docs/superadmin/`) instead, where
it will be scanned and served like any other theme page.

### Production Visibility

Control who can read `/docs` and how its sidebar is titled via the `docs`
block of `app.config.ts` (`DocsConfig` in `core/lib/config/types.ts`) - it
only knows the two categories that actually get served, `public` (`/docs`)
and `superadmin` (`/superadmin/docs`):

```typescript
// contents/themes/my-theme/config/app.config.ts
export const appConfig = {
  docs: {
    enabled: true,
    publicAccess: true,      // false: /docs asks for a session
    searchEnabled: true,
    breadcrumbs: true,

    // Sidebar settings of /docs - this theme's docs/public/
    public: {
      enabled: true,        // false: the /docs sidebar renders nothing
      open: true,
      label: "User Guide",  // Heading of the /docs sidebar
    },

    // /superadmin/docs - this theme's docs/superadmin/
    superadmin: {
      enabled: true,
      open: false,
      label: "Admin Docs",
    },
  }
}
```

Only `publicAccess`, `public.enabled` and `public.label` change anything
today; see [What each property does today](./02-architecture.md#what-each-property-does-today).

**Configuration Properties (`DocsCategoryConfig`):**

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | boolean | Show/hide this category in the sidebar |
| `open` | boolean | Whether the category is expanded by default on page load |
| `label` | string | Custom label displayed in the sidebar for the category |

### Example Plugin Documentation

**File:** `contents/plugins/ai/docs/01-getting-started/01-installation.md`

```markdown
---
title: AI Plugin Installation
description: How to install and configure the AI plugin
---

# AI Plugin Installation

The AI Plugin adds artificial intelligence capabilities to your application.

## Prerequisites

Before installing, ensure you have:

- API key from OpenAI
- Node.js 18+
- Active theme with plugin support

## Installation

1. Add plugin to your theme configuration:

```typescript
// contents/themes/my-theme/config/theme.config.ts
export const themeConfig = {
  plugins: ['ai']  // ← Add plugin
}
```

2. Configure environment variables:

```bash
OPENAI_API_KEY=your_api_key_here
```

3. Rebuild registry:

```bash
nextspark registry build
pnpm dev
```

## Next Steps

See [Configuration](./02-configuration.md) for detailed setup options.
```

## Documentation Merge Strategy

### Nothing to Merge

There is no merge: `/docs` and `/superadmin/docs` each show exactly one
source, the active theme's own `docs/public/` and `docs/superadmin/`. Core
docs and plugin docs are never scanned in the first place, so they cannot
appear alongside a theme's docs, cannot override them, and there is no
"additive" combination to reason about.

### Independent Sections

The docs sidebar only ever shows the active theme's own sections - see
[DocsSidebar](./02-architecture.md#docssidebar):

```text
Navigation Sidebar:

Overview
Customization
Features
  ...
```

Core and plugin docs never appear here, under any category.

## Cross-Referencing

### Referring to Core Docs

Core's own docs (`packages/core/docs`) are kept as internal monorepo reference and are never published, so theme or plugin documentation can only mention them by name, not link to them:

```markdown
<!-- In theme docs -->
For information about entities, see core's own Entity System documentation.

<!-- In plugin docs -->
This plugin extends core's own API System documentation.
```

### Referring Between Plugins

The same applies between two plugins' docs: neither is served, so neither
has a URL the other could link to. Name the other plugin by text instead of
linking to it, and note that the feature is conditional on it being
installed:

```markdown
<!-- In plugin-a/docs/ -->
This feature integrates with the Analytics Plugin if installed.
```

### Linking Within Source

Use relative paths within the same source:

```markdown
<!-- In theme docs -->
See [Styling Guide](../02-customization/01-styling.md) for details.

<!-- In plugin docs -->
Refer to [Configuration](./02-configuration.md) for setup options.
```

## Best Practices

### Theme Documentation

**DO:**
- ✅ Document theme-specific features
- ✅ Provide customization guides
- ✅ Include design system documentation
- ✅ Reference core docs where relevant

**DON'T:**
- ❌ Duplicate core system documentation
- ❌ Override or contradict core docs
- ❌ Document plugin features
- ❌ Include implementation details of core system

**Good Topic Examples:**
- Theme color palette and styling
- Custom component library
- Theme-specific page layouts
- Brand guidelines
- Theme configuration options

### Plugin Documentation

Never served (see [Adding Plugin Documentation](#adding-plugin-documentation)
above) - written for someone reading the plugin's source, not for an end user.

**DO:**
- ✅ Document plugin capabilities clearly
- ✅ Provide installation instructions
- ✅ Include API reference for plugin endpoints
- ✅ Explain plugin-specific concepts

**DON'T:**
- ❌ Assume other plugins are installed
- ❌ Document core system features
- ❌ Reference theme-specific implementations
- ❌ Create dependencies on other plugin docs

**Good Topic Examples:**
- Plugin installation and setup
- Feature guides and tutorials
- API extensions provided by plugin
- Configuration reference
- Integration examples

## Conditional Documentation

### Public or Private Docs

`docs.publicAccess` decides whether `/docs` needs a session. `/superadmin/docs`
always needs a `superadmin` or `developer` session, whatever this block says,
and there is no third category, since core and plugin docs are never served
regardless of configuration.

**Open to visitors:**
```typescript
export const appConfig = {
  docs: {
    enabled: true,
    publicAccess: true,
    public: { enabled: true, open: true, label: "Help Center" },
    superadmin: { enabled: true, open: false, label: "Admin Docs" },
  }
}
```

**Signed-in users only:**
```typescript
export const appConfig = {
  docs: {
    enabled: true,
    publicAccess: false,
    public: { enabled: true, open: true, label: "Documentation" },
    superadmin: { enabled: true, open: false, label: "Admin Docs" },
  }
}
```

An app config written before `publicAccess` existed may say `public: false`
instead. It still keeps `/docs` private, and the proxy logs what to write in
its place; see [Who can read /docs](./02-architecture.md#who-can-read-docs).

## Rebuilding Documentation

### When to Rebuild

Rebuild the documentation registry when:

- Adding new documentation files to the active theme's `docs/public/` or `docs/superadmin/`
- Renaming or reordering sections/pages
- Changing active theme
- Modifying file/directory names

Activating or deactivating a plugin does **not** affect the docs registry -
plugin docs are never scanned into it.

### Build Command

```bash
# Rebuild docs registry
nextspark registry build

# Restart dev server
pnpm dev
```

**Automatic Rebuilds:**
- During `pnpm dev` startup
- During `pnpm build` for production
- When running `nextspark registry build` explicitly

## Use Cases

### Public SaaS Platform

**Scenario:** Multi-tenant SaaS, `/docs` open to visitors

**Strategy:** Write end-user customization and feature guides directly into
the active theme's `docs/public/` (feature guides that happen to cover a
plugin's functionality belong here too, since that is the only place
they'll ever be read). Keep `docs.publicAccess: true` and `docs.public.enabled: true`.

**Example Navigation:**
```text
Documentation
├── Getting Started
├── Customization
└── Integrations
```

### White-Label Application

**Scenario:** Custom-branded instance for an enterprise client

**Strategy:** The theme's `docs/public/` holds the client-facing brand and
usage guide; keep it the only thing under `/docs`.

**Example Navigation:**
```text
Documentation
└── Your Brand Guide
```

### Internal Tool

**Scenario:** Internal company application

**Strategy:** `docs/public/` for the workflows every employee needs;
`docs/superadmin/` for operator-only runbooks under `/superadmin/docs`.

## Troubleshooting

### Documentation Not Appearing

**Problem:** Added docs but don't see them in navigation

**Solution:**
1. Check file naming: `{order}-{slug}.md`
2. Check directory naming: `{order}-{slug}/`
3. Verify docs are in correct location
4. Rebuild registry: `nextspark registry build`
5. Restart dev server

### Plugin Docs Missing

**This is expected, not a bug.** Plugin docs are never scanned into the
registry and have no route at any level (development or production) - see
[Adding Plugin Documentation](#adding-plugin-documentation). To make a
plugin's guide reachable, write it into the active theme's `docs/public/`
instead.

### Wrong Theme Docs Showing

**Problem:** Seeing another theme's documentation

**Solution:**
1. Check `NEXT_PUBLIC_ACTIVE_THEME` environment variable
2. Verify theme name matches directory name
3. Rebuild registry: `nextspark registry build`

## Next Steps

- **[Writing Documentation](./04-writing-documentation.md)** - Authoring standards
- **[Core vs Theme Docs](./03-core-vs-theme-docs.md)** - When to use each source
- **[Docs Registry](./05-docs-registry.md)** - Registry structure reference
