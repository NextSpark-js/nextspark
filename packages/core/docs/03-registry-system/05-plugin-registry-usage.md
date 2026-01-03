# Plugin Registry

## Overview

The Plugin Registry provides **ultra-fast, zero-I/O access** to plugin configurations, entities, and API functions. It comes in **two versions**: server-only (`plugin-registry.ts`) and client-safe (`plugin-registry.client.ts`), ensuring secure plugin access across the application.

**Key Features:**
- ✅ Zero runtime I/O for plugin access
- ✅ Server-only vs client-safe registries
- ✅ Direct plugin function access
- ✅ Plugin entity discovery
- ✅ API route endpoint mapping
- ✅ Full TypeScript type safety

---

## Dual Registry Architecture

### Server-Only Registry

```typescript
// core/lib/registries/plugin-registry.ts
import 'server-only'  // Prevents client-side usage

import { aiPluginConfig } from '@/contents/plugins/ai/plugin.config'

export const PLUGIN_REGISTRY = {
  'ai': {
    name: 'ai',
    config: aiPluginConfig,          // Full config with API functions
    hasAPI: true,
    apiPath: '@/contents/plugins/ai/api',
    routeFiles: [...],               // API route handlers
    entities: [...],                 // Plugin entities
    hasMessages: false,
    hasAssets: false
  }
}
```

**Features:**
- Direct access to plugin API functions
- Route handler imports
- Server-only Node.js dependencies
- Full plugin capabilities

### Client-Safe Registry

```typescript
// core/lib/registries/plugin-registry.client.ts
// NO 'server-only' import

export const PLUGIN_REGISTRY_CLIENT = {
  'ai': {
    name: 'ai',
    enabled: true,
    hasAPI: true,
    entities: [...],                 // Entity metadata only
    // ⚠️ NO config.api (server-only functions)
    // ⚠️ NO routeFiles (server-only handlers)
  }
}
```

**Features:**
- Safe for 'use client' components
- Plugin metadata only
- No server-only functions
- No Node.js dependencies

---

## Plugin Discovery

### Automatic Discovery Process

**Build script** (`core/scripts/build/registry.mjs`) discovers:

1. **Plugin Directory Structure:**
```text
contents/plugins/
└── ai/                           # Plugin name
    ├── plugin.config.ts          # Main config (required)
    ├── api/                      # API functions (optional)
    │   ├── generate/
    │   │   └── route.ts          # Next.js route handler
    │   ├── embeddings/
    │   │   └── route.ts
    │   └── ai-history/
    │       └── [id]/
    │           └── route.ts
    ├── entities/                 # Plugin entities (optional)
    │   └── ai-history/
    │       ├── ai-history.config.ts
    │       ├── migrations/
    │       └── messages/
    ├── messages/                 # i18n (optional)
    ├── assets/                   # Static assets (optional)
    └── public/                   # Public assets (optional)
```

2. **Discovery Logic:**

```typescript
// From core/scripts/build/registry.mjs
async function discoverPlugins() {
  const pluginsDir = join(contentsDir, 'plugins')
  const plugins = []

  for (const pluginDir of await readdir(pluginsDir)) {
    const pluginPath = join(pluginsDir, pluginDir)
    
    // Find plugin.config.ts (required)
    const configFile = join(pluginPath, 'plugin.config.ts')
    if (!existsSync(configFile)) continue

    // Discover plugin resources
    const pluginEntry = {
      name: pluginDir,
      hasAPI: existsSync(join(pluginPath, 'api')),
      apiPath: existsSync(join(pluginPath, 'api')) 
        ? `@/contents/plugins/${pluginDir}/api` 
        : null,
      routeFiles: await discoverPluginRoutes(pluginPath),
      entities: await discoverPluginEntities(pluginPath),
      hasMessages: existsSync(join(pluginPath, 'messages')),
      hasAssets: existsSync(join(pluginPath, 'assets'))
    }

    plugins.push(pluginEntry)
  }

  return plugins
}
```

---

## Plugin Registry Entry Structure

### Server Registry Entry

```typescript
export interface PluginRegistryEntry {
  name: string                    // Plugin identifier
  config: PluginConfig            // Full plugin configuration
  hasAPI: boolean                 // Has API functions
  apiPath: string | null          // Path to API directory
  routeFiles: RouteFileEndpoint[] // API route endpoints
  entities: PluginEntity[]        // Plugin entities
  hasMessages: boolean            // Has i18n messages
  hasAssets: boolean              // Has static assets
}
```

### Route File Endpoint

```typescript
export interface RouteFileEndpoint {
  path: string                    // API path (e.g., '/api/v1/plugin/ai/generate')
  filePath: string                // Actual file path
  relativePath: string            // Relative to plugin
  methods: string[]               // HTTP methods ['GET', 'POST']
  isRouteFile: boolean            // True if valid Next.js route
}
```

### Plugin Entity

```typescript
export interface PluginEntity {
  name: string                    // Entity slug
  exportName: string              // Config export name
  configPath: string              // Import path
  actualConfigFile: string        // Actual filename
  relativePath: string            // Relative path
  depth: number                   // Hierarchy depth
  parent: string | null           // Parent entity
  children: string[]              // Child entities
  hasComponents: boolean          // Has components/
  hasHooks: boolean               // Has hooks/
  hasMigrations: boolean          // Has migrations/
  hasMessages: boolean            // Has messages/
  hasAssets: boolean              // Has assets/
  messagesPath: string            // Path to messages
  pluginContext: {                // Plugin context
    pluginName: string
  }
}
```

---

## Accessing Plugin Configurations

### Direct Registry Access

```typescript
import { PLUGIN_REGISTRY } from '@/core/lib/registries/plugin-registry'

// Get plugin entry (instant, zero I/O)
const aiPlugin = PLUGIN_REGISTRY.ai

// Access configuration
const config = aiPlugin.config
const entities = aiPlugin.entities
const routes = aiPlugin.routeFiles
```

### Helper Functions

```typescript
import {
  getRegisteredPlugins,
  getPlugin,
  getPluginsWithAPI,
  getPluginsWithEntities
} from '@/core/lib/registries/plugin-registry'

// Get all plugin configs
const allPlugins = getRegisteredPlugins()

// Get specific plugin
const aiPlugin = getPlugin('ai')

// Get plugins with API capabilities
const apiPlugins = getPluginsWithAPI()

// Get plugins with entities
const entityPlugins = getPluginsWithEntities()
```

---

## Plugin API Functions

### usePlugin() - Generic Plugin Hook

**Recommended approach** for accessing plugin functions:

```typescript
import { usePlugin } from '@/core/lib/registries/plugin-registry'

// Get AI plugin API functions
const ai = usePlugin('ai')

// Check if plugin is available
if (ai.isAvailable()) {
  // Use plugin functions
  const result = await ai.generateText({
    prompt: 'Write a blog post',
    model: 'gpt-4'
  })
}

// Get plugin status
const status = ai.getStatus()
console.log(status)
// {
//   available: true,
//   pluginName: 'ai',
//   hasAPI: true,
//   functionCount: 8,
//   message: "Plugin 'ai' is available with 8 API functions"
// }
```

### getPluginFunction() - Direct Function Access

**Type-safe direct access** to specific functions:

```typescript
import { getPluginFunction } from '@/core/lib/registries/plugin-registry'

// Get specific function from plugin
const generateText = getPluginFunction<typeof import('@/contents/plugins/ai/api').generateText>(
  'ai',
  'generateText'
)

if (generateText) {
  const result = await generateText({
    prompt: 'Hello world',
    model: 'gpt-4'
  })
}
```

### getPluginFunctions() - List Available Functions

```typescript
import { getPluginFunctions } from '@/core/lib/registries/plugin-registry'

// Get all function names from plugin
const aiFunctions = getPluginFunctions('ai')

console.log(aiFunctions)
// ['generateText', 'enhanceText', 'analyzeText', 'getSuggestions', ...]
```

### hasPluginFunction() - Check Function Availability

```typescript
import { hasPluginFunction } from '@/core/lib/registries/plugin-registry'

if (hasPluginFunction('ai', 'generateText')) {
  // Function exists, safe to use
  const ai = usePlugin('ai')
  await ai.generateText({...})
}
```

---

## Plugin Entities

### Accessing Plugin Entities

```typescript
import {
  getAllPluginEntities,
  getPluginEntitiesByName
} from '@/core/lib/registries/plugin-registry'

// Get all entities across all plugins
const allEntities = getAllPluginEntities()

// Get entities from specific plugin
const aiEntities = getPluginEntitiesByName('ai')

console.log(aiEntities)
// [
//   {
//     name: 'ai-history',
//     exportName: 'aiHistoryEntityConfig',
//     pluginContext: { pluginName: 'ai' },
//     hasMigrations: true,
//     ...
//   }
// ]
```

### Entity Integration Example

```typescript
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
import { getPluginEntitiesByName } from '@/core/lib/registries/plugin-registry'

// Plugin entities are also in entity registry
const aiHistory = ENTITY_REGISTRY['ai-history']

// Can also access via plugin registry
const pluginEntities = getPluginEntitiesByName('ai')
const aiHistoryFromPlugin = pluginEntities.find(e => e.name === 'ai-history')

// Both refer to the same entity
console.log(aiHistory.slug === aiHistoryFromPlugin.name) // true
```

---

## Plugin Route Endpoints

### Accessing Route Endpoints

```typescript
import {
  getAllRouteEndpoints,
  findRouteEndpoint,
  getPluginRouteEndpoints
} from '@/core/lib/registries/plugin-registry'

// Get all plugin route endpoints
const allRoutes = getAllRouteEndpoints()

// Find specific endpoint
const generateEndpoint = findRouteEndpoint('/api/v1/plugin/ai/generate')

console.log(generateEndpoint)
// {
//   path: '/api/v1/plugin/ai/generate',
//   methods: ['POST', 'GET'],
//   filePath: '../../../contents/plugins/ai/api/generate/route',
//   relativePath: 'generate',
//   isRouteFile: true
// }

// Get all plugin routes
const pluginRoutes = getPluginRouteEndpoints()
```

### Route Metadata Access

```typescript
import { getRouteMetadata, hasRoute } from '@/core/lib/registries/plugin-registry'

// Get route metadata
const metadata = getRouteMetadata('/api/v1/plugin/ai/generate')

console.log(metadata)
// {
//   plugin: 'ai',
//   methods: ['POST', 'GET'],
//   filePath: '../../../contents/plugins/ai/api/generate/route'
// }

// Check if route exists
if (hasRoute('/api/v1/plugin/ai/generate', 'POST')) {
  // Route is available
}
```

### ROUTE_METADATA Registry

```typescript
export const ROUTE_METADATA = {
  '/api/v1/plugin/ai/ai-history/[id]': {
    plugin: 'ai',
    methods: ['PATCH'],
    filePath: '../../../contents/plugins/ai/api/ai-history/[id]/route'
  },
  '/api/v1/plugin/ai/embeddings': {
    plugin: 'ai',
    methods: ['POST', 'GET'],
    filePath: '../../../contents/plugins/ai/api/embeddings/route'
  },
  '/api/v1/plugin/ai/generate': {
    plugin: 'ai',
    methods: ['POST', 'GET'],
    filePath: '../../../contents/plugins/ai/api/generate/route'
  }
}
```

---

## Plugin Lifecycle

### Plugin Initialization

```typescript
import { initializeAllPlugins } from '@/core/lib/registries/plugin-registry'

// Called at app startup (server-side only)
await initializeAllPlugins()

// Executes onLoad hooks for all plugins
// Output:
// [Plugin Registry] Initializing plugin system...
// [Plugin Registry] Found 1 plugins to initialize
// [Plugin Registry] Loading plugin: ai
// [Plugin Registry] ✅ Plugin ai loaded successfully
// [Plugin Registry] ✅ Plugin system initialized successfully
```

### Plugin Hooks (plugin.config.ts)

```typescript
// contents/plugins/ai/plugin.config.ts
import type { PluginConfig } from '@/core/types/plugin'

export const aiPluginConfig: PluginConfig = {
  name: 'AI Assistant',
  slug: 'ai',
  version: '1.0.0',
  
  hooks: {
    // Called during plugin initialization
    onLoad: async () => {
      console.log('AI Plugin loaded')
      // Initialize connections, validate API keys, etc.
    },
    
    // Called before app shutdown
    onUnload: async () => {
      console.log('AI Plugin unloading')
      // Cleanup connections, save state, etc.
    }
  },
  
  // API functions exported from plugin
  api: {
    generateText: async (params) => { /* ... */ },
    enhanceText: async (params) => { /* ... */ },
    analyzeText: async (params) => { /* ... */ }
  }
}
```

---

## Client-Safe Registry Usage

### In Client Components

```typescript
'use client'

import { PLUGIN_REGISTRY_CLIENT } from '@/core/lib/registries/plugin-registry.client'

export function PluginList() {
  // ✅ Safe to use in client components
  const plugins = Object.values(PLUGIN_REGISTRY_CLIENT)
  
  return (
    <div>
      {plugins.map(plugin => (
        <div key={plugin.name}>
          <h3>{plugin.name}</h3>
          <p>Has API: {plugin.hasAPI ? 'Yes' : 'No'}</p>
          <p>Entities: {plugin.entities.length}</p>
        </div>
      ))}
    </div>
  )
}
```

### Client Registry Functions

```typescript
import {
  getPluginClient,
  hasPluginClient,
  getPluginEntitiesClient
} from '@/core/lib/registries/plugin-registry.client'

// Get plugin metadata (client-safe)
const aiPlugin = getPluginClient('ai')

// Check if plugin exists
const hasAI = hasPluginClient('ai')

// Get plugin entities (metadata only)
const aiEntities = getPluginEntitiesClient('ai')
```

---

## Real-World Examples

### Example 1: AI Text Generation

```typescript
// app/api/generate/route.ts
import { usePlugin } from '@/core/lib/registries/plugin-registry'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const ai = usePlugin('ai')
  
  // Check if AI plugin is available
  if (!ai.isAvailable()) {
    return NextResponse.json(
      { error: 'AI plugin not available' },
      { status: 503 }
    )
  }
  
  const { prompt } = await request.json()
  
  // Generate text using AI plugin
  const result = await ai.generateText({
    prompt,
    model: 'gpt-4',
    maxTokens: 1000
  })
  
  return NextResponse.json({ result })
}
```

### Example 2: Plugin Feature Detection

```typescript
// app/(protected)/dashboard/page.tsx
import { hasPluginFunction } from '@/core/lib/registries/plugin-registry'

export default async function DashboardPage() {
  // Check if AI features are available
  const hasAI = hasPluginFunction('ai', 'generateText')
  const hasBilling = hasPluginFunction('billing', 'createSubscription')
  
  return (
    <div>
      <h1>Dashboard</h1>
      
      {hasAI && (
        <section>
          <h2>AI Assistant</h2>
          <AITextGenerator />
        </section>
      )}
      
      {hasBilling && (
        <section>
          <h2>Billing</h2>
          <SubscriptionManager />
        </section>
      )}
    </div>
  )
}
```

### Example 3: Dynamic Plugin Menu

```typescript
'use client'

import { PLUGIN_REGISTRY_CLIENT } from '@/core/lib/registries/plugin-registry.client'

export function PluginMenu() {
  const plugins = Object.values(PLUGIN_REGISTRY_CLIENT)
    .filter(plugin => plugin.hasAPI)
  
  return (
    <nav>
      <h3>Available Plugins</h3>
      <ul>
        {plugins.map(plugin => (
          <li key={plugin.name}>
            <a href={`/dashboard/plugins/${plugin.name}`}>
              {plugin.name}
              {plugin.entities.length > 0 && (
                <span>({plugin.entities.length} entities)</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

### Example 4: Plugin Status Dashboard

```typescript
import { getRegisteredPlugins, getPluginFunctions } from '@/core/lib/registries/plugin-registry'

export async function PluginStatusPage() {
  const plugins = getRegisteredPlugins()
  
  return (
    <div>
      <h1>Plugin Status</h1>
      
      {plugins.map(plugin => {
        const functions = getPluginFunctions(plugin.slug as any)
        const entry = PLUGIN_REGISTRY[plugin.slug as keyof typeof PLUGIN_REGISTRY]
        
        return (
          <div key={plugin.slug}>
            <h2>{plugin.name} v{plugin.version}</h2>
            <p>Functions: {functions.length}</p>
            <p>Entities: {entry.entities.length}</p>
            <p>Routes: {entry.routeFiles.length}</p>
            
            <details>
              <summary>Available Functions</summary>
              <ul>
                {functions.map(func => (
                  <li key={func}>{func}()</li>
                ))}
              </ul>
            </details>
          </div>
        )
      })}
    </div>
  )
}
```

---

## Plugin Metadata

### Registry Metadata

```typescript
export const PLUGIN_METADATA = {
  totalPlugins: 1,
  pluginsWithAPI: 1,
  pluginsWithEntities: 1,
  pluginsWithMessages: 0,
  pluginsWithAssets: 0,
  totalRouteFiles: 3,
  totalPluginEntities: 1,
  generatedAt: '2025-11-20T02:53:31.032Z',
  plugins: ['ai']
}
```

### Usage in Application

```typescript
import { PLUGIN_METADATA } from '@/core/lib/registries/plugin-registry'

console.log(`Total plugins: ${PLUGIN_METADATA.totalPlugins}`)
console.log(`Plugins with API: ${PLUGIN_METADATA.pluginsWithAPI}`)
console.log(`Total plugin entities: ${PLUGIN_METADATA.totalPluginEntities}`)
console.log(`Total route files: ${PLUGIN_METADATA.totalRouteFiles}`)
```

---

## Security Considerations

### Server-Only Functions

**CRITICAL:** Plugin API functions often contain:
- API keys and secrets
- Database connections
- Node.js-specific code
- Server-only operations

**Never expose to client:**

```typescript
// ❌ FORBIDDEN - Exposes server-only code
'use client'
import { PLUGIN_REGISTRY } from '@/core/lib/registries/plugin-registry'

// ✅ CORRECT - Use client-safe registry
'use client'
import { PLUGIN_REGISTRY_CLIENT } from '@/core/lib/registries/plugin-registry.client'
```

### 'server-only' Import

The server registry uses `import 'server-only'` to enforce security:

```typescript
// core/lib/registries/plugin-registry.ts
import 'server-only'  // Prevents usage in 'use client' components

// Attempting to import in client component will error:
// Error: This module cannot be imported from a Client Component
```

### Client-Safe Patterns

```typescript
// ✅ Server Component: Direct access
import { usePlugin } from '@/core/lib/registries/plugin-registry'

export default async function ServerPage() {
  const ai = usePlugin('ai')
  const result = await ai.generateText({...})
  return <div>{result}</div>
}

// ✅ Client Component: Receive via props
'use client'

interface Props {
  aiResult: string
}

export function ClientDisplay({ aiResult }: Props) {
  return <div>{aiResult}</div>
}

// ✅ Client Component: Call API endpoint
'use client'

export function ClientGenerator() {
  const handleGenerate = async () => {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '...' })
    })
    const data = await response.json()
    return data.result
  }
  
  return <button onClick={handleGenerate}>Generate</button>
}
```

---

## Performance Characteristics

### Zero I/O Access

```typescript
// Before (Runtime I/O): ~60ms
const plugin = await findPlugin('ai')
const functions = await loadPluginFunctions(plugin.path)

// After (Registry): <1ms
const plugin = PLUGIN_REGISTRY.ai
const functions = getPluginFunctions('ai')
```

### Function Access Performance

```typescript
// Direct function access: <1ms
const generateText = usePlugin('ai').generateText

// Compared to dynamic import: ~40ms
const generateText = (await import(`@/contents/plugins/ai/api`)).generateText
```

---

## Best Practices

### ✅ DO: Use usePlugin() for Flexibility

```typescript
// Generic approach - works with any plugin
const plugin = usePlugin('ai')

// Check availability before use
if (plugin.isAvailable()) {
  await plugin.generateText({...})
}
```

### ✅ DO: Type Plugin Functions

```typescript
import { usePlugin } from '@/core/lib/registries/plugin-registry'
import type { AIPlugin } from '@/contents/plugins/ai/types'

const ai = usePlugin('ai') as AIPlugin

// Now have full type safety
const result = await ai.generateText({
  prompt: 'Hello',  // Autocomplete works!
  model: 'gpt-4'
})
```

### ✅ DO: Handle Unavailable Plugins

```typescript
const ai = usePlugin('ai')

if (!ai.isAvailable()) {
  // Plugin not available - graceful degradation
  return <div>AI features not available</div>
}

// Plugin available - use it
const result = await ai.generateText({...})
```

### ❌ DON'T: Import Plugin Configs Directly

```typescript
// ❌ FORBIDDEN
import { aiPluginConfig } from '@/contents/plugins/ai/plugin.config'

// ✅ CORRECT
import { usePlugin } from '@/core/lib/registries/plugin-registry'
const ai = usePlugin('ai')
```

### ❌ DON'T: Use Server Registry in Client Components

```typescript
// ❌ FORBIDDEN
'use client'
import { PLUGIN_REGISTRY } from '@/core/lib/registries/plugin-registry'

// ✅ CORRECT
'use client'
import { PLUGIN_REGISTRY_CLIENT } from '@/core/lib/registries/plugin-registry.client'
```

---

## Troubleshooting

### Plugin Not Found

**Problem:** `usePlugin('my-plugin')` returns unavailable status

**Solutions:**
1. Check plugin exists in `contents/plugins/my-plugin/`
2. Verify `plugin.config.ts` file exists
3. Run `pnpm registry:build` to regenerate
4. Restart dev server

### Function Not Available

**Problem:** `hasPluginFunction('ai', 'myFunction')` returns false

**Solutions:**
1. Check function is exported in `plugin.config.ts`
2. Verify function is in `api` object
3. Check function name spelling
4. Regenerate registry

### Client Component Error

**Problem:** "This module cannot be imported from a Client Component"

**Solutions:**
1. Use `plugin-registry.client` instead
2. Move code to server component
3. Use API route to call plugin function

---

## Type Safety

```typescript
import type {
  PluginRegistryEntry,
  PluginEntity,
  RouteFileEndpoint,
  PluginName
} from '@/core/lib/registries/plugin-registry'

// Strongly typed plugin access
const plugin: PluginRegistryEntry = PLUGIN_REGISTRY.ai

// Type-safe plugin name
const pluginName: PluginName = 'ai' // Auto-complete!

// Fully typed entities
const entities: PluginEntity[] = plugin.entities
```

---

## Next Steps

- **[Translation Registry](./06-translation-registry.md)** - i18n integration
- **[Route Handlers Registry](./07-route-handlers-registry.md)** - API route handling
- **[Performance & Caching](./08-performance-and-caching.md)** - Optimization strategies
- **[Entity Registry](./03-entity-registry.md)** - Entity system integration

---

**Last Updated**: 2025-11-20  
**Version**: 1.0.0  
**Status**: Complete  
**Auto-Generated**: Yes (by core/scripts/build/registry.mjs)  
**Registry Files**:
- `core/lib/registries/plugin-registry.ts` (server-only)
- `core/lib/registries/plugin-registry.client.ts` (client-safe)
