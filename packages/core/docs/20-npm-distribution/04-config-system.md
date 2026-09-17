# Configuration System

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

Generated projects use theme-scoped TypeScript configuration. `nextspark init`
selects the theme with `NEXT_PUBLIC_ACTIVE_THEME` in `.env` and creates the
configuration files under `contents/themes/<theme>/config/`.

## Generated Configuration

For a project whose active theme is `my-app`, the generated files are:

```text
contents/themes/my-app/config/
├── app.config.ts
├── billing.config.ts
├── dashboard.config.ts
├── dev.config.ts
├── features.config.ts
├── permissions.config.ts
└── theme.config.ts
```

The wizard does not create a root `nextspark.config.ts`.

## Optional Project-Level Configuration

**Location:** `nextspark.config.ts` (project root, optional and manually created)

Build tooling can read this optional file for project-level plugin and feature
overrides. Without it, plugins are read from the active theme's
`theme.config.ts` and the build uses its defaults.

```typescript
import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  // Active theme (required)
  theme: 'default',

  // Plugins to activate
  plugins: ['langchain', 'stripe'],

  // Feature flags
  features: {
    billing: true,
    teams: true,
    superadmin: true,
    aiChat: true
  },

  // Database configuration
  database: {
    provider: 'postgres',
    runMigrations: true
  },

  // Authentication settings
  auth: {
    providers: ['email', 'google'],
    requireEmailVerification: true
  },

  // App metadata
  app: {
    name: 'My SaaS',
    description: 'My awesome SaaS application'
  }
})
```

## TypeScript Interface

**File:** `packages/core/lib/config/nextspark-types.ts`

```typescript
export interface NextSparkConfig {
  /**
   * Active theme name (required)
   * @example 'default'
   */
  theme: string

  /**
   * Plugins to activate
   * @example ['langchain', 'stripe']
   */
  plugins?: string[]

  /**
   * Feature flags for conditional code
   */
  features?: {
    /** Enable billing/subscriptions system */
    billing?: boolean
    /** Enable multi-tenancy teams */
    teams?: boolean
    /** Enable superadmin panel */
    superadmin?: boolean
    /** Enable AI chat features */
    aiChat?: boolean
  }

  /**
   * Database configuration
   */
  database?: {
    provider: 'postgres' | 'mysql' | 'sqlite'
    runMigrations?: boolean
  }

  /**
   * Authentication configuration
   */
  auth?: {
    providers: ('email' | 'google' | 'github')[]
    requireEmailVerification?: boolean
  }

  /**
   * Application metadata
   */
  app?: {
    name?: string
    description?: string
  }
}

/**
 * Define configuration with type safety
 */
export function defineConfig(config: NextSparkConfig): NextSparkConfig {
  return config
}
```

## Project-Level Configuration Priority

Configuration values are resolved in this order:

1. **nextspark.config.ts** (optional project-level overrides)
2. **The active theme's `config/theme.config.ts`** (plugins)
3. **Built-in defaults** (core defaults)

### Example: Plugin Resolution

```javascript
// packages/core/scripts/build/registry/discovery/plugins.mjs

async function getActivePlugins(config) {
  // 1. Try nextspark.config.ts FIRST
  const nextsparkConfig = loadNextSparkConfigSync(config.projectRoot)
  if (nextsparkConfig?.plugins) {
    return nextsparkConfig.plugins
  }

  // 2. Fallback to theme.config.ts (backward compatibility)
  return await getActiveThemePlugins(config)
}
```

## Feature Flags

Feature flags conditionally include/exclude code during build:

### Available Flags

| Flag | Default | Description |
|------|---------|-------------|
| `billing` | `true` | Billing, subscriptions, pricing |
| `teams` | `true` | Multi-tenancy, team switching |
| `superadmin` | `true` | Superadmin panel |
| `aiChat` | `true` | AI chat components |

### Usage in Build Scripts

```javascript
// packages/core/scripts/build/registry/config.mjs

export function getConfig(projectRoot = null) {
  const root = projectRoot || detectProjectRoot()
  const nextsparkConfig = loadNextSparkConfigSync(root)

  return {
    projectRoot: root,
    activeTheme: process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default',
    features: nextsparkConfig?.features || {
      billing: true,
      teams: true,
      superadmin: true,
      aiChat: true
    }
  }
}
```

### Conditional Registry Generation

```javascript
// In registry generator
if (!CONFIG.features.billing) {
  // Skip billing-related entries
  entities = entities.filter(e => !e.slug.startsWith('billing'))
}

if (!CONFIG.features.teams) {
  // Skip team-related route handlers
  routes = routes.filter(r => !r.path.includes('/teams'))
}
```

## Theme Configuration

The generated project selects its active theme with an environment variable:

```bash
# .env
NEXT_PUBLIC_ACTIVE_THEME=default
```

**Why environment variable for deployments?**

1. Theme must be known BEFORE config is loaded for CSS compilation
2. Allows different themes per deployment environment
3. Works with CI/CD pipelines

## Loading Config at Runtime

For runtime access to the merged application configuration, import the
generated-aware synchronous config:

```typescript
import { APP_CONFIG_MERGED } from '@nextsparkjs/core/lib/config/config-sync'

console.log(APP_CONFIG_MERGED.app.name)
```

## Optional Project-Level Plugin Override

The generated theme keeps its plugin list in `theme.config.ts`:

```typescript
// contents/themes/default/config/theme.config.ts
export default {
  plugins: ['langchain']
}
```

If you intentionally add the optional project-level file, its plugin list takes
precedence during registry generation:

```typescript
// nextspark.config.ts (manual, not generated by the wizard)
import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  theme: 'default',
  plugins: ['langchain']
})
```

## Troubleshooting

### Config Not Loading

Check which theme is active and list the configuration generated for it:

```bash
theme=$(sed -n 's/^NEXT_PUBLIC_ACTIVE_THEME=//p' .env | tr -d '"')
ls "contents/themes/$theme/config"
```

### Plugins Not Activating

1. Verify plugin exists in `contents/plugins/`
2. Check the active theme's `config/theme.config.ts` has the correct plugin name
3. Run `pnpm build:registries` to regenerate

### Features Not Disabling

Features default to `true`. To disable:

```typescript
export default defineConfig({
  features: {
    billing: false,  // Explicitly disable
    teams: false
  }
})
```

## Related

- [03-build-scripts.md](./03-build-scripts.md) - Build system
- [05-cli-tool.md](./05-cli-tool.md) - CLI commands
