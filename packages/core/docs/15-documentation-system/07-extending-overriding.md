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
// core/scripts/build/docs.mjs
const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'

const themeDocs = scanDocsDirectory(
  `contents/themes/${activeTheme}/docs/`,
  'theme'
)
```

**Key Points:**
- Only the **active theme's** documentation is included
- Automatic discovery (no manual registration)
- Appears as "Theme Documentation" in navigation
- Accessible at `/docs/theme/[section]/[page]`

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

For core system features, refer to the [Core Documentation](/docs/core/fundamentals/project-overview).
```

## Adding Plugin Documentation

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

### Build-Time Discovery

Plugin documentation is discovered based on active plugins:

```javascript
// core/scripts/build/docs.mjs

// 1. Get active plugins from theme.config.ts
const activePlugins = getActiveThemePlugins(activeTheme)

// 2. Scan docs for each active plugin
const pluginDocs = []
for (const pluginName of activePlugins) {
  const pluginDocsPath = `contents/plugins/${pluginName}/docs/`
  if (fs.existsSync(pluginDocsPath)) {
    const sections = scanDocsDirectory(pluginDocsPath, 'plugin')
    sections.forEach(section => {
      section.pluginName = pluginName  // Tag with plugin name
      pluginDocs.push(section)
    })
  }
}
```

**Key Points:**
- Only **active plugins** have documentation included
- Plugin name automatically tagged on each section
- Appears under "Plugin Documentation" in navigation
- Accessible at `/docs/plugins/[plugin]/[section]/[page]`

### Production Visibility

Control documentation visibility via `app.config.ts`:

```typescript
// contents/themes/my-theme/config/app.config.ts
export const appConfig = {
  documentation: {
    // Control search functionality in sidebar
    searchEnabled: true,

    // Show/hide breadcrumbs navigation
    breadcrumbs: true,

    // Theme documentation configuration
    theme: {
      enabled: true,        // Show/hide theme docs in sidebar
      open: true,           // Expand section by default
      label: "User Guide",  // Custom label for sidebar
    },

    // Plugin documentation configuration
    plugins: {
      enabled: true,     // Show/hide plugin docs in sidebar
      open: false,       // Collapse section by default
      label: "Plugins",  // Custom label for sidebar
    },

    // Core documentation configuration
    core: {
      enabled: false,    // Hide technical docs from end users
      open: false,
      label: "Core",
    },

    // Legacy/additional production check
    showPluginsDocsInProd: false,  // Additional prod check for plugins
  }
}
```

**Configuration Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | boolean | Show/hide the entire category in sidebar |
| `open` | boolean | Whether category is expanded by default on page load |
| `label` | string | Custom label displayed in sidebar for the category |

**Common Use Cases:**

```typescript
// Public SaaS - Show user-facing docs only
documentation: {
  theme: { enabled: true, open: true, label: "Help Center" },
  plugins: { enabled: true, open: false, label: "Features" },
  core: { enabled: false, open: false, label: "Core" }
}

// Internal System - Hide plugins from end users
documentation: {
  theme: { enabled: true, open: true, label: "Guide" },
  plugins: { enabled: false, open: false, label: "Plugins" },
  core: { enabled: false, open: false, label: "Core" }
}

// Developer Platform - Show all documentation
documentation: {
  theme: { enabled: true, open: true, label: "Theme" },
  plugins: { enabled: true, open: true, label: "Extensions" },
  core: { enabled: true, open: false, label: "API Reference" }
}
```

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
pnpm docs:build
pnpm dev
```

## Next Steps

See [Configuration](./02-configuration.md) for detailed setup options.
```

## Documentation Merge Strategy

### Additive, Not Override

**Key Principle:** Documentation sources are **additive**, not hierarchical.

```text
Core Docs (15 sections)
  +
Theme Docs (3 sections)
  +
Plugin A Docs (2 sections)
  +
Plugin B Docs (1 section)
  =
Total: 21 sections
```

### No Override Mechanism

Unlike component overrides, documentation **cannot override** core pages:

❌ **This does NOT work:**
```text
core/docs/01-fundamentals/01-overview.md
contents/themes/my-theme/docs/01-fundamentals/01-overview.md  ← Won't override
```

**Result:** Both files would appear as separate sections (not recommended).

**Rationale:**
- Core documentation describes actual system behavior
- Overriding would create confusion about system functionality
- Themes/plugins should document extensions, not replace core docs

### Independent Sections

Each source maintains independent sections:

```text
Navigation Sidebar:

📚 Core Documentation
  ├── Fundamentals
  ├── Registry System
  └── API Reference

🎨 Theme Documentation
  ├── Theme Overview      ← Theme-specific
  └── Customization

🧩 Plugin Documentation
  └── AI Plugin
      ├── Getting Started  ← Plugin-specific
      └── Features
```

## Cross-Referencing

### Linking to Core Docs

From theme or plugin documentation, link to core docs:

```markdown
<!-- In theme docs -->
For information about entities, see the [Entity System](/docs/core/entities/introduction).

<!-- In plugin docs -->
This plugin extends the [API System](/docs/core/api/introduction).
```

### Linking Between Plugins

**Avoid hard dependencies between plugins:**

❌ **Bad - Hard dependency:**
```markdown
<!-- In plugin-a/docs/ -->
This feature requires the [Analytics Plugin](/docs/plugins/analytics/setup).
```

✅ **Good - Conditional reference:**
```markdown
<!-- In plugin-a/docs/ -->
This feature integrates with the Analytics Plugin if installed. See Analytics documentation for details.
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

### Development vs Production

Documentation visibility can be configured independently for each category (Core, Theme, Plugins) using the `app.config.ts` configuration:

**Development Mode:**
```typescript
// All documentation visible for developers
export const appConfig = {
  documentation: {
    theme: { enabled: true, open: true, label: "Theme" },
    plugins: { enabled: true, open: true, label: "Plugins" },
    core: { enabled: true, open: true, label: "Core" },
  }
}
```

**Production Mode (End-User Focused):**
```typescript
// Hide technical docs, show only user-facing documentation
export const appConfig = {
  documentation: {
    theme: { enabled: true, open: true, label: "Help Center" },
    plugins: { enabled: false, open: false, label: "Plugins" },
    core: { enabled: false, open: false, label: "Core" },
    showPluginsDocsInProd: false  // Additional check for plugins
  }
}
```

**Production Mode (Public API Product):**
```typescript
// Show API docs and extensions, hide theme customization
export const appConfig = {
  documentation: {
    theme: { enabled: false, open: false, label: "Theme" },
    plugins: { enabled: true, open: false, label: "Extensions" },
    core: { enabled: true, open: true, label: "API Reference" },
  }
}
```

**Benefits:**
- Granular control over documentation visibility
- Different labels for different audiences
- Can show/hide entire categories
- Control default expansion state per category

### Per-Plugin Visibility

Currently, all plugins share the same visibility setting. To show/hide specific plugin docs, control which plugins are active:

```typescript
// theme.config.ts
export const themeConfig = {
  plugins: process.env.NODE_ENV === 'production'
    ? ['essential-plugin']  // Only essential in prod
    : ['essential-plugin', 'dev-plugin']  // All in dev
}
```

## Rebuilding Documentation

### When to Rebuild

Rebuild the documentation registry when:

- Adding new documentation files
- Renaming or reordering sections/pages
- Activating/deactivating plugins
- Changing active theme
- Modifying file/directory names

### Build Command

```bash
# Rebuild docs registry
pnpm docs:build

# Restart dev server
pnpm dev
```

**Automatic Rebuilds:**
- During `pnpm dev` startup
- During `pnpm build` for production
- When running `pnpm docs:build` explicitly

## Use Cases

### Public SaaS Platform

**Scenario:** Multi-tenant SaaS with themes and plugins

**Strategy:**
- Core docs: System architecture and APIs
- Theme docs: Customization and branding
- Plugin docs: Feature-specific guides
- Production: Show all documentation (`plugins.enabled: true`)

**Example Navigation:**
```text
Documentation
├── Core (System Features)
├── Theme (Customization)
└── Plugins
    ├── Analytics
    ├── AI Assistant
    └── Integrations
```

### White-Label Application

**Scenario:** Custom-branded instance for enterprise client

**Strategy:**
- Core docs: Technical documentation
- Theme docs: Brand-specific guidelines
- Plugin docs: Hidden in production (`plugins.enabled: false`)

**Example Navigation:**
```text
Documentation
├── Core (System Features)
└── Theme (Your Brand Guide)
```

### Internal Tool

**Scenario:** Internal company application

**Strategy:**
- Core docs: Minimal system docs
- Theme docs: Company-specific workflows
- Plugin docs: Internal integrations
- Production: Show all docs

## Troubleshooting

### Documentation Not Appearing

**Problem:** Added docs but don't see them in navigation

**Solution:**
1. Check file naming: `{order}-{slug}.md`
2. Check directory naming: `{order}-{slug}/`
3. Verify docs are in correct location
4. Rebuild registry: `pnpm docs:build`
5. Restart dev server

### Plugin Docs Missing

**Problem:** Plugin docs don't appear

**Check:**
1. Plugin is listed in `theme.config.ts` `plugins` array
2. Plugin `docs/` directory exists
3. Files follow naming convention
4. Registry rebuilt after adding plugin

**Production:**
- Check `documentation.plugins.enabled` in `app.config.ts`
- Verify `showPluginsDocsInProd` flag if using legacy check

### Wrong Theme Docs Showing

**Problem:** Seeing another theme's documentation

**Solution:**
1. Check `NEXT_PUBLIC_ACTIVE_THEME` environment variable
2. Verify theme name matches directory name
3. Rebuild registry: `pnpm docs:build`

## Next Steps

- **[Writing Documentation](./04-writing-documentation.md)** - Authoring standards
- **[Core vs Theme Docs](./03-core-vs-theme-docs.md)** - When to use each source
- **[Docs Registry](./05-docs-registry.md)** - Registry structure reference
