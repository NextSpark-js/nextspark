# Directory Structure

## Introduction

The project follows a clear separation between **core** (stable application code) and **contents** (pluggable themes, plugins, entities). This architecture enables extensibility without modifying core code.

## Root Directory

```text
nextspark/
├── .rules/                   # Claude Code development rules
├── .claude/                  # Claude Code configuration
├── .next/                    # Next.js build output (auto-generated)
├── .github/                  # GitHub Actions, workflows
├── core/migrations/          # Database migrations
├── scripts/                  # Build scripts
├── test/                     # Test files
├── core/                     # Core application (stable)
├── app/                      # Next.js App Router
├── contents/                 # Pluggable content
├── public/                   # Static assets
├── _docs/                    # Legacy documentation
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── middleware.ts             # Next.js middleware
├── CLAUDE.md                 # AI development guide
└── README.md                 # Project readme
```

---

## Core Directory (`core/`)

**Purpose:** Stable, versioned application code that rarely changes.

```text
core/
├── lib/                      # Business logic (detailed in 02-core-lib-organization.md)
├── types/                    # TypeScript type definitions
├── components/               # Reusable UI components
│   ├── ui/                  # shadcn/ui base components
│   ├── auth/                # Authentication components
│   ├── dashboard/           # Dashboard components
│   ├── entities/            # Entity UI components
│   ├── docs/                # Documentation components
│   └── settings/            # Settings components
├── hooks/                    # React hooks
├── contexts/                 # React Context providers
├── providers/                # Next.js providers
├── messages/                 # Core translations
│   ├── en/                  # English
│   └── es/                  # Spanish
├── utils/                    # Utility functions
├── globals.css              # Global styles
└── docs/                    # Public documentation
```

**Key Principles:**
- **Stability**: Core changes infrequently
- **Reusability**: Components work across themes
- **Type Safety**: All types defined in `core/types/`
- **i18n**: Multi-locale support built-in

---

## App Directory (`app/`)

**Purpose:** Next.js 15 App Router with route groups and layouts.

```text
app/
├── (public)/                 # Public routes (no auth)
│   ├── page.tsx             # Landing page
│   ├── login/
│   ├── signup/
│   ├── forgot-password/
│   ├── verify-email/
│   └── docs/                # Public documentation
├── dashboard/                # Protected dashboard
│   ├── page.tsx
│   ├── tasks/
│   └── [entity]/            # Dynamic entity pages
├── admin/                    # Admin panel (admin role)
├── admin/                  # Superadmin (superadmin role)
├── settings/                 # User settings
├── profile/                  # User profile
├── api/                      # API routes
│   ├── v1/                  # API v1
│   │   ├── [entity]/        # Dynamic CRUD endpoints
│   │   ├── users/           # User management
│   │   ├── api-keys/        # API key management
│   │   └── (contents)/      # Custom overrides
│   └── auth/                # Better Auth routes
├── layout.tsx               # Root layout
├── page.tsx                 # Root page
└── not-found.tsx            # 404 page
```

**Route Groups:**
- `(public)/` - No authentication required
- `dashboard/` - Requires authentication
- `admin/` - Requires admin role
- `admin/` - Requires superadmin role

---

## Contents Directory (`contents/`)

**Purpose:** Pluggable, swappable content (themes, plugins, entities).

```text
contents/
├── themes/                   # Theme system
│   └── default/             # Default theme
│       ├── config/          # All configuration files
│       │   ├── theme.config.ts      # Theme metadata
│       │   ├── app.config.ts        # App overrides
│       │   ├── dashboard.config.ts  # Dashboard config
│       │   ├── permissions.config.ts # Permissions
│       │   └── billing.config.ts    # Billing/plans
│       ├── styles/          # Theme CSS
│       ├── public/          # Theme assets
│       │   ├── brand/       # Logos, brand
│       │   ├── images/
│       │   ├── fonts/
│       │   └── docs/
│       ├── entities/        # Theme entities
│       │   └── tasks/
│       │       ├── tasks.config.ts
│       │       ├── tasks.fields.ts
│       │       ├── tasks.types.ts
│       │       ├── tasks.service.ts
│       │       ├── messages/
│       │       ├── migrations/
│       │       └── components/
│       ├── messages/        # Theme translations
│       │   ├── en.json
│       │   └── es.json
│       └── templates/       # Page templates
└── plugins/                  # Plugin ecosystem
    ├── ai/                  # AI plugin
    │   ├── plugin.config.ts
    │   ├── .env
    │   ├── lib/
    │   ├── components/
    │   ├── hooks/
    │   ├── api/
    │   └── migrations/
    ├── amplitude/           # Analytics
    ├── billing/             # Payments
    └── social-media-publisher/
```

**Activation:**
```bash
# .env.local
NEXT_PUBLIC_ACTIVE_THEME=default
```

---

## Scripts Directory (`scripts/`)

**Purpose:** Build-time automation scripts.

```text
scripts/
├── build-registry.mjs       # Registry generation (CRITICAL)
├── build-theme.mjs          # Theme CSS compilation
├── build-docs-registry.mjs  # Docs indexing
├── run-migrations.mjs       # Database migrations
├── verify-tables.mjs        # DB verification
├── check-dynamic-imports.sh # Import validation
└── create-theme.ts          # Theme scaffolding
```

**Key Scripts:**
- `build-registry.mjs` - Generates all registries (~17,255x perf improvement)
- `build-theme.mjs` - Compiles theme CSS and copies assets
- `run-migrations.mjs` - Runs database migrations

---

## Test Directory (`test/`)

**Purpose:** Comprehensive test suites.

```text
test/
├── jest/                    # Unit tests
│   ├── api/
│   ├── hooks/
│   ├── lib/
│   └── components/
└── cypress/                # E2E tests
    ├── e2e/
    │   ├── auth/
    │   ├── dashboard/
    │   └── tasks/
    ├── fixtures/
    └── support/
```

---

## Auto-Generated Directories

**⚠️ NEVER EDIT THESE MANUALLY:**

### `.next/`
Next.js build output - regenerated on every build.

### `core/lib/registries/`
Auto-generated by `build-registry.mjs` - contains all registries.

### `app/theme-styles.css`
Auto-generated by `build-theme.mjs` - theme CSS output.

### `public/theme/`
Auto-generated - theme assets copied from `contents/themes/[theme]/public/`.

---

## Path Aliases

Configured in `tsconfig.json`:

```typescript
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/core/*": ["./core/*"],
      "@/contents/*": ["./contents/*"]
    }
  }
}
```

**Usage:**
```typescript
// ✅ Correct
import { UserService } from '@/core/lib/services/user.service'
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'

// ❌ Wrong - Never import from @/contents directly
import { config } from '@/contents/themes/default/config/theme.config'
```

---

## Core vs Contents Philosophy

### Core (Immutable)
**Location:** `core/`
**Purpose:** Stable application foundation
**Contains:**
- UI components
- Business logic
- Type definitions
- Core utilities

**Update Frequency:** Infrequent (version updates)

### Contents (Swappable)
**Location:** `contents/`
**Purpose:** Pluggable customizations
**Contains:**
- Themes
- Plugins
- Entities

**Update Frequency:** Frequent (per-project customization)

### Benefits

1. **Modularity** - Clear separation of concerns
2. **Extensibility** - Add features without core changes
3. **Maintainability** - Core updates don't break content
4. **Scalability** - Multiple themes/plugins per project
5. **Testability** - Test core and contents independently

---

## File Organization Patterns

### Entities

Each entity has a standard structure with **4 required files**:

```text
contents/themes/[theme]/entities/[entity]/
├── [entity].config.ts       # Entity configuration (required)
├── [entity].fields.ts       # Field definitions (required)
├── [entity].types.ts        # TypeScript types (required)
├── [entity].service.ts      # Data access service (required)
├── messages/                # Entity translations (required)
│   ├── en.json
│   └── es.json
├── migrations/              # Entity migrations (optional)
│   └── 001_create_[entity].sql
├── components/              # Custom UI components (optional)
│   └── [Entity]Header.tsx
└── hooks/                   # Custom hooks (optional)
```

**Required Files:**
- `[entity].config.ts` - Defines slug, access, UI, permissions, i18n
- `[entity].fields.ts` - Defines field names, types, display options
- `[entity].types.ts` - TypeScript interfaces for type safety
- `[entity].service.ts` - Data access methods (queries with RLS)
- `messages/` - Internationalization files

### Components
```text
core/components/[domain]/
├── [Component].tsx          # Component file
├── [Component].test.tsx     # Tests
└── index.ts                 # Exports
```

### Services
```text
core/lib/services/
├── [service].service.ts     # Service implementation
└── [service].service.test.ts # Service tests
```

---

## Migration Directories

### Database Migrations
```text
core/migrations/
├── 001_initial_schema.sql
├── 002_add_metadata.sql
└── README.md
```

### Entity Migrations
```text
contents/themes/[theme]/entities/[entity]/migrations/
└── 001_create_[entity].sql
```

### Plugin Migrations
```text
contents/plugins/[plugin]/migrations/
└── 001_plugin_tables.sql
```

---

## Public Assets

### Core Assets
```text
public/
├── favicon.ico
├── robots.txt
└── sitemap.xml
```

### Theme Assets (Auto-copied)
```text
public/theme/               # Auto-generated from theme/public/
├── brand/
│   └── logo.svg
├── images/
├── fonts/
└── docs/
```

**Access in code:**
```typescript
// Theme assets
<img src="/theme/brand/logo.svg" alt="Logo" />

// Core assets
<link rel="icon" href="/favicon.ico" />
```

---

## Summary

**Key Directories:**
- **core/** - Stable application code
- **app/** - Next.js App Router
- **contents/** - Pluggable themes/plugins/entities
- **scripts/** - Build automation
- **test/** - Test suites

**Auto-Generated (Never Edit):**
- `.next/`
- `core/lib/registries/`
- `app/theme-styles.css`
- `public/theme/`

**Path Aliases:**
- `@/` - Project root
- `@/core/` - Core directory
- `@/contents/` - Contents directory (use registries instead)

**Philosophy:**
- Core = Stable, versioned
- Contents = Pluggable, swappable
- Registries = Bridge between them (build-time)

**Next:** [Architecture Patterns](./04-architecture-patterns.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete