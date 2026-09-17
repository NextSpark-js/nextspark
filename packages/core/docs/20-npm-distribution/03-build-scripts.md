# Build Scripts

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

The build scripts in `packages/core/scripts/build/` handle registry generation, theme compilation, and app scaffolding.

## Script Locations

```
packages/core/scripts/
├── generate-app.mjs           # App directory scaffolding (root level)
├── create-plugin.mjs          # Plugin creation wizard
├── create-theme.mjs           # Theme creation wizard
├── build/
│   ├── registry.mjs           # Main registry orchestrator (includes docs registry)
│   ├── theme.mjs              # Theme CSS compilation
│   ├── config-loader.mjs      # Config file loading
│   ├── update-tsconfig.mjs    # TypeScript config updates
│   └── registry/
│       ├── config.mjs         # Registry configuration
│       ├── index.mjs          # Registry exports
│       ├── watch.mjs          # File watcher for dev
│       ├── discovery/         # Entity/theme/plugin discovery
│       ├── generators/        # Registry file generators
│       ├── post-build/        # Post-generation steps
│       └── validation/        # Registry validation
├── setup/
│   ├── npm-postinstall.mjs    # npm postinstall hook
│   ├── postinstall.mjs        # General postinstall
│   └── setup-ci.mjs           # CI/CD workflow setup
├── db/
│   ├── run-migrations.mjs     # Database migrations
│   ├── verify-tables.mjs      # Better Auth table inspection
│   └── verify-teams.mjs       # Teams verification
├── test/
│   ├── build-entities.mjs     # Test fixture generation
│   ├── cy.mjs                 # Cypress test runner
│   └── jest.mjs               # Jest test runner
├── deploy/
│   ├── vercel-deploy.mjs      # Vercel deployment
│   ├── release-version.mjs    # Version release
│   └── deploy.sh              # Deploy shell script
├── dev/                       # Development utilities
├── maintenance/               # Maintenance scripts
├── utils/                     # Utility functions
└── validation/                # Validation utilities
```

## Path Resolution

All scripts must correctly resolve the project root. The pattern:

```javascript
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Path levels up to project root depends on script location:
// packages/core/scripts/build/          → 4 levels up
// packages/core/scripts/build/registry/ → 5 levels up
// packages/core/scripts/build/registry/generators/ → 6 levels up

const ROOT_DIR = join(__dirname, '../../../..')  // Adjust per location
```

### Path Level Reference

| Script Location | Levels Up | Example |
|-----------------|-----------|---------|
| `scripts/build/*.mjs` | 4 | `'..', '..', '..', '..'` |
| `scripts/build/registry/config.mjs` | 5 | `'..', '..', '..', '..', '..'` |
| `scripts/build/registry/generators/*.mjs` | 6 | `'../../../../../..'` |
| `scripts/build/registry/post-build/*.mjs` | 6 | `'../../../../../..'` |
| `scripts/setup/*.mjs` | 4 | `'..', '..', '..', '..'` |
| `scripts/db/*.mjs` | 4 | `'..', '..', '..', '..'` |

## Main Registry Script

**File:** `packages/core/scripts/build/registry.mjs`

```javascript
#!/usr/bin/env node

/**
 * Registry Builder - Main Orchestrator
 *
 * Generates all registries at build time:
 * - entity-registry.ts
 * - theme-registry.ts
 * - plugin-registry.ts
 * - translation-registry.ts
 * - template-registry.ts
 * - permissions-registry.ts
 */

import { getConfig } from './registry/config.mjs'

const CONFIG = getConfig()

async function main() {
  console.log('🏗️  Building registries...')

  // 1. Discovery phase
  const entities = await discoverEntities(CONFIG)
  const plugins = await discoverPlugins(CONFIG)
  const translations = await discoverTranslations(CONFIG)

  // 2. Generation phase
  await generateEntityRegistry(entities)
  await generatePluginRegistry(plugins)
  await generateTranslationRegistry(translations)
  await generateTemplateRegistry()
  await generatePermissionsRegistry()

  // 3. Post-build phase
  await runPostBuildHooks()

  console.log('✅ Registries built successfully')
}

main().catch(console.error)
```

## Config Loader

**File:** `packages/core/scripts/build/config-loader.mjs`

Provides synchronous config loading for build scripts:

```javascript
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Load nextspark.config.ts synchronously
 * Uses regex parsing since we can't use ESM imports synchronously
 */
export function loadNextSparkConfigSync(projectRoot) {
  const configPath = join(projectRoot, 'nextspark.config.ts')

  if (!existsSync(configPath)) {
    return null
  }

  const content = readFileSync(configPath, 'utf-8')

  // Parse plugins array
  const pluginsMatch = content.match(/plugins:\s*\[([^\]]*)\]/)
  const plugins = pluginsMatch
    ? pluginsMatch[1].split(',').map(p => p.trim().replace(/['"]/g, '')).filter(Boolean)
    : undefined

  // Parse features object
  const features = {
    billing: !content.includes('billing: false'),
    teams: !content.includes('teams: false'),
    superadmin: !content.includes('superadmin: false'),
    aiChat: !content.includes('aiChat: false')
  }

  return { plugins, features }
}
```

## Theme Script

**File:** `packages/core/scripts/build/theme.mjs`

Compiles theme CSS from the active theme:

```javascript
#!/usr/bin/env node

/**
 * Theme CSS Compiler
 *
 * Reads: contents/themes/{ACTIVE_THEME}/styles/
 * Writes: .next/theme-generated.css and syncs app/globals.css
 */

const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'

async function buildTheme() {
  const themeStylesDir = join(ROOT_DIR, 'contents/themes', activeTheme, 'styles')
  const outputPath = join(ROOT_DIR, '.next/theme-generated.css')

  // Concatenate all CSS files
  const cssFiles = await glob(join(themeStylesDir, '**/*.css'))
  const combined = await Promise.all(
    cssFiles.map(f => readFile(f, 'utf-8'))
  )

  await writeFile(outputPath, combined.join('\n'))
}
```

## Generate App Script

**File:** `packages/core/scripts/generate-app.mjs` (root of scripts folder, not in build/)

Generates the `app/` directory from EJS templates:

```javascript
#!/usr/bin/env node

/**
 * App Directory Generator
 *
 * Uses EJS templates to generate Next.js app directory.
 * Theme templates have PRIORITY over core templates.
 */

export async function generateApp(projectRoot) {
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'

  // Template sources (priority order)
  const themeTemplates = join(projectRoot, 'contents/themes', activeTheme, 'templates/app')
  const coreTemplates = join(projectRoot, 'packages/core/templates/app')

  // Process each template
  for (const template of templates) {
    // Theme templates override core templates
    const source = existsSync(join(themeTemplates, template))
      ? join(themeTemplates, template)
      : join(coreTemplates, template)

    await processEjsTemplate(source, destination, templateData)
  }
}
```

## Running Scripts

### From Root

```bash
# Registry generation
pnpm build:registries

# Application build (compiles the theme CSS imported by app/globals.css)
pnpm build
```

### In the NextSpark Monorepo

```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
cd ../.. && pnpm build
```

Neither generated projects nor the monorepo expose a separate theme-build
command. Next.js compiles the active theme stylesheet imported by
`app/globals.css`; registry generation remains a separate step.

## Environment Variables

Scripts respect these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_ACTIVE_THEME` | `default` | Active theme name |
| `NODE_ENV` | `development` | Build mode |
| `DATABASE_URL` | - | Database connection |

## Troubleshooting

### Script Fails with "Cannot find module"

Check that `rootDir` is correctly calculated:

```javascript
// Debug: Print resolved paths
console.log('__dirname:', __dirname)
console.log('ROOT_DIR:', ROOT_DIR)
console.log('Config path:', join(ROOT_DIR, 'nextspark.config.ts'))
```

### Registry Files Not Updating

Ensure you're writing to the correct location:

```javascript
// Output should be in packages/core/lib/registries/
const outputDir = join(ROOT_DIR, 'packages/core/lib/registries')
```

## Related

- [04-config-system.md](./04-config-system.md) - Configuration
- [06-path-resolution.md](./06-path-resolution.md) - Path handling
