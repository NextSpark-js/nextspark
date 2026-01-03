# Core vs Theme Documentation

## Introduction

The documentation system supports multiple documentation sources, each serving different purposes. Understanding when to document in **core**, **theme**, or **plugin** directories is essential for maintaining clear, organized, and maintainable documentation.

This document explains the differences between documentation sources, their intended use cases, and best practices for organization.

## Documentation Sources

### Core Documentation (`core/docs/`)

**Purpose:** System-level documentation that applies to all themes and implementations

**Scope:**
- Core architecture and patterns
- Registry system internals
- Entity system configuration
- API reference and endpoints
- Authentication and authorization
- Database schema and migrations
- Testing frameworks
- Deployment processes
- Internationalization system
- Plugin system architecture

**Characteristics:**
- **Universal:** Applies regardless of theme choice
- **Technical:** Focused on system internals and APIs
- **Maintained:** Core team responsibility
- **Stable:** Changes infrequently, version-controlled

**Example Topics:**
```text
core/docs/
├── 01-fundamentals/
│   ├── 01-project-overview.md
│   └── 04-architecture-patterns.md
├── 03-registry-system/
│   └── 01-introduction.md
├── 04-entities/
│   └── 01-introduction.md
└── 05-api/
    └── 02-authentication.md
```

### Theme Documentation (`contents/themes/[theme]/docs/`)

**Purpose:** Theme-specific documentation for customization, branding, and features

**Scope:**
- Theme-specific features
- Custom components unique to theme
- Styling and design system
- Theme configuration options
- Page templates and layouts
- Brand guidelines
- Theme-specific workflows
- Custom entity implementations

**Characteristics:**
- **Theme-Specific:** Only relevant to this theme
- **User-Focused:** Aimed at theme customizers
- **Independent:** Each theme maintains its own docs
- **Flexible:** Can change frequently with theme updates

**Example Topics:**
```text
contents/themes/custom-theme/docs/
├── 01-overview/
│   ├── 01-introduction.md
│   └── 02-getting-started.md
├── 02-customization/
│   ├── 01-colors-typography.md
│   └── 02-component-overrides.md
└── 03-features/
    └── 01-custom-dashboard.md
```

### Plugin Documentation (`contents/plugins/[plugin]/docs/`)

**Purpose:** Plugin-specific documentation for features and integration

**Scope:**
- Plugin capabilities and features
- Installation and configuration
- API extensions provided by plugin
- Integration examples
- Plugin-specific entities
- Configuration options
- Troubleshooting guide

**Characteristics:**
- **Plugin-Scoped:** Only relevant when plugin is active
- **Feature-Focused:** Documents plugin functionality
- **Conditional:** Only shown when plugin is enabled
- **Self-Contained:** Independent of other plugins

**Example Topics:**
```text
contents/plugins/ai/docs/
├── 01-overview/
│   ├── 01-introduction.md
│   └── 02-capabilities.md
├── 02-setup/
│   └── 01-configuration.md
└── 03-features/
    ├── 01-chat-interface.md
    └── 02-embeddings.md
```

## When to Use Each Source

### Use Core Documentation When:

✅ **The topic applies to all implementations**
- System architecture
- Core APIs and endpoints
- Database structure
- Authentication flows

✅ **The feature is part of the core system**
- Registry system
- Entity system
- Plugin system
- Theme system

✅ **The documentation is technical**
- Developer guides
- API references
- Architecture deep-dives
- Performance optimization

❌ **Do NOT use for:**
- Theme-specific styling
- Custom components unique to a theme
- Brand-specific guidelines
- Plugin-specific features

### Use Theme Documentation When:

✅ **The topic is theme-specific**
- Custom page layouts
- Theme-specific components
- Design system and styling
- Brand guidelines

✅ **The feature only exists in this theme**
- Custom dashboard widgets
- Theme-specific entities
- Unique user flows
- Special integrations

✅ **The documentation is for theme users**
- Customization guides
- Theme configuration
- Component usage
- Styling patterns

❌ **Do NOT use for:**
- Core system features
- Universal patterns
- API documentation
- Database structure

### Use Plugin Documentation When:

✅ **The topic is plugin-specific**
- Plugin features and capabilities
- Plugin configuration
- Plugin-specific APIs
- Plugin entities

✅ **The documentation is for plugin users**
- Setup and installation
- Feature guides
- Integration examples
- Configuration reference

✅ **The plugin extends core functionality**
- New API endpoints
- Additional entities
- Custom workflows
- Third-party integrations

❌ **Do NOT use for:**
- Core system modifications
- Theme-specific features
- Universal patterns

## Documentation Hierarchy

### Navigation Organization

Documentation appears in the sidebar grouped by source:

```text
Documentation
│
├── 📚 Core Documentation
│   ├── Fundamentals
│   ├── Getting Started
│   ├── Registry System
│   └── ...
│
├── 🎨 Theme Documentation
│   ├── Theme Overview
│   ├── Customization
│   └── ...
│
└── 🧩 Plugin Documentation
    ├── AI Plugin
    │   ├── Overview
    │   └── Features
    └── Analytics Plugin
        └── ...
```

### URL Structure

Each source has its own URL namespace:

```text
/docs/core/[section]/[page]           → Core docs
/docs/theme/[section]/[page]          → Theme docs
/docs/plugins/[plugin]/[section]/[page] → Plugin docs
```

This prevents naming conflicts and maintains clear separation.

## Merge and Override Patterns

### No Override Mechanism

Unlike code components, **documentation does not support overriding**:

- Themes cannot override core documentation pages
- Plugins cannot override core or theme documentation
- Each source maintains independent documentation

**Rationale:**
- Core documentation describes system behavior
- Theme/plugin docs describe extensions
- Overriding would create confusion about actual system behavior

### Additive Pattern

Documentation sources are **additive**:

```text
Core Docs (15 sections)
  +
Theme Docs (3 sections)
  +
Plugin Docs (AI: 2 sections, Analytics: 1 section)
  =
Total: 21 sections in navigation
```

### Cross-Referencing

Documentation can reference other sources:

```markdown
<!-- In theme docs -->
For core API authentication, see [API Authentication](../core/api/authentication.md)

<!-- In plugin docs -->
This plugin extends the [Entity System](../../core/entities/introduction.md)
```

## Best Practices

### Organizing Core Documentation

**DO:**
- ✅ Document system-wide patterns
- ✅ Provide comprehensive API references
- ✅ Include code examples applicable to all themes
- ✅ Maintain stable, version-controlled docs

**DON'T:**
- ❌ Include theme-specific examples
- ❌ Document theme implementation details
- ❌ Reference theme-specific components
- ❌ Include branding or style guides

### Organizing Theme Documentation

**DO:**
- ✅ Document theme-specific features
- ✅ Provide customization examples
- ✅ Include styling and design guidelines
- ✅ Reference core docs where applicable

**DON'T:**
- ❌ Duplicate core documentation
- ❌ Document core system behavior
- ❌ Include plugin-specific content
- ❌ Contradict core documentation

### Organizing Plugin Documentation

**DO:**
- ✅ Document plugin capabilities clearly
- ✅ Provide integration examples
- ✅ Include configuration reference
- ✅ Explain plugin-specific concepts

**DON'T:**
- ❌ Duplicate core system docs
- ❌ Document other plugins
- ❌ Include theme-specific examples
- ❌ Assume other plugins are installed

### Naming Conventions

**Maintain consistent naming across sources:**

```text
core/docs/
└── 04-entities/
    └── 01-introduction.md

contents/themes/custom/docs/
└── 03-custom-entities/
    └── 01-overview.md       ← Different name to avoid confusion

contents/plugins/ai/docs/
└── 01-ai-entities/
    └── 01-introduction.md   ← Prefixed with plugin context
```

### Content Duplication

**Avoid duplicating content across sources:**

❌ **Bad - Duplication:**
```markdown
<!-- core/docs/api/authentication.md -->
# API Authentication
Authentication uses Bearer tokens...

<!-- theme/docs/api/authentication.md -->
# API Authentication
Authentication uses Bearer tokens...  ← Duplicate
```

✅ **Good - Cross-Reference:**
```markdown
<!-- theme/docs/customization/api-styling.md -->
# Styling API Response Components

For API authentication details, see [Core API Authentication](/docs/core/api/authentication)

This theme provides custom styling for...
```

## Production Considerations

### Documentation Visibility Configuration

All documentation categories can be controlled individually via `app.config.ts`:

```typescript
export const appConfig = {
  documentation: {
    // Theme documentation - Usually visible in production
    theme: {
      enabled: true,        // Show theme docs
      open: true,           // Expanded by default
      label: "User Guide",  // User-friendly label
    },

    // Plugin documentation - Typically hidden in production
    plugins: {
      enabled: false,          // Hide plugin docs from end users
      open: false,
      label: "Plugins",
    },

    // Core documentation - Usually hidden in production
    core: {
      enabled: false,       // Hide technical core docs
      open: false,
      label: "Core",
    },

    // Legacy/additional check for plugin visibility
    showPluginsDocsInProd: false,
  }
}
```

**Common Production Configurations:**

```typescript
// End-user focused (e-commerce, SaaS)
documentation: {
  theme: { enabled: true, open: true, label: "Help Center" },
  plugins: { enabled: false, open: false, label: "Plugins" },
  core: { enabled: false, open: false, label: "Core" }
}

// Developer/technical product
documentation: {
  theme: { enabled: true, open: true, label: "Customization" },
  plugins: { enabled: true, open: false, label: "Extensions" },
  core: { enabled: true, open: false, label: "API Reference" }
}

// Internal tool (all docs visible)
documentation: {
  theme: { enabled: true, open: true, label: "Theme Docs" },
  plugins: { enabled: true, open: true, label: "Plugin Docs" },
  core: { enabled: true, open: false, label: "Core Docs" }
}
```

**Visibility Control:**

| Category | Development | Production (Typical) | Use Case |
|----------|-------------|---------------------|----------|
| **Theme** | ✅ Visible | ✅ Visible | End-user customization guides |
| **Plugins** | ✅ Visible | ❌ Hidden | Internal implementation details |
| **Core** | ✅ Visible | ❌ Hidden | System architecture reference |

**Best Practices:**
- **`theme.enabled: true`** - Keep theme docs visible for user customization
- **`plugins.enabled: false`** - Hide plugins docs unless public API
- **`core.enabled: false`** - Hide core docs from end users
- Use descriptive `label` values for production (e.g., "Help Center" instead of "Theme")

### Theme Documentation

Theme documentation is always included when the theme is active. Consider:

- Public themes: Comprehensive customization guides
- Internal themes: Minimal documentation, focus on core

## Next Steps

- **[Writing Documentation](./04-writing-documentation.md)** - Standards and conventions
- **[Docs Registry](./05-docs-registry.md)** - Registry structure
- **[Extending Documentation](./07-extending-overriding.md)** - Adding theme/plugin docs
