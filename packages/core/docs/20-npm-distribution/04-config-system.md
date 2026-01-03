# Configuration System

NextSpark uses a TypeScript-based configuration system via `nextspark.config.ts`.

## Configuration File

**Location:** `nextspark.config.ts` (project root, optional)

> **Note:** This config file is optional. If not present, default values will be used and plugins will be read from `theme.config.ts`.

```typescript
import { defineConfig } from '@/core/lib/config'

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

## Configuration Priority

Configuration values are resolved in this order:

1. **nextspark.config.ts** (explicit configuration)
2. **theme.config.ts** (theme defaults, for plugins)
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

The active theme can be set in two places:

1. **Environment variable (preferred for deployment):**
```bash
# .env
NEXT_PUBLIC_ACTIVE_THEME=default
```

2. **Config file:**
```typescript
// nextspark.config.ts
export default defineConfig({
  theme: 'default'
})
```

**Resolution order:**
1. `NEXT_PUBLIC_ACTIVE_THEME` environment variable (takes precedence)
2. `theme` in `nextspark.config.ts`
3. Falls back to `'default'`

**Why environment variable for deployments?**

1. Theme must be known BEFORE config is loaded for CSS compilation
2. Allows different themes per deployment environment
3. Works with CI/CD pipelines

## Loading Config at Runtime

For runtime config access, use the config service:

```typescript
// Server-side
import { getConfig } from '@/core/lib/config'

const config = getConfig()
console.log(config.features.billing) // true

// Client-side (limited)
import { useConfig } from '@/core/hooks/useConfig'

function Component() {
  const { appName } = useConfig()
  return <h1>{appName}</h1>
}
```

## Migrating from theme.config.ts

If you have plugins defined in `theme.config.ts`:

```typescript
// OLD: contents/themes/default/config/theme.config.ts
export default {
  plugins: ['langchain']
}

// NEW: nextspark.config.ts (root)
export default defineConfig({
  plugins: ['langchain']
})
```

Both work, but `nextspark.config.ts` takes precedence.

## Troubleshooting

### Config Not Loading

Check file exists and has correct syntax:

```bash
cat nextspark.config.ts
```

### Plugins Not Activating

1. Verify plugin exists in `contents/plugins/`
2. Check `nextspark.config.ts` has correct plugin name
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
