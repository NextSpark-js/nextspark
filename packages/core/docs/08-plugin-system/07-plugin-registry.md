# Plugin Registry Integration

## Introduction

The plugin registry system provides **build-time discovery** and **zero-runtime-I/O access** to all plugins. This document explains how plugins integrate with the registry, how to access plugin data in code, and security considerations for server/client separation.

**Key Concepts:**
- **Build-Time Discovery** - Plugins found and registered during build (~17,255x faster)
- **Dual Registries** - Server-only and client-safe versions
- **Type-Safe Access** - Helper functions with TypeScript support
- **Security-First** - Server functions never exposed to client
- **Automatic Initialization** - Lifecycle hooks executed automatically

---

## Plugin Discovery Process

### Build Script Detection

**Discovery Flow**:
```text
1. Build script runs: `core/scripts/build/registry.mjs`
   ↓
2. Scans: `contents/plugins/` directory
   ↓
3. Checks each subdirectory for: `plugin.config.ts`
   ↓
4. Extracts: Plugin configuration and metadata
   ↓
5. Generates: Server and client registries
   ↓
6. Outputs:
   - core/lib/registries/plugin-registry.ts (server-only)
   - core/lib/registries/plugin-registry.client.ts (client-safe)
```

**Build Script Logic**:
```mjs
// core/scripts/build/registry.mjs (simplified)
async function discoverPlugins() {
  const pluginsDir = join(CONFIG.contentsDir, 'plugins')
  const discovered = new Map()

  const entries = await readdir(pluginsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const configPath = join(pluginsDir, entry.name, 'plugin.config.ts')

      if (existsSync(configPath)) {
        const exportName = await extractExportName(configPath)
        const capabilities = await analyzePluginCapabilities(entry.name)

        discovered.set(entry.name, {
          name: entry.name,
          configPath,
          exportName,
          ...capabilities
        })
      }
    }
  }

  return Array.from(discovered.values())
}
```

---

## Server vs Client Registries

### Server-Only Registry

**File**: `core/lib/registries/plugin-registry.ts`

**Features**:
- ✅ Full plugin configuration
- ✅ All API functions
- ✅ Lifecycle hooks
- ✅ Route handler metadata
- ✅ Entity configurations

**Structure**:
```typescript
import 'server-only' // ⚠️ Prevents client usage

import { aiPluginConfig } from '@/contents/plugins/ai/plugin.config'
import { billingPluginConfig } from '@/contents/plugins/billing/plugin.config'

export const PLUGIN_REGISTRY = {
  'ai': {
    name: 'ai',
    config: aiPluginConfig,
    hasAPI: true,
    apiPath: '@/contents/plugins/ai/api',
    routeFiles: [
      {
        path: '/api/v1/plugin/ai/generate',
        methods: ['POST', 'GET'],
        filePath: '../../../contents/plugins/ai/api/generate/route'
      }
    ],
    entities: ['ai-history'],
    hasMessages: false,
    hasAssets: false
  },
  'billing': {
    name: 'billing',
    config: billingPluginConfig,
    hasAPI: true,
    apiPath: '@/contents/plugins/billing/api',
    routeFiles: [...],
    entities: ['subscriptions', 'invoices'],
    hasMessages: true,
    hasAssets: false
  }
}
```

---

### Client-Safe Registry

**File**: `core/lib/registries/plugin-registry.client.ts`

**Features**:
- ✅ Plugin names and metadata
- ✅ Boolean capability flags
- ✅ Entity name lists (no configs)
- ❌ NO API functions
- ❌ NO route handlers
- ❌ NO sensitive data

**Structure**:
```typescript
// NO server-only import - safe for client

export const PLUGIN_REGISTRY: ClientPluginRegistry = {
  'ai': {
    name: 'ai',
    hasAPI: true,        // Boolean only
    apiPath: '@/contents/plugins/ai/api',
    entities: ['ai-history'], // Names only
    hasMessages: false,
    hasAssets: false
  },
  'billing': {
    name: 'billing',
    hasAPI: true,
    apiPath: '@/contents/plugins/billing/api',
    entities: ['subscriptions', 'invoices'],
    hasMessages: true,
    hasAssets: false
  }
}
```

---

## Accessing Plugins in Code

### Server Components

**Import from server registry**:
```typescript
// app/page.tsx (Server Component)
import { usePlugin } from '@/core/lib/registries/plugin-registry'

export default async function Page() {
  // ✅ Access all plugin functions
  const { generateText, calculateCost } = usePlugin('ai')

  // Call plugin functions
  const result = await generateText('Write a blog post')
  const cost = calculateCost(result.tokens)

  return (
    <div>
      <p>{result.text}</p>
      <p>Cost: ${cost}</p>
    </div>
  )
}
```

---

### API Routes

**Access plugins in API endpoints**:
```typescript
// app/api/process/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { usePlugin } from '@/core/lib/registries/plugin-registry'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'

export async function POST(request: NextRequest) {
  // Authenticate
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get plugin functions
  const { processData } = usePlugin('my-plugin')

  // Process request
  const { input } = await request.json()
  const result = await processData(input)

  return NextResponse.json(result)
}
```

---

### Client Components

**Import from client registry**:
```typescript
// components/PluginStatus.tsx
'use client'

import { getAllPlugins, hasPlugin } from '@/core/lib/registries/plugin-registry.client'

export function PluginStatus() {
  const plugins = getAllPlugins()

  return (
    <div>
      <h2>Available Plugins</h2>
      <ul>
        {plugins.map(plugin => (
          <li key={plugin.name}>
            {plugin.name} - API: {plugin.hasAPI ? '✅' : '❌'}
          </li>
        ))}
      </ul>

      {hasPlugin('ai') && (
        <p>AI plugin is available</p>
      )}
    </div>
  )
}
```

---

## Plugin Registry API

### Server-Only Functions

#### `getRegisteredPlugins()`
Get all registered plugin configurations.

```typescript
import { getRegisteredPlugins } from '@/core/lib/registries/plugin-registry'

const plugins = getRegisteredPlugins()
// Returns: PluginConfig[]
```

---

#### `getPlugin(name)`
Get specific plugin configuration.

```typescript
import { getPlugin } from '@/core/lib/registries/plugin-registry'

const aiPlugin = getPlugin('ai')
if (aiPlugin) {
  console.log(aiPlugin.name, aiPlugin.version)
}
```

---

#### `usePlugin(name)`
**Recommended API** for accessing plugin functions.

```typescript
import { usePlugin } from '@/core/lib/registries/plugin-registry'

const { generateText, enhanceText } = usePlugin('ai')
const result = await generateText('prompt')
```

**With availability check**:
```typescript
const { generateText, isAvailable, getStatus } = usePlugin('ai')

if (!isAvailable()) {
  const status = getStatus()
  console.warn('AI plugin unavailable:', status.message)
  return
}

const result = await generateText('prompt')
```

---

#### `getPluginsWithAPI()`
Get all plugins that have API capabilities.

```typescript
import { getPluginsWithAPI } from '@/core/lib/registries/plugin-registry'

const apiPlugins = getPluginsWithAPI()
apiPlugins.forEach(plugin => {
  console.log(`${plugin.name} has API at ${plugin.apiPath}`)
})
```

---

#### `getPluginsWithEntities()`
Get all plugins that define entities.

```typescript
import { getPluginsWithEntities } from '@/core/lib/registries/plugin-registry'

const entityPlugins = getPluginsWithEntities()
console.log(`Found ${entityPlugins.length} plugins with entities`)
```

---

#### `getAllRouteEndpoints()`
Get all route file endpoints across all plugins.

```typescript
import { getAllRouteEndpoints } from '@/core/lib/registries/plugin-registry'

const routes = getAllRouteEndpoints()
routes.forEach(route => {
  console.log(`${route.methods.join('|')} ${route.path}`)
})
// Output:
// POST|GET /api/v1/plugin/ai/generate
// POST /api/v1/plugin/billing/subscriptions
```

---

### Client-Safe Functions

#### `getPlugin(name)` (Client version)
Get client-safe plugin metadata.

```typescript
'use client'

import { getPlugin } from '@/core/lib/registries/plugin-registry.client'

const plugin = getPlugin('ai')
// Returns: { name, hasAPI, entities, hasMessages, hasAssets }
```

---

#### `getAllPlugins()` (Client version)
Get all client-safe plugin metadata.

```typescript
'use client'

import { getAllPlugins } from '@/core/lib/registries/plugin-registry.client'

const plugins = getAllPlugins()
```

---

#### `hasPlugin(name)` (Client version)
Check if plugin exists.

```typescript
'use client'

import { hasPlugin } from '@/core/lib/registries/plugin-registry.client'

if (hasPlugin('ai')) {
  console.log('AI plugin available')
}
```

---

## Security Patterns

### Server-Only Import Guard

**Protection Mechanism**:
```typescript
// core/lib/registries/plugin-registry.ts
import 'server-only' // ⚠️ Throws error if imported in client

// This registry can ONLY be imported in:
// - Server Components
// - API Routes
// - Server Actions
// - Middleware (server-side)
```

**Error when imported in client**:
```text
Error: This module cannot be imported from a Client Component module.
It should only be used from a Server Component.
```

---

### Secure Plugin Access Pattern

**❌ WRONG - Exposes server functions to client**:
```typescript
'use client'
import { usePlugin } from '@/core/lib/registries/plugin-registry'

export function ClientComponent() {
  const { generateText } = usePlugin('ai') // ❌ Error: server-only
}
```

**✅ CORRECT - Server component passes data to client**:
```typescript
// app/ai/page.tsx (Server Component)
import { usePlugin } from '@/core/lib/registries/plugin-registry'

export default async function AIPage() {
  const { generateText } = usePlugin('ai')
  const result = await generateText('prompt') // ✅ Server-side

  return <ClientDisplay result={result} /> // ✅ Only data to client
}

// components/ClientDisplay.tsx (Client Component)
'use client'

export function ClientDisplay({ result }: { result: string }) {
  return <div>{result}</div>
}
```

---

## Plugin Initialization

### Automatic Initialization

**Plugins with `onLoad` hooks** are automatically initialized when the server starts:

```typescript
// core/lib/plugins/plugin-loader.ts
import { PLUGIN_REGISTRY } from '@/core/lib/registries/plugin-registry'

export async function initializePlugins() {
  const plugins = Object.values(PLUGIN_REGISTRY)

  for (const plugin of plugins) {
    if (plugin.config.hooks?.onLoad) {
      await plugin.config.hooks.onLoad()
    }
  }
}

// Called during server startup
```

**Manual initialization**:
```typescript
// app/api/init/route.ts
import { initializeAllPlugins } from '@/core/lib/registries/plugin-registry'

export async function POST() {
  await initializeAllPlugins()
  return new Response('Plugins initialized', { status: 200 })
}
```

---

## Registry Regeneration

### When to Rebuild

**Rebuild registry when**:
- Adding a new plugin
- Modifying `plugin.config.ts`
- Adding/removing API endpoints
- Adding/removing entities
- Changing plugin capabilities

**Build Commands**:
```bash
# Rebuild registry
pnpm registry:build

# Rebuild in watch mode (development)
pnpm registry:build-watch

# Full build (includes registry)
pnpm build
```

**Automatic Regeneration**:
```bash
# Development server rebuilds registry on changes
pnpm dev
```

---

## Performance Characteristics

### Build-Time vs Runtime Comparison

| Operation | Runtime | Build-Time | Improvement |
|-----------|---------|------------|-------------|
| **Plugin Discovery** | 1,750ms | 0.1ms | **~17,500x** |
| **Plugin Load** | 140ms/plugin | 0.01ms | **~14,000x** |
| **Config Access** | 50ms | 0.01ms | **~5,000x** |
| **Total (10 plugins)** | 1,750ms | 0.1ms | **~17,255x** |

**Memory Footprint**:
```typescript
// Server registry with 10 plugins:
// - 10 static imports: ~50KB
// - 10 registry entries: ~5KB
// Total: ~55KB

// Client registry with 10 plugins:
// - No imports (metadata only)
// - 10 registry entries: ~2KB
// Total: ~2KB (97% smaller)
```

---

## Common Patterns

### Pattern 1: Conditional Plugin Loading

```typescript
import { hasPlugin, usePlugin } from '@/core/lib/registries/plugin-registry'

export async function processWithAI(text: string) {
  if (!hasPlugin('ai')) {
    console.warn('AI plugin not available, using fallback')
    return fallbackProcess(text)
  }

  const { enhanceText } = usePlugin('ai')
  return await enhanceText(text)
}
```

---

### Pattern 2: Plugin Feature Detection

```typescript
import { getPlugin } from '@/core/lib/registries/plugin-registry'

export function checkPluginFeatures() {
  const aiPlugin = getPlugin('ai')

  if (aiPlugin) {
    console.log('AI Plugin Features:')
    console.log('- Has API:', aiPlugin.hasAPI)
    console.log('- Entities:', aiPlugin.entities)
    console.log('- Version:', aiPlugin.config.version)
  }
}
```

---

### Pattern 3: List All Plugin Routes

```typescript
import { getAllRouteEndpoints } from '@/core/lib/registries/plugin-registry'

export default async function RoutesPage() {
  const routes = getAllRouteEndpoints()

  return (
    <div>
      <h1>Plugin API Routes</h1>
      <ul>
        {routes.map(route => (
          <li key={route.path}>
            <strong>{route.methods.join(', ')}</strong> {route.path}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

---

## Troubleshooting

### Issue 1: "This module cannot be imported from a Client Component"

**Symptom**: Error when importing server registry in client component

**Solution**: Use client-safe registry instead
```typescript
// ❌ Wrong
'use client'
import { usePlugin } from '@/core/lib/registries/plugin-registry'

// ✅ Correct
'use client'
import { getPlugin } from '@/core/lib/registries/plugin-registry.client'
```

---

### Issue 2: Plugin Function Returns Undefined

**Symptom**: `getPluginFunction()` returns `undefined`

**Cause**: Function doesn't exist or plugin has no API

**Solution**: Check if function exists first
```typescript
import { hasPluginFunction, getPluginFunction } from '@/core/lib/registries/plugin-registry'

if (hasPluginFunction('ai', 'generateText')) {
  const generateText = getPluginFunction('ai', 'generateText')
  await generateText('prompt')
} else {
  console.warn('Function not available')
}
```

---

### Issue 3: Plugin Not Found in Registry

**Symptom**: `getPlugin()` returns `undefined`

**Cause**: Plugin not discovered during build

**Solution**: Rebuild registry
```bash
# Check plugin.config.ts exists
ls contents/plugins/my-plugin/plugin.config.ts

# Rebuild registry
pnpm registry:build

# Verify plugin in generated registry
cat core/lib/registries/plugin-registry.ts | grep "'my-plugin'"
```

---

## Summary

**Plugin Registry provides**:
- ✅ **Build-time discovery** (~17,255x faster than runtime)
- ✅ **Dual registries** (server-only + client-safe)
- ✅ **Type-safe access** with helper functions
- ✅ **Security isolation** (server-only import guard)
- ✅ **Automatic initialization** (onLoad hooks)
- ✅ **Zero-runtime-I/O** (all config pre-loaded)

**When to use**:
- ✅ Accessing plugin API functions (server-only)
- ✅ Checking plugin availability
- ✅ Listing plugin routes and entities
- ✅ Displaying plugin metadata in UI (client-safe)
- ✅ Conditional plugin features

**Security best practices**:
- ✅ Use server registry only in Server Components/API Routes
- ✅ Use client registry for metadata in Client Components
- ✅ Never expose API functions to client
- ✅ Always authenticate in route handlers

**Next:** [Testing Plugins](./08-testing-plugins.md) - Jest and Cypress testing patterns

---

**For complete plugin registry reference**, see [Plugin Registry](../03-registry-system/04-plugin-registry.md)

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
