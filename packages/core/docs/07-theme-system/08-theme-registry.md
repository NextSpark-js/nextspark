# Theme Registry Integration

The Theme Registry provides the bridge between the **registry system** and the **theme system**, enabling ultra-fast access to theme configurations, entities, routes, and assets without runtime filesystem operations.

## Overview

Themes are automatically discovered at build time by `core/scripts/build/registry.mjs` and registered in `core/lib/registries/theme-registry.ts`. This integration enables:

- ✅ **Zero I/O access** to theme configurations
- ✅ **Instant theme lookups** via direct object access
- ✅ **Type-safe** theme access with full TypeScript support
- ✅ **Rich metadata** about theme capabilities and resources
- ✅ **Plugin integration** tracking which themes use which plugins

## Theme Registry Structure

### ThemeRegistryEntry Interface

Each theme in the registry contains comprehensive metadata:

```typescript
export interface ThemeRegistryEntry {
  name: string                    // Theme identifier
  config: ThemeConfig             // Main theme configuration
  hasComponents: boolean          // Has components/ directory
  hasStyles: boolean              // Has styles/ directory
  hasAssets: boolean              // Has assets/ directory
  hasMessages: boolean            // Has messages/ directory
  hasDashboardConfig: boolean     // Has dashboard.config.ts
  dashboardConfig: any | null     // Dashboard configuration
  hasAppConfig: boolean           // Has app.config.ts
  appConfig: any | null           // App configuration overrides
  componentsPath: string | null   // Path to components
  stylesPath: string | null       // Path to styles
  assetsPath: string | null       // Path to assets
  messagesPath: string | null     // Path to messages
  entities: ThemeEntity[]         // Theme-specific entities
  routeFiles: ThemeRouteFile[]    // Theme-specific API routes
  plugins: string[]               // Plugin dependencies
}
```

### Generated Registry

The registry is auto-generated at build time:

```typescript
// core/lib/registries/theme-registry.ts (auto-generated)
export const THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {
  'default': {
    name: 'default',
    config: boilerplateThemeConfig,  // Pre-imported
    hasComponents: false,
    hasStyles: true,
    hasAssets: false,
    hasMessages: true,
    hasDashboardConfig: true,
    dashboardConfig: defaultDashboardConfig,
    hasAppConfig: true,
    appConfig: defaultAppConfig,
    componentsPath: null,
    stylesPath: '@/contents/themes/default/styles',
    assetsPath: null,
    messagesPath: '@/contents/themes/default/messages',
    entities: [...],      // Theme entities
    routeFiles: [...],    // Theme routes
    plugins: ['ai']       // Used plugins
  }
}
```

## Theme Discovery Process

### Automatic Discovery

The build script (`core/scripts/build/registry.mjs`) automatically discovers themes by:

1. **Scanning** `contents/themes/` directory
2. **Finding** `theme.config.ts` files (required)
3. **Detecting** optional resources (styles, messages, entities, etc.)
4. **Extracting** plugin dependencies from configuration
5. **Generating** registry entries with all metadata

### Discovery Logic

```typescript
// Simplified discovery logic from build-registry.mjs
async function discoverThemes() {
  const themesDir = join(contentsDir, 'themes')
  const themes = []

  for (const themeDir of await readdir(themesDir)) {
    const themePath = join(themesDir, themeDir)
    
    // Required: theme.config.ts
    const configFile = join(themePath, 'theme.config.ts')
    if (!existsSync(configFile)) continue

    // Discover theme resources
    const themeEntry = {
      name: themeDir,
      hasComponents: existsSync(join(themePath, 'components')),
      hasStyles: existsSync(join(themePath, 'styles')),
      hasAssets: existsSync(join(themePath, 'public')),
      hasMessages: existsSync(join(themePath, 'messages')),
      hasDashboardConfig: existsSync(join(themePath, 'dashboard.config.ts')),
      hasAppConfig: existsSync(join(themePath, 'app.config.ts')),
      entities: await discoverThemeEntities(themePath),
      routeFiles: await discoverThemeRoutes(themePath),
      plugins: await extractUsedPlugins(configFile)
    }

    themes.push(themeEntry)
  }

  return themes
}
```

## Accessing Theme Data

### Direct Registry Access

```typescript
import { THEME_REGISTRY } from '@/core/lib/registries/theme-registry'

// Direct access (fastest)
const defaultTheme = THEME_REGISTRY.default

// Access theme configuration
console.log(defaultTheme.config.name)        // "NextSpark"
console.log(defaultTheme.config.version)     // "1.0.0"

// Check capabilities
console.log(defaultTheme.hasStyles)          // true
console.log(defaultTheme.hasMessages)        // true
console.log(defaultTheme.entities.length)    // 1 (tasks)
```

### Helper Functions

```typescript
import {
  getTheme,
  getThemeDashboardConfig,
  getThemeAppConfig,
  getRegisteredThemes
} from '@/core/lib/registries/theme-registry'

// Get specific theme
const theme = getTheme('default')

// Get dashboard configuration
const dashboardConfig = getThemeDashboardConfig('default')

// Get app configuration overrides
const appConfig = getThemeAppConfig('default')

// Get all registered themes
const allThemes = getRegisteredThemes()
```

## Theme Configuration Access

### theme.config.ts

The main theme configuration is directly imported in the registry:

```typescript
// From theme.config.ts
export const boilerplateThemeConfig: ThemeConfig = {
  name: 'NextSpark',
  slug: 'default',
  version: '1.0.0',
  author: 'Your Name',
  description: 'Modern SaaS starter with Next.js',
  plugins: ['ai'],  // Plugin dependencies
  // ... more configuration
}

// Available via registry
const config = THEME_REGISTRY.default.config
```

### dashboard.config.ts (Optional)

Dashboard-specific configuration:

```typescript
// From dashboard.config.ts
export const DASHBOARD_CONFIG = {
  navigation: [
    { label: 'Home', href: '/dashboard', icon: 'Home' },
    { label: 'Tasks', href: '/dashboard/tasks', icon: 'CheckSquare' }
  ],
  widgets: [
    { id: 'stats', enabled: true },
    { id: 'recent-tasks', enabled: true }
  ]
}

// Available via registry
const dashboardConfig = THEME_REGISTRY.default.dashboardConfig
```

### app.config.ts (Optional)

App-level configuration overrides:

```typescript
// From app.config.ts
export const APP_CONFIG_OVERRIDES = {
  app: {
    name: 'My Custom SaaS',
    url: 'https://mysaas.com'
  },
  features: {
    enableBlog: true,
    enableDocs: true
  }
}

// Available via registry
const appConfig = THEME_REGISTRY.default.appConfig
```

## Theme Entities

### ThemeEntity Structure

Theme-specific entities are fully tracked in the registry:

```typescript
export interface ThemeEntity {
  name: string                    // Entity slug
  exportName: string              // Config export name
  configPath: string              // Import path to config
  actualConfigFile: string        // Actual filename
  relativePath: string            // Relative path within theme
  depth: number                   // Hierarchy depth
  parent: string | null           // Parent entity (if child)
  children: string[]              // Child entities
  hasComponents: boolean          // Has components/
  hasHooks: boolean               // Has hooks/
  hasMigrations: boolean          // Has migrations/
  hasMessages: boolean            // Has messages/
  hasAssets: boolean              // Has assets/
  messagesPath: string            // Path to i18n messages
  pluginContext: null             // Always null for themes
  themeContext: {                 // Theme context
    themeName: string
  }
  source: 'theme'                 // Source identifier
}
```

### Accessing Theme Entities

```typescript
import { THEME_REGISTRY } from '@/core/lib/registries/theme-registry'

// Get all entities from default theme
const themeEntities = THEME_REGISTRY.default.entities

// Find specific entity
const tasksEntity = themeEntities.find(e => e.name === 'tasks')

// Filter by criteria
const entitiesWithMigrations = themeEntities.filter(e => e.hasMigrations)
const rootEntities = themeEntities.filter(e => e.depth === 0)
```

## Theme Routes

### ThemeRouteFile Structure

Theme-specific API routes are tracked:

```typescript
export interface ThemeRouteFile {
  path: string                    // API route path
  filePath: string                // Actual file path
  relativePath: string            // Relative to theme
  methods: string[]               // HTTP methods (GET, POST, etc.)
  isRouteFile: boolean            // True if valid route file
  theme: string                   // Theme name
}
```

### Accessing Theme Routes

```typescript
import { THEME_REGISTRY } from '@/core/lib/registries/theme-registry'

// Get all routes from theme
const themeRoutes = THEME_REGISTRY.default.routeFiles

// Find specific route
const taskRoute = themeRoutes.find(r => r.path.includes('/tasks'))

// List all endpoints
themeRoutes.forEach(route => {
  console.log(`${route.path} [${route.methods.join(', ')}]`)
})
```

## Active Theme Selection

### Environment Variable

The active theme is determined by `NEXT_PUBLIC_ACTIVE_THEME`:

```bash
# .env.local
NEXT_PUBLIC_ACTIVE_THEME=default
```

### Runtime Access

```typescript
// Get active theme
const activeThemeName = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
const activeTheme = THEME_REGISTRY[activeThemeName]

// Use active theme configuration
const config = activeTheme.config
const dashboardNav = activeTheme.dashboardConfig
const entities = activeTheme.entities
```

## Plugin Integration

### Plugin Dependencies

Themes declare plugin dependencies in their configuration:

```typescript
// theme.config.ts
export const myThemeConfig: ThemeConfig = {
  name: 'my-theme',
  plugins: ['ai', 'analytics']  // Required plugins
}
```

### Accessing Plugin Usage

```typescript
import {
  getThemesUsingPlugin,
  getPluginUsage
} from '@/core/lib/registries/theme-registry'

// Find themes using AI plugin
const aiThemes = getThemesUsingPlugin('ai')

// Get detailed plugin usage
const aiUsage = getPluginUsage('ai')
// Returns: { theme: string, entities: number, routes: number }[]

// Check if current theme uses plugin
const currentTheme = THEME_REGISTRY.default
const usesAI = currentTheme.plugins.includes('ai')
```

## Registry Metadata

### Global Statistics

The registry includes metadata about all themes:

```typescript
export const THEME_METADATA = {
  totalThemes: 1,
  themesWithComponents: 0,
  themesWithStyles: 1,
  themesWithAssets: 0,
  themesWithMessages: 1,
  themesWithDashboardConfig: 1,
  themesWithEntities: 1,
  themesWithRoutes: 0,
  themesUsingPlugins: 1,
  totalThemeEntities: 1,
  totalThemeRoutes: 0,
  generatedAt: '2025-11-20T02:53:31.032Z',
  themes: ['default']
}
```

### Using Metadata

```typescript
import { THEME_METADATA } from '@/core/lib/registries/theme-registry'

// Display statistics
console.log(`Total themes: ${THEME_METADATA.totalThemes}`)
console.log(`Themes with entities: ${THEME_METADATA.themesWithEntities}`)

// Check generation time
const generatedDate = new Date(THEME_METADATA.generatedAt)
console.log(`Registry generated: ${generatedDate.toLocaleString()}`)
```

## Integration with Build System

### Build-Time vs Runtime

The registry system works with the theme build system:

```text
Build Time:
1. core/scripts/build/registry.mjs discovers themes
   ↓
2. Generates theme-registry.ts with all metadata
   ↓
3. core/scripts/build/theme.mjs compiles active theme CSS
   ↓
4. Assets copied to public/theme/

Runtime:
1. Import registry (zero I/O)
   ↓
2. Access theme data directly from memory
   ↓
3. Use pre-compiled CSS and assets
```

### Build Order

```bash
# Development
pnpm dev
  ↓
1. build-registry.mjs (discovers themes)
  ↓
2. build-theme.mjs (compiles active theme CSS)
  ↓
3. Next.js dev server starts

# Production
pnpm build
  ↓
1. build-registry.mjs --build
  ↓
2. build-theme.mjs --build
  ↓
3. Next.js build
```

## Practical Examples

### Example 1: Theme Selector Component

```typescript
'use client'

import { getRegisteredThemes } from '@/core/lib/registries/theme-registry'

export function ThemeSelector() {
  const themes = getRegisteredThemes()
  
  return (
    <select>
      {themes.map(theme => (
        <option key={theme.slug} value={theme.slug}>
          {theme.name} v{theme.version}
        </option>
      ))}
    </select>
  )
}
```

### Example 2: Dynamic Dashboard Navigation

```typescript
import { getThemeDashboardConfig } from '@/core/lib/registries/theme-registry'

export function DashboardSidebar() {
  const config = getThemeDashboardConfig('default')
  
  if (!config) {
    return <div>No configuration available</div>
  }
  
  return (
    <nav>
      {config.navigation.map(item => (
        <a key={item.href} href={item.href}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  )
}
```

### Example 3: Feature Detection

```typescript
import { getTheme } from '@/core/lib/registries/theme-registry'

export function FeatureGate({ feature, children }: Props) {
  const theme = getTheme('default')
  
  const isEnabled = theme?.features?.[feature] ?? false
  
  if (!isEnabled) return null
  
  return <>{children}</>
}

// Usage
<FeatureGate feature="darkMode">
  <DarkModeToggle />
</FeatureGate>
```

### Example 4: Theme Entity List

```typescript
import { THEME_REGISTRY } from '@/core/lib/registries/theme-registry'

export function ThemeEntitiesList() {
  const theme = THEME_REGISTRY.default
  
  return (
    <div>
      <h2>Theme Entities ({theme.entities.length})</h2>
      <ul>
        {theme.entities.map(entity => (
          <li key={entity.name}>
            <strong>{entity.name}</strong>
            {entity.hasMigrations && <span> (has migrations)</span>}
            {entity.hasMessages && <span> (i18n enabled)</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## Performance Characteristics

### Zero I/O Benefits

```typescript
// Traditional approach (with I/O): ~40ms
const theme = await loadThemeFromDisk('default')
const config = await readThemeConfig(theme.path)

// Registry approach (zero I/O): <1ms
const theme = THEME_REGISTRY.default
const config = theme.config
```

### Constant Time Lookups

```typescript
// O(1) complexity regardless of theme count
const theme1 = THEME_REGISTRY.default         // <1ms
const theme2 = THEME_REGISTRY['custom-theme'] // <1ms
const theme3 = THEME_REGISTRY['another']      // <1ms
```

## Best Practices

### ✅ DO: Use Registry Functions

```typescript
import { getTheme, getThemeDashboardConfig } from '@/core/lib/registries/theme-registry'

const theme = getTheme('default')
const dashboard = getThemeDashboardConfig('default')
```

### ✅ DO: Check for Undefined

```typescript
const theme = getTheme(themeName)

if (!theme) {
  console.warn(`Theme '${themeName}' not found`)
  return defaultTheme
}
```

### ✅ DO: Use Direct Access for Active Theme

```typescript
// When you know the active theme
const activeTheme = THEME_REGISTRY.default
```

### ❌ DON'T: Import from contents/

```typescript
// ❌ FORBIDDEN
import { boilerplateThemeConfig } from '@/contents/themes/default/config/theme.config'

// ✅ CORRECT
import { THEME_REGISTRY } from '@/core/lib/registries/theme-registry'
const config = THEME_REGISTRY.default.config
```

### ❌ DON'T: Use Dynamic Imports

```typescript
// ❌ FORBIDDEN
const theme = await import(`@/contents/themes/${themeName}/theme.config`)

// ✅ CORRECT
const theme = getTheme(themeName)
```

## Troubleshooting

### Theme Not Found

**Problem:** `getTheme('my-theme')` returns undefined

**Solutions:**
1. Check theme exists in `contents/themes/my-theme/`
2. Verify `theme.config.ts` file exists
3. Run `pnpm registry:build` to regenerate
4. Restart dev server

### Theme Changes Not Reflected

**Problem:** Updated theme config but changes don't appear

**Solutions:**
1. Run `pnpm registry:build` to regenerate registry
2. Restart dev server (registry can't hot reload)
3. Check browser console for errors
4. Verify active theme in `.env.local`

### Missing Dashboard Config

**Problem:** `getThemeDashboardConfig()` returns null

**Solutions:**
1. Check if `dashboard.config.ts` exists in theme
2. Verify export name is `DASHBOARD_CONFIG`
3. Regenerate registry: `pnpm registry:build`

## Type Safety

### TypeScript Types

```typescript
import type {
  ThemeRegistryEntry,
  ThemeEntity,
  ThemeRouteFile,
  ThemeName
} from '@/core/lib/registries/theme-registry'

// Strongly typed theme access
const theme: ThemeRegistryEntry = THEME_REGISTRY.default

// Type-safe theme name (auto-complete!)
const themeName: ThemeName = 'default'

// Fully typed entities
const entities: ThemeEntity[] = theme.entities
```

## Next Steps

1. **[Creating Custom Themes](./09-creating-custom-themes.md)** - Step-by-step theme creation
2. **[Plugin Registry](../03-registry-system/05-plugin-registry.md)** - Plugin integration
3. **[Translation Registry](../03-registry-system/06-translation-registry.md)** - i18n integration
4. **[Performance & Caching](../03-registry-system/08-performance-and-caching.md)** - Optimization

---

> 💡 **Key Takeaway**: The Theme Registry provides instant, type-safe access to all theme resources without filesystem operations, enabling maximum performance and developer experience.
