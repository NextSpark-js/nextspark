# Build Registry Script

## Introduction

`core/scripts/build/registry.mjs` is the **modular powerhouse** that transforms runtime I/O into build-time static registries. Originally a 5,487-line monolith, it has been refactored into **38 focused modules** for maintainability. This document explains how this critical script discovers, processes, and generates all 16 registry files that power the entire system.

**Script location:** `core/scripts/build/registry.mjs` (entry point, 270 lines)
**Module structure:** `core/scripts/build/registry/` (38 modules)
**Purpose:** Unified build-time registry generation
**Performance:** ~5-10 seconds build time, enables 17,255x runtime improvement

---

## Overview

### What It Does

**The script is a 4-phase pipeline, now organized into 38 modules:**

```text
Phase 1: Discovery (core/scripts/build/registry/discovery/)
├─> parent-child.mjs    # Parent-child relationships
├─> entities.mjs        # Entity discovery
├─> plugins.mjs         # Plugin discovery
├─> themes.mjs          # Theme discovery
├─> templates.mjs       # Template discovery
├─> blocks.mjs          # Block discovery
├─> middlewares.mjs     # Middleware discovery
├─> auth.mjs            # Auth config discovery
└─> permissions.mjs     # Permissions config discovery

Phase 2: Processing
├─> Extract metadata from configs
├─> Resolve dependencies
├─> Build relationships (parent/child)
└─> Apply merge priority (Core > Theme > Plugin)

Phase 3: Generation (core/scripts/build/registry/generators/)
├─> plugin-registry.mjs      # Plugin registry
├─> entity-registry.mjs      # Entity registry
├─> entity-types.mjs         # TypeScript types
├─> theme-registry.mjs       # Theme registry
├─> template-registry.mjs    # Template registry
├─> block-registry.mjs       # Block registry
├─> middleware-registry.mjs  # Middleware registry
├─> route-handlers.mjs       # Route handlers
├─> translation-registry.mjs # Translations
├─> scope-registry.mjs       # Scopes
├─> namespace-registry.mjs   # Namespaces
├─> billing-registry.mjs     # Billing
├─> permissions-registry.mjs # Permissions
├─> auth-registry.mjs        # Auth
└─> unified-registry.mjs     # Index exports

Phase 4: Post-Build & Watch (core/scripts/build/registry/post-build/, watch.mjs)
├─> page-generator.mjs  # Generate missing pages
├─> tree-display.mjs    # Console tree output
├─> test-fixtures.mjs   # Test data generation
├─> route-cleanup.mjs   # Cleanup orphaned routes
└─> watch.mjs           # Watch mode for dev
```

### Command Line Usage

```bash
# One-time build
pnpm registry:build
# or
node core/scripts/build/registry.mjs

# Watch mode (automatic rebuild)
pnpm registry:build-watch
# or
node core/scripts/build/registry.mjs --watch

# Production build (no watch)
node core/scripts/build/registry.mjs --build

# Verbose logging
node core/scripts/build/registry.mjs --verbose
# or
node core/scripts/build/registry.mjs -v
```

### Output Files

**Generates 18 files in `core/lib/registries/`:**

| # | File | Type | Service Layer |
|---|------|------|---------------|
| 1 | `entity-registry.ts` | Data-Only ✅ | `queries.ts` |
| 2 | `entity-registry.client.ts` | Client | N/A |
| 3 | `entity-types.ts` | Data-Only ✅ | `EntityTypeService` |
| 4 | `plugin-registry.ts` | Hybrid | Pending |
| 5 | `plugin-registry.client.ts` | Client | N/A |
| 6 | `route-handlers.ts` | Data-Only ✅ | `RouteHandlerService` |
| 7 | `theme-registry.ts` | Data-Only ✅ | `ThemeService` |
| 8 | `translation-registry.ts` | Data-Only ✅ | `TranslationService` |
| 9 | `template-registry.ts` | Data-Only ✅ | `TemplateService` |
| 10 | `template-registry.client.ts` | Client | N/A |
| 11 | `block-registry.ts` | Data-Only ✅ | `BlockService` |
| 12 | `billing-registry.ts` | Data-Only ✅ | `queries.ts` |
| 13 | `docs-registry.ts` | Data-Only ✅ | N/A |
| 14 | `middleware-registry.ts` | Hybrid | Pending |
| 15 | `namespace-registry.ts` | Data-Only ✅ | `NamespaceService` |
| 16 | `scope-registry.ts` | Data-Only ✅ | `ScopeService` |
| 17 | `permissions-registry.ts` | Data-Only ✅ | `PermissionService` |
| 18 | `index.ts` | Exports | N/A |

**Data-Only Pattern:** Registries marked as "Data-Only" export only data constants and types. Query functions have been moved to dedicated service classes in `core/lib/services/` for better separation of concerns and testability.

---

## Configuration

### Environment Variables

```typescript
const CONFIG = {
  // Output directory for generated registries
  outputDir: join(rootDir, 'core', 'lib', 'registries'),

  // Watch mode (auto-rebuild on changes)
  watchMode: process.argv.includes('--watch') && !process.argv.includes('--build'),

  // Build mode (one-time, no watch)
  buildMode: process.argv.includes('--build'),

  // Verbose logging
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),

  // Contents directory to scan
  contentsDir: join(rootDir, 'contents'),

  // Active theme (from NEXT_PUBLIC_ACTIVE_THEME)
  activeTheme: process.env.NEXT_PUBLIC_ACTIVE_THEME?.replace(/'/g, '')
}
```

### Content Type Definitions

```typescript
const CONTENT_TYPES = {
  plugins: {
    dir: 'plugins',
    configPattern: 'plugin.config.ts',
    generator: generatePluginRegistry,
    discoverer: discoverPlugins
  },
  entities: {
    dir: 'entities',
    configPattern: '.config.ts',
    generator: generateEntityRegistry,
    discoverer: discoverEntities
  },
  themes: {
    dir: 'themes',
    configPattern: 'theme.config.ts',
    generator: generateThemeRegistry,
    discoverer: discoverThemes
  },
  templates: {
    dir: 'themes', // Templates within themes
    configPattern: null,
    generator: generateTemplateRegistry,
    discoverer: discoverTemplates
  },
  // ... more content types
}
```

---

## Phase 1: Discovery

### Entity Discovery

**Algorithm: Recursive nested entity discovery**

```typescript
async function discoverNestedEntities(
  basePath,
  relativePath = '',
  depth = 0,
  parentName = null,
  ownerContext = null // { type: 'plugin', name: 'ai' }
) {
  const entities = []

  // 1. Scan directory
  const entries = await readdir(basePath, { withFileTypes: true })

  // 2. Find config files directly in this directory
  const configFiles = entries.filter(entry =>
    entry.isFile() &&
    entry.name.endsWith('.config.ts') &&
    entry.name !== 'index.ts'
  )

  // 3. Process config files (child entities)
  for (const configFile of configFiles) {
    let entityName = configFile.name.replace('.config.ts', '')
    const configPath = join(basePath, configFile.name)

    // Extract export name (EntityConfig or ChildConfig)
    const exportName = await extractExportName(configPath, [
      /export\s+const\s+([a-zA-Z]+EntityConfig)\s*[:=]/,
      /export\s+const\s+([a-zA-Z]+ChildConfig)\s*[:=]/
    ])

    if (!exportName) continue

    // For child entities, extract table name
    if (exportName.includes('ChildConfig')) {
      const configContent = await readFile(configPath, 'utf-8')
      const tableMatch = configContent.match(/table:\s*['"]([^'"]+)['"]/)
      if (tableMatch) {
        entityName = tableMatch[1] // Use table name as entity name
      }
    }

    // Determine import path based on owner context
    let baseImportPath
    if (ownerContext?.type === 'plugin') {
      baseImportPath = `@/contents/plugins/${ownerContext.name}/entities/${entityName}`
    } else if (ownerContext?.type === 'theme') {
      baseImportPath = `@/contents/themes/${ownerContext.name}/entities/${entityName}`
    } else {
      baseImportPath = `@/contents/entities/${entityName}`
    }

    // Build entity metadata
    entities.push({
      name: entityName,
      exportName,
      configPath: `${baseImportPath}/${configFile.name.replace('.ts', '')}`,
      relativePath: entityName,
      depth,
      parent: parentName,
      children: [],
      hasComponents: false,
      hasHooks: false,
      hasMigrations: false,
      hasMessages: false,
      hasAssets: false,
      messagesPath: `${baseImportPath}/messages`,
      pluginContext: ownerContext?.type === 'plugin' ? { pluginName: ownerContext.name } : null,
      themeContext: ownerContext?.type === 'theme' ? { themeName: ownerContext.name } : null,
      source: ownerContext?.type || 'theme'
    })
  }

  // 4. Process subdirectories (entities with own directories)
  const entityDirs = entries.filter(entry => entry.isDirectory())

  for (const dir of entityDirs) {
    const entityName = dir.name
    const currentPath = join(basePath, entityName)

    // Try multiple naming patterns for config files
    const configPatterns = [
      `${entityName}.config.ts`,
      `${entityName.slice(0, -1)}.config.ts`, // Remove trailing 's'
      `${entityName.replace(/s$/, '')}.config.ts`
    ]

    let configPath = null
    let actualConfigFile = null

    // Find config file
    for (const pattern of configPatterns) {
      const testPath = join(currentPath, pattern)
      if (existsSync(testPath)) {
        configPath = testPath
        actualConfigFile = pattern
        break
      }
    }

    // Fallback: find any .config.ts file
    if (!configPath) {
      const dirContents = await readdir(currentPath, { withFileTypes: true })
      const configFile = dirContents.find(entry =>
        entry.isFile() &&
        entry.name.endsWith('.config.ts') &&
        entry.name !== 'index.ts'
      )

      if (configFile) {
        configPath = join(currentPath, configFile.name)
        actualConfigFile = configFile.name
      }
    }

    if (!configPath) {
      // Check for nested entities even without config (container)
      const childPath = join(currentPath, 'children')
      if (existsSync(childPath)) {
        const nestedEntities = await discoverNestedEntities(
          childPath,
          `${entityName}/children`,
          depth + 1,
          entityName,
          ownerContext
        )
        entities.push(...nestedEntities)
      }
      continue
    }

    // Extract export name
    const exportName = await extractExportName(configPath, [
      /export\s+const\s+([a-zA-Z]+EntityConfig)\s*[:=]/,
      /export\s+const\s+([a-zA-Z]+ChildConfig)\s*[:=]/
    ])

    if (!exportName) continue

    // For child entities, extract table name
    let actualEntityName = entityName
    if (exportName.includes('ChildConfig')) {
      const configContent = await readFile(configPath, 'utf-8')
      const tableMatch = configContent.match(/table:\s*['"]([^'"]+)['"]/)
      if (tableMatch) {
        actualEntityName = tableMatch[1]
      }
    }

    // Check for related directories
    const componentsPath = join(currentPath, 'components')
    const hooksPath = join(currentPath, 'hooks')
    const migrationsPath = join(currentPath, 'migrations')
    const messagesPath = join(currentPath, 'messages')
    const assetsPath = join(currentPath, 'assets')

    const hasComponents = existsSync(componentsPath)
    const hasHooks = existsSync(hooksPath)
    const hasMigrations = existsSync(migrationsPath)
    const hasMessages = existsSync(messagesPath)
    const hasAssets = existsSync(assetsPath)

    // Discover nested child entities
    const children = []
    const childPath = join(currentPath, 'children')
    if (existsSync(childPath)) {
      const nestedEntities = await discoverNestedEntities(
        childPath,
        `${entityName}/children`,
        depth + 1,
        actualEntityName,
        ownerContext
      )
      entities.push(...nestedEntities)
      nestedEntities.forEach(ne => children.push(ne.name))
    }

    // Build entity metadata
    entities.push({
      name: actualEntityName,
      exportName,
      configPath: `${baseImportPath}/${actualConfigFile.replace('.ts', '')}`,
      actualConfigFile,
      relativePath: entityName,
      depth,
      parent: parentName,
      children,
      hasComponents,
      hasHooks,
      hasMigrations,
      hasMessages,
      hasAssets,
      messagesPath: `${baseImportPath}/messages`,
      pluginContext: ownerContext?.type === 'plugin' ? { pluginName: ownerContext.name } : null,
      themeContext: ownerContext?.type === 'theme' ? { themeName: ownerContext.name } : null,
      source: ownerContext?.type || 'theme'
    })
  }

  return entities
}
```

**Discovery sources:**

1. **Core entities:** `core/lib/entities/core/`
2. **Theme entities:** `contents/themes/[THEME]/entities/`
3. **Plugin entities:** `contents/plugins/[PLUGIN]/entities/`

**Example output:**

```typescript
{
  name: 'tasks',
  exportName: 'taskEntityConfig',
  configPath: '@/contents/themes/default/entities/tasks/tasks.config',
  depth: 0,
  parent: null,
  children: [],
  hasComponents: false,
  hasHooks: false,
  hasMigrations: true,
  hasMessages: true,
  hasAssets: false,
  messagesPath: '@/contents/themes/default/entities/tasks/messages',
  pluginContext: null,
  themeContext: { themeName: 'default' },
  source: 'theme'
}
```

### Plugin Discovery

**Algorithm: Plugin directory scanning + route file discovery**

```typescript
async function discoverPlugins() {
  const pluginsDir = join(CONFIG.contentsDir, 'plugins')
  const plugins = []

  // Scan plugins directory
  const entries = await readdir(pluginsDir, { withFileTypes: true })
  const pluginDirs = entries.filter(entry => entry.isDirectory())

  for (const dir of pluginDirs) {
    const pluginName = dir.name
    const configPath = join(pluginsDir, pluginName, 'plugin.config.ts')

    // Check if plugin.config.ts exists
    if (!existsSync(configPath)) continue

    // Extract export name
    const configContent = await readFile(configPath, 'utf8')
    const exportMatch = configContent.match(/export\s+const\s+([a-zA-Z]+PluginConfig)\s*[:=]/)
    const exportName = exportMatch ? exportMatch[1] : null

    // Check for plugin directories
    const componentsPath = join(pluginsDir, pluginName, 'components')
    const routesPath = join(pluginsDir, pluginName, 'routes')
    const messagesPath = join(pluginsDir, pluginName, 'messages')

    const hasComponents = existsSync(componentsPath)
    const hasMessages = existsSync(messagesPath)

    // Discover route files
    let routeFiles = []
    if (existsSync(routesPath)) {
      routeFiles = await discoverPluginRouteFiles(routesPath, pluginName)
    }

    // Discover plugin entities
    const pluginEntitiesPath = join(pluginsDir, pluginName, 'entities')
    let pluginEntities = []

    if (existsSync(pluginEntitiesPath)) {
      pluginEntities = await discoverNestedEntities(
        pluginEntitiesPath,
        '',
        0,
        null,
        { type: 'plugin', name: pluginName }
      )
    }

    plugins.push({
      name: pluginName,
      exportName,
      configPath: `@/contents/plugins/${pluginName}/plugin.config`,
      hasComponents,
      hasMessages,
      componentsPath: hasComponents ? `@/contents/plugins/${pluginName}/components` : null,
      messagesPath: hasMessages ? `@/contents/plugins/${pluginName}/messages` : null,
      entities: pluginEntities,
      routeFiles
    })
  }

  return plugins
}
```

**Route file discovery:**

```typescript
async function discoverPluginRouteFiles(routesPath, pluginName) {
  const routeFiles = []

  async function scanRouteDir(dirPath, relativePath = '') {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await scanRouteDir(entryPath, `${relativePath}/${entry.name}`)
      } else if (entry.name === 'route.ts') {
        // Extract HTTP methods from route.ts
        const methods = await extractHttpMethods(entryPath)

        routeFiles.push({
          path: relativePath,
          fullPath: entryPath,
          importPath: entryPath.replace(CONFIG.contentsDir + '/', '@/contents/'),
          methods,
          pluginName
        })
      }
    }
  }

  await scanRouteDir(routesPath)
  return routeFiles
}
```

### Theme Discovery

**Algorithm: Active theme or all themes**

```typescript
async function discoverThemes() {
  const themesDir = join(CONFIG.contentsDir, 'themes')
  const themes = []

  // Only process active theme if specified
  if (!CONFIG.activeTheme) {
    // Process all themes
    const entries = await readdir(themesDir, { withFileTypes: true })
    const themeDirs = entries.filter(entry => entry.isDirectory())

    for (const dir of themeDirs) {
      const themeData = await processTheme(dir.name)
      if (themeData) themes.push(themeData)
    }
  } else {
    // Process only active theme
    const themeData = await processTheme(CONFIG.activeTheme)
    if (themeData) themes.push(themeData)
  }

  return themes
}

async function processTheme(themeName) {
  const themesDir = join(CONFIG.contentsDir, 'themes')
  const configPath = join(themesDir, themeName, 'theme.config.ts')

  if (!existsSync(configPath)) return null

  // Extract theme config export name
  const configContent = await readFile(configPath, 'utf8')
  const exportMatch = configContent.match(/export\s+const\s+([a-zA-Z]+ThemeConfig)\s*[:=]/)
  const exportName = exportMatch ? exportMatch[1] : null

  // Extract plugin dependencies
  const pluginsMatch = configContent.match(/plugins:\s*\[([^\]]+)\]/)
  const plugins = pluginsMatch
    ? pluginsMatch[1].split(',').map(p => p.trim().replace(/['"]/g, '')).filter(Boolean)
    : []

  // Check for theme directories
  const componentsPath = join(themesDir, themeName, 'components')
  const stylesPath = join(themesDir, themeName, 'styles')
  const assetsPath = join(themesDir, themeName, 'assets')
  const messagesPath = join(themesDir, themeName, 'messages')

  const hasComponents = existsSync(componentsPath)
  const hasStyles = existsSync(stylesPath)
  const hasAssets = existsSync(assetsPath)
  const hasMessages = existsSync(messagesPath)

  // Discover theme entities
  const themeEntitiesPath = join(themesDir, themeName, 'entities')
  let themeEntities = []

  if (existsSync(themeEntitiesPath)) {
    themeEntities = await discoverNestedEntities(
      themeEntitiesPath,
      '',
      0,
      null,
      { type: 'theme', name: themeName }
    )
  }

  // Discover theme API routes
  const themeApiPath = join(themesDir, themeName, 'api')
  let themeRouteFiles = []

  if (existsSync(themeApiPath)) {
    themeRouteFiles = await discoverThemeRouteFiles(themeApiPath, themeName)
  }

  // Check for dashboard config
  const dashboardConfigPath = join(themesDir, themeName, 'dashboard.config.ts')
  const hasDashboardConfig = existsSync(dashboardConfigPath)
  let dashboardConfigExportName = null

  if (hasDashboardConfig) {
    dashboardConfigExportName = await extractExportName(dashboardConfigPath, [
      /export\s+const\s+([a-zA-Z_]+(?:DASHBOARD_CONFIG|DashboardConfig))\s*[:=]/
    ])
  }

  // Check for app config
  const appConfigPath = join(themesDir, themeName, 'app.config.ts')
  const hasAppConfig = existsSync(appConfigPath)
  let appConfigExportName = null

  if (hasAppConfig) {
    appConfigExportName = await extractExportName(appConfigPath, [
      /export\s+const\s+([a-zA-Z_]+(?:APP_CONFIG|AppConfig))\s*[:=]/
    ])
  }

  return {
    name: themeName,
    exportName,
    configPath: `@/contents/themes/${themeName}/theme.config`,
    hasComponents,
    hasStyles,
    hasAssets,
    hasMessages,
    hasDashboardConfig,
    dashboardConfigPath: hasDashboardConfig ? `@/contents/themes/${themeName}/dashboard.config` : null,
    dashboardConfigExportName,
    hasAppConfig,
    appConfigPath: hasAppConfig ? `@/contents/themes/${themeName}/app.config` : null,
    appConfigExportName,
    entities: themeEntities,
    routeFiles: themeRouteFiles,
    plugins // Plugin dependencies
  }
}
```

### Translation Discovery

**Algorithm: Locale-based message discovery**

```typescript
async function discoverTranslations() {
  const translations = {}

  // Discover from core messages
  const coreMessagesPath = join(rootDir, 'core', 'messages')
  if (existsSync(coreMessagesPath)) {
    await discoverTranslationsInPath(coreMessagesPath, 'core', translations)
  }

  // Discover from theme messages
  if (CONFIG.activeTheme) {
    const themeMessagesPath = join(CONFIG.contentsDir, 'themes', CONFIG.activeTheme, 'messages')
    if (existsSync(themeMessagesPath)) {
      await discoverTranslationsInPath(themeMessagesPath, 'theme', translations)
    }
  }

  // Discover from plugin messages
  const pluginsDir = join(CONFIG.contentsDir, 'plugins')
  if (existsSync(pluginsDir)) {
    const pluginDirs = await readdir(pluginsDir, { withFileTypes: true })
    for (const dir of pluginDirs.filter(d => d.isDirectory())) {
      const pluginMessagesPath = join(pluginsDir, dir.name, 'messages')
      if (existsSync(pluginMessagesPath)) {
        await discoverTranslationsInPath(pluginMessagesPath, `plugin:${dir.name}`, translations)
      }
    }
  }

  return translations
}
```

---

## Phase 2: Processing & Merging

### Merge Priority System

**Priority order:** `Core > Theme > Plugin`

```typescript
function mergeEntities(coreEntities, themeEntities, pluginEntities) {
  const merged = {}

  // 1. Add plugin entities (lowest priority)
  for (const entity of pluginEntities) {
    merged[entity.name] = {
      ...entity,
      source: 'plugin',
      isCore: false
    }
  }

  // 2. Override with theme entities (medium priority)
  for (const entity of themeEntities) {
    merged[entity.name] = {
      ...entity,
      source: 'theme',
      isCore: false
    }
  }

  // 3. Override with core entities (highest priority)
  for (const entity of coreEntities) {
    merged[entity.name] = {
      ...entity,
      source: 'core',
      isCore: true // Core entities CANNOT be overridden
    }
  }

  return Object.values(merged)
}
```

**Why this matters:**

- **Core entities** (e.g., `users`) are system-critical and cannot be overridden
- **Theme entities** can customize or extend plugin entities
- **Plugin entities** provide default implementations

**Example:**

```typescript
// Plugin provides default 'tasks' entity
Plugin: tasks.config.ts → { label: 'Tasks', features: { create: true } }

// Theme customizes 'tasks' entity
Theme: tasks.config.ts → { label: 'My Tasks', features: { create: true, archive: true } }

// Result: Theme wins
Merged: { label: 'My Tasks', features: { create: true, archive: true }, source: 'theme' }

// But core entities always win
Core: users.config.ts → { isCore: true, ... }
Plugin: users.config.ts → (ignored)
Result: Core users entity used, plugin version ignored
```

### Dependency Resolution

```typescript
function resolvePluginDependencies(plugins, themes) {
  const resolved = new Map()

  // Build dependency graph
  for (const theme of themes) {
    for (const pluginName of theme.plugins) {
      const plugin = plugins.find(p => p.name === pluginName)
      if (!plugin) {
        log(`⚠️  Theme '${theme.name}' depends on plugin '${pluginName}' but it was not found`, 'warning')
        continue
      }

      resolved.set(pluginName, plugin)
    }
  }

  return Array.from(resolved.values())
}
```

---

## Phase 3: Generation

### Entity Registry Generation

```typescript
async function generateEntityRegistry(entities) {
  const timestamp = new Date().toISOString()

  let code = `/**
 * Auto-generated Entity Registry
 *
 * Generated at: ${timestamp}
 * Entities discovered: ${entities.length}
 *
 * DO NOT EDIT - This file is auto-generated by core/scripts/build/registry.mjs
 */

`

  // Generate imports
  for (const entity of entities) {
    code += `import { ${entity.exportName} } from '${entity.configPath}'\n`
  }

  code += `import type { EntityConfig, ChildEntityDefinition } from '@/core/lib/entities/types'\n\n`

  // Generate types
  code += `export interface EntityPluginContext {
  pluginName: string
}

export interface EntityThemeContext {
  themeName: string
}

export interface EntityRegistryEntry {
  name: string
  config: EntityConfig | ChildEntityDefinition
  tableName?: string
  relativePath: string
  depth: number
  parent: string | null
  children: string[]
  hasComponents: boolean
  hasHooks: boolean
  hasMigrations: boolean
  hasMessages: boolean
  hasAssets: boolean
  messagesPath: string
  pluginContext: EntityPluginContext | null
  themeContext: EntityThemeContext | null
  isCore?: boolean
  source?: 'core' | 'theme' | 'plugin'
}

`

  // Generate registry object
  code += `export const ENTITY_REGISTRY = {\n`

  for (const entity of entities) {
    code += `  '${entity.name}': {
    name: '${entity.name}',
    config: ${entity.exportName},
    tableName: ${entity.exportName}.slug || '${entity.name}',
    relativePath: '${entity.relativePath}',
    depth: ${entity.depth},
    parent: ${entity.parent ? `'${entity.parent}'` : 'null'},
    children: [${entity.children.map(c => `'${c}'`).join(', ')}],
    hasComponents: ${entity.hasComponents},
    hasHooks: ${entity.hasHooks},
    hasMigrations: ${entity.hasMigrations},
    hasMessages: ${entity.hasMessages},
    hasAssets: ${entity.hasAssets},
    messagesPath: '${entity.messagesPath}',
    pluginContext: ${entity.pluginContext ? `{ pluginName: '${entity.pluginContext.pluginName}' }` : 'null'},
    themeContext: ${entity.themeContext ? `{ themeName: '${entity.themeContext.themeName}' }` : 'null'},
    isCore: ${entity.isCore || false},
    source: '${entity.source}' as const
  },\n`
  }

  code += `}\n\n`

  // Generate entity name type
  code += `export type EntityName = keyof typeof ENTITY_REGISTRY\n\n`

  // Generate helper functions
  code += generateEntityHelperFunctions()

  // Write file
  await writeFile(join(CONFIG.outputDir, 'entity-registry.ts'), code)
}
```

### Route Handlers Registry Generation

**Zero dynamic imports enforcement:**

```typescript
async function generateRouteHandlersRegistry(themes, plugins) {
  let code = `/**
 * Auto-generated Route Handlers Registry
 *
 * ZERO DYNAMIC IMPORTS - All routes statically imported
 * This file enables instant route resolution without runtime I/O
 */

`

  // Import all theme route files
  for (const theme of themes) {
    for (const routeFile of theme.routeFiles) {
      const importName = generateRouteImportName(theme.name, routeFile.path)
      code += `import * as ${importName} from '${routeFile.importPath}'\n`
    }
  }

  // Import all plugin route files
  for (const plugin of plugins) {
    for (const routeFile of plugin.routeFiles) {
      const importName = generateRouteImportName(plugin.name, routeFile.path)
      code += `import * as ${importName} from '${routeFile.importPath}'\n`
    }
  }

  code += `\n`

  // Generate route handler types
  code += `export interface RouteHandler {
  GET?: Function
  POST?: Function
  PUT?: Function
  PATCH?: Function
  DELETE?: Function
  HEAD?: Function
  OPTIONS?: Function
}

`

  // Generate THEME_ROUTE_HANDLERS
  code += `export const THEME_ROUTE_HANDLERS: Record<string, RouteHandler> = {\n`

  for (const theme of themes) {
    for (const routeFile of theme.routeFiles) {
      const importName = generateRouteImportName(theme.name, routeFile.path)
      const routeKey = routeFile.path.replace(/^\//, '')

      code += `  '${routeKey}': {\n`
      for (const method of routeFile.methods) {
        code += `    ${method}: ${importName}.${method},\n`
      }
      code += `  },\n`
    }
  }

  code += `}\n\n`

  // Generate PLUGIN_ROUTE_HANDLERS
  code += `export const PLUGIN_ROUTE_HANDLERS: Record<string, RouteHandler> = {\n`

  for (const plugin of plugins) {
    for (const routeFile of plugin.routeFiles) {
      const importName = generateRouteImportName(plugin.name, routeFile.path)
      const routeKey = `${plugin.name}/${routeFile.path.replace(/^\//, '')}`

      code += `  '${routeKey}': {\n`
      for (const method of routeFile.methods) {
        code += `    ${method}: ${importName}.${method},\n`
      }
      code += `  },\n`
    }
  }

  code += `}\n\n`

  // Generate helper functions
  code += `
/**
 * Get theme route handler (zero I/O, instant lookup)
 */
export function getThemeRouteHandler(
  routeKey: string,
  method: string
): Function | undefined {
  const handler = THEME_ROUTE_HANDLERS[routeKey]
  return handler?.[method as keyof RouteHandler]
}

/**
 * Get plugin route handler (zero I/O, instant lookup)
 */
export function getPluginRouteHandler(
  routeKey: string,
  method: string
): Function | undefined {
  const handler = PLUGIN_ROUTE_HANDLERS[routeKey]
  return handler?.[method as keyof RouteHandler]
}
`

  // Write file
  await writeFile(join(CONFIG.outputDir, 'route-handlers.ts'), code)
}
```

---

## Phase 4: Watch Mode

### File Watching

```typescript
async function watchMode() {
  log('Watch mode enabled - monitoring contents/ for changes...', 'info')

  let rebuildTimeout = null

  // Watch contents directory
  watch(CONFIG.contentsDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return

    // Ignore non-relevant files
    if (filename.includes('node_modules')) return
    if (filename.includes('.next')) return
    if (filename.endsWith('.test.ts')) return

    // Debounce rebuilds (300ms)
    if (rebuildTimeout) {
      clearTimeout(rebuildTimeout)
    }

    rebuildTimeout = setTimeout(async () => {
      log(`Change detected: ${filename}`, 'info')
      log('Rebuilding registries...', 'build')

      try {
        await main() // Rebuild all registries
        log('✅ Registry rebuild completed', 'success')
        log('⚠️  RESTART DEV SERVER to apply changes', 'warning')
      } catch (error) {
        log(`❌ Registry rebuild failed: ${error.message}`, 'error')
      }
    }, 300)
  })

  log('Watching for changes... (Ctrl+C to stop)', 'info')
}
```

### Debounce Strategy

**Why 300ms debounce:**

- Prevents multiple rebuilds for rapid changes (e.g., saving multiple files)
- Allows IDEs to finish writing files
- Reduces CPU usage during active development
- Still feels instant to developers

---

## Performance Optimizations

### 1. Parallel Discovery

```typescript
// Discover multiple content types in parallel
const [entities, plugins, themes, translations] = await Promise.all([
  discoverEntities(),
  discoverPlugins(),
  discoverThemes(),
  discoverTranslations()
])
```

### 2. File Caching

```typescript
// Cache file reads to avoid redundant I/O
const fileCache = new Map()

async function cachedReadFile(path) {
  if (fileCache.has(path)) {
    return fileCache.get(path)
  }

  const content = await readFile(path, 'utf8')
  fileCache.set(path, content)
  return content
}
```

### 3. Minimal Parsing

```typescript
// Use simple regex instead of full AST parsing
// Trade-off: Faster, but less robust for complex configs

const exportMatch = content.match(/export\s+const\s+([a-zA-Z]+Config)\s*[:=]/)
const exportName = exportMatch ? exportMatch[1] : null
```

### 4. Conditional Processing

```typescript
// Only process active theme (not all themes)
if (CONFIG.activeTheme) {
  const theme = await processTheme(CONFIG.activeTheme)
} else {
  const themes = await processAllThemes()
}
```

---

## Debugging

### Verbose Mode

```bash
pnpm registry:build --verbose
```

**Output:**

```text
🔍 Discovering content...
   Theme: default (components, styles, 2 entities, 3 routes)
   Plugin: ai (components, 1 entity, 5 routes)
   Plugin: billing (3 routes)
   Entity: tasks (config only)
   Entity: ai-history (migrations, messages)
✅ Found 2 entities
✅ Found 2 plugins
✅ Found 1 theme

🏗️  Generating registries...
✅ Generated entity-registry.ts (218 lines)
✅ Generated plugin-registry.ts (475 lines)
✅ Generated route-handlers.ts (78 lines)
...

✅ Registry build completed (5.2s)
```

### Common Issues

**Issue: "No entities found"**
```text
Causes:
- No .config.ts files in contents/themes/[THEME]/entities/
- Export name doesn't match pattern (EntityConfig or ChildConfig)
- File permissions prevent reading

Debug:
- Run with --verbose to see discovered files
- Check file naming conventions
- Verify export statements in config files
```

**Issue: "Registry build failed"**
```text
Causes:
- Syntax errors in config files
- Missing required imports
- Circular dependencies

Debug:
- Check error stack trace
- Validate config file syntax
- Run TypeScript type checking
```

**Issue: "Registry changes not reflected"**
```text
Cause:
- Registries imported at app initialization
- Hot reload doesn't reload imports

Solution:
- Restart dev server (Ctrl+C → pnpm dev)
```

---

## Output Structure

### Generated File Example

**entity-registry.ts** (~218 lines):

```typescript
/**
 * Auto-generated Entity Registry
 *
 * Generated at: 2025-11-19T20:19:36.833Z
 * Entities discovered: 2
 *
 * DO NOT EDIT - This file is auto-generated by core/scripts/build/registry.mjs
 */

import { aiHistoryEntityConfig } from '@/contents/plugins/ai/entities/ai-history/ai-history.config'
import { taskEntityConfig } from '@/contents/themes/default/entities/tasks/tasks.config'
import type { EntityConfig, ChildEntityDefinition } from '@/core/lib/entities/types'

export interface EntityRegistryEntry {
  name: string
  config: EntityConfig | ChildEntityDefinition
  tableName?: string
  relativePath: string
  depth: number
  parent: string | null
  children: string[]
  hasComponents: boolean
  hasHooks: boolean
  hasMigrations: boolean
  hasMessages: boolean
  hasAssets: boolean
  messagesPath: string
  pluginContext: EntityPluginContext | null
  themeContext: EntityThemeContext | null
  isCore?: boolean
  source?: 'core' | 'theme' | 'plugin'
}

export const ENTITY_REGISTRY = {
  'ai-history': {
    name: 'ai-history',
    config: aiHistoryEntityConfig,
    tableName: 'ai-history',
    // ... metadata
  },
  'tasks': {
    name: 'tasks',
    config: taskEntityConfig,
    tableName: 'tasks',
    // ... metadata
  }
}

export type EntityName = keyof typeof ENTITY_REGISTRY

// 17 helper functions...
export function getRegisteredEntities() { /* ... */ }
export function getEntity(name: EntityName) { /* ... */ }
// ...
```

---

## Module Structure

The registry script has been refactored from a monolithic 5,487-line file into 38 focused modules:

```text
core/scripts/build/registry/
├── config.mjs              # Configuration constants
├── watch.mjs               # Watch mode implementation
├── index.mjs               # Module exports (unused - registry.mjs is entry)
│
├── discovery/              # Content discovery modules
│   ├── index.mjs           # Re-exports
│   ├── parent-child.mjs    # Parent-child relationship discovery
│   ├── entities.mjs        # Entity discovery
│   ├── plugins.mjs         # Plugin discovery
│   ├── themes.mjs          # Theme discovery
│   ├── templates.mjs       # Template discovery
│   ├── blocks.mjs          # Block discovery
│   ├── middlewares.mjs     # Middleware discovery
│   ├── auth.mjs            # Auth config discovery
│   └── permissions.mjs     # Permissions config discovery
│
├── generators/             # Registry generation modules
│   ├── index.mjs           # Re-exports
│   ├── plugin-registry.mjs
│   ├── entity-registry.mjs
│   ├── entity-types.mjs
│   ├── theme-registry.mjs
│   ├── template-registry.mjs
│   ├── block-registry.mjs
│   ├── middleware-registry.mjs
│   ├── route-handlers.mjs
│   ├── translation-registry.mjs
│   ├── scope-registry.mjs
│   ├── namespace-registry.mjs
│   ├── billing-registry.mjs
│   ├── permissions-registry.mjs
│   ├── auth-registry.mjs
│   └── unified-registry.mjs
│
├── validation/             # Validation modules
│   └── entity-validator.mjs
│
└── post-build/             # Post-build tasks
    ├── index.mjs           # Re-exports
    ├── page-generator.mjs  # Missing page generation
    ├── tree-display.mjs    # Console tree structure
    ├── test-fixtures.mjs   # Test data generation
    └── route-cleanup.mjs   # Orphaned route cleanup
```

**Benefits of modular structure:**
- Each module has single responsibility
- Easier to test and maintain
- Clear separation of concerns
- Parallel discovery operations
- Reduced cognitive load

---

## Summary

**Build registry script is:**

- ✅ **38 modules** organized by responsibility (entry point: 270 lines)
- ✅ **4-phase pipeline** (Discovery → Processing → Generation → Post-Build/Watch)
- ✅ **16 registry files** output to `core/lib/registries/`
- ✅ **~5-10 seconds** build time (one-time cost)
- ✅ **Zero dynamic imports** in generated code
- ✅ **Merge priority system** (Core > Theme > Plugin)
- ✅ **Watch mode** for automatic rebuilds
- ✅ **Verbose logging** for debugging
- ✅ **Data-Only pattern** - All registries are pure data exports

**Key takeaways:**

- Script runs at build time, NOT runtime
- Discovers ALL content in contents/ directory
- Generates static TypeScript imports
- Enables ~17,255x performance improvement
- Requires server restart for registry changes
- Never edit generated files manually
- Query functions live in `core/lib/services/` (not registries)

**Service Layer:**
All registries now follow the Data-Only pattern. Query functions are in dedicated service classes:

| Service | Registry | Purpose |
|---------|----------|---------|
| `EntityTypeService` | entity-registry | Entity type queries |
| `NamespaceService` | namespace-registry | i18n namespace optimization |
| `ThemeService` | theme-registry | Theme configuration queries |
| `PluginService` | plugin-registry | Plugin configuration queries |
| `RouteHandlerService` | route-handlers | Route handler resolution |
| `ScopeService` | scope-registry | API scope queries |
| `MiddlewareService` | middleware-registry | Middleware execution |
| `PermissionService` | permissions-registry | RBAC permission queries |

**Next:** [Entity Registry](./03-entity-registry.md) - Deep dive into most common registry

---

**Last Updated**: 2025-12-26
**Version**: 3.0.0
**Status**: Complete
**Script Size**: 270 lines (entry point) + 38 modules
**Generated Files**: 16 registries (all data-only)
