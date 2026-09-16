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

Only the **active theme's** own docs are ever rendered. The docs registry
(`core/scripts/build/registry/generators/docs-registry.mjs`) scans
`contents/themes/<active theme>/docs/public/` and
`.../docs/superadmin/`; nothing else feeds it. Core's own `core/docs/` (this
directory tree) and any plugin's `contents/plugins/<plugin>/docs/` are never
scanned, so they have no page, no route, and no entry in either sidebar -
they exist purely as reference material for someone reading the source tree.

### URL Structure

```text
/docs/[section]/[page]                → active theme's docs/public/
/superadmin/docs/[section]/[page]     → active theme's docs/superadmin/
```

Core and plugin docs have no URL at all.

## No Override Mechanism

Unlike code components, **documentation does not support overriding**:

- A theme's docs are its own; nothing merges into or out of them
- Core and plugin docs never reach a route, so there is nothing to override
- Each source maintains independent documentation

**Rationale:**
- Core documentation describes system behavior
- Theme/plugin docs describe extensions
- Overriding would create confusion about actual system behavior

### Cross-Referencing

A relative link only resolves when both files live in the same docs tree
(`docs/public/` or `docs/superadmin/` of the same theme) - the remark plugin
that rewrites `./page.md` links into routes
(`core/lib/docs/remark-doc-links.ts`) leaves anything that escapes that tree
untouched, because there is no route on the other end to point at:

```markdown
<!-- In theme docs: resolves, both files are in the theme's own docs/public/ -->
See [Customization](../02-customization/01-overview.md)

<!-- In theme docs: does NOT resolve - core/docs/ is never served -->
For core API authentication, see the "API Authentication" page in core/docs/
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

For API authentication details, see core's own API Authentication documentation

This theme provides custom styling for...
```

## Production Considerations

### Documentation Visibility Configuration

Since only the active theme's own `docs/public/` and `docs/superadmin/` are
ever served, the `docs` block of `app.config.ts` (`DocsConfig` in
`core/lib/config/types.ts`) only controls those two categories - there is no
`theme`/`plugins`/`core` split to configure, because core and plugin docs
never reach a route in the first place:

```typescript
export const appConfig = {
  docs: {
    enabled: true,
    publicAccess: true,      // false: /docs asks for a session
    searchEnabled: true,
    breadcrumbs: true,

    // /docs - the active theme's docs/public/
    public: { enabled: true, open: true, label: 'Help Center' },

    // /superadmin/docs - the active theme's docs/superadmin/
    superadmin: { enabled: true, open: false, label: 'Admin Docs' },
  },
}
```

**Best Practices:**
- **`publicAccess`** - `false` when `/docs` is for signed-in users only;
  `/superadmin/docs` already sits behind the superadmin guard either way
- **`public.enabled: true`** - Keep the `/docs` sidebar rendered
- Use a descriptive `public.label` in production (e.g. "Help Center"): it is
  the heading of the `/docs` sidebar

### Theme Documentation

Theme documentation is always included when the theme is active. Consider:

- Public themes: Comprehensive customization guides
- Internal themes: Minimal documentation, focus on core

## Next Steps

- **[Writing Documentation](./04-writing-documentation.md)** - Standards and conventions
- **[Docs Registry](./05-docs-registry.md)** - Registry structure
- **[Extending Documentation](./07-extending-overriding.md)** - Adding theme/plugin docs
