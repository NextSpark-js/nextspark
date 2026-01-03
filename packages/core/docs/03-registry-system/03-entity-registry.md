# Entity Registry

## Introduction

The Entity Registry is the **most frequently used registry** in the system. It provides instant, zero-I/O access to all entities (from core, themes, and plugins). Following the **data-only pattern**, the registry exports pure data, while helper functions are available in the client registry.

**Files:**
- `core/lib/registries/entity-registry.ts` - Server-side data-only registry
- `core/lib/registries/entity-registry.client.ts` - Client-safe registry with 8 helper functions

**Pattern:** Data-only (query functions in client registry)
**Performance:** <1ms for all operations
**Usage:** Server Components, API routes, services

---

## Overview

### What Is It?

**Static TypeScript files** containing:
- All discovered entities (core + theme + plugin)
- Full metadata for each entity
- Type-safe entity names
- Zero runtime I/O

**Data-Only Pattern:**
- `entity-registry.ts` - Pure data exports (no functions)
- `entity-registry.client.ts` - Data + 8 helper functions for client-side queries

### Why It Exists?

**Performance:** ~17,255x faster than runtime discovery
- Runtime discovery: 140ms per entity
- Registry lookup: <1ms for all entities

**Type Safety:** Full TypeScript autocomplete for entity names

**Convenience:** 8 helper functions for common queries (in client registry)

---

## Registry Structure

### ENTITY_REGISTRY Object

**Type:** `Record<EntityName, EntityRegistryEntry>`

**Example:**

```typescript
export const ENTITY_REGISTRY = {
  'ai-history': {
    name: 'ai-history',
    config: aiHistoryEntityConfig,
    tableName: 'ai-history',
    relativePath: 'ai-history',
    depth: 0,
    parent: null,
    children: [],
    hasComponents: false,
    hasHooks: false,
    hasMigrations: true,
    hasMessages: true,
    hasAssets: false,
    messagesPath: '@/contents/plugins/ai/entities/ai-history/messages',
    pluginContext: { pluginName: 'ai' },
    themeContext: null,
    isCore: false,
    source: 'plugin' as const
  },
  'tasks': {
    name: 'tasks',
    config: taskEntityConfig,
    tableName: 'tasks',
    relativePath: 'tasks',
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
    isCore: false,
    source: 'theme' as const
  }
}
```

### EntityRegistryEntry Interface

**17 properties per entity:**

```typescript
export interface EntityRegistryEntry {
  // Basic info
  name: string                          // Entity name
  config: EntityConfig | ChildEntityDefinition  // Full config
  tableName?: string                    // Database table name
  relativePath: string                  // Path relative to entities/

  // Hierarchy
  depth: number                         // Nesting level (0 = root)
  parent: string | null                 // Parent entity name
  children: string[]                    // Child entity names

  // Resources
  hasComponents: boolean                // Has components/ directory
  hasHooks: boolean                     // Has hooks/ directory
  hasMigrations: boolean                // Has migrations/ directory
  hasMessages: boolean                  // Has messages/ directory (i18n)
  hasAssets: boolean                    // Has assets/ directory
  messagesPath: string                  // Path to messages directory

  // Ownership
  pluginContext: EntityPluginContext | null  // Plugin that owns this
  themeContext: EntityThemeContext | null    // Theme that owns this
  isCore?: boolean                      // Core entity (cannot override)
  source?: 'core' | 'theme' | 'plugin' // Source type
}
```

**Property explanations:**

| Property | Description | Example |
|----------|-------------|---------|
| `name` | Unique entity identifier | `'tasks'`, `'ai-history'` |
| `config` | Full EntityConfig object | `{ label: 'Tasks', ... }` |
| `tableName` | Database table name | `'tasks'` |
| `relativePath` | Path from entities/ | `'tasks'`, `'products/variants'` |
| `depth` | Hierarchy level | `0` (root), `1` (child), `2` (grandchild) |
| `parent` | Parent entity name | `null` (root), `'products'` (child) |
| `children` | Array of child names | `['variants', 'reviews']` |
| `hasComponents` | Entity has custom components | `true`/`false` |
| `hasHooks` | Entity has custom hooks | `true`/`false` |
| `hasMigrations` | Entity has database migrations | `true`/`false` |
| `hasMessages` | Entity has translations | `true`/`false` |
| `hasAssets` | Entity has static assets | `true`/`false` |
| `messagesPath` | Translation file path | `'@/contents/.../messages'` |
| `pluginContext` | Owner plugin info | `{ pluginName: 'ai' }` |
| `themeContext` | Owner theme info | `{ themeName: 'default' }` |
| `isCore` | Core entity (protected) | `true`/`false` |
| `source` | Where entity is defined | `'core'`, `'theme'`, `'plugin'` |

---

## Server vs Client Registries

### entity-registry.ts (Server-Only)

**Location:** `core/lib/registries/entity-registry.ts`
**Usage:** Server Components, API routes, services
**Features:** Full registry with all metadata

```typescript
import { ENTITY_REGISTRY, getEntity } from '@/core/lib/registries/entity-registry'

// Server Component
export default async function Page() {
  const taskConfig = ENTITY_REGISTRY.tasks // Full access
  // ...
}
```

### entity-registry.client.ts (Client-Safe)

**Location:** `core/lib/registries/entity-registry.client.ts`
**Usage:** Client Components (`'use client'`)
**Features:** Subset of registry (no server-only data)

```typescript
'use client'

import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry.client'

export function EntityCard({ entityName }: { entityName: string }) {
  const config = ENTITY_REGISTRY[entityName] // Client-safe access
  // ...
}
```

**Pattern: Pass data from server to client**

```typescript
// Server Component (parent)
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
import { ClientComponent } from './ClientComponent'

export default async function ServerPage() {
  const taskConfig = ENTITY_REGISTRY.tasks

  return <ClientComponent config={taskConfig} />
}

// Client Component (child)
'use client'

import type { EntityConfig } from '@/core/lib/entities/types'

export function ClientComponent({ config }: { config: EntityConfig }) {
  // Use config passed from server
  return <div>{config.label}</div>
}
```

---

## Helper Functions

### 1. getRegisteredEntities()

**Get all entity configs** (ultra-fast, zero I/O)

```typescript
export function getRegisteredEntities(): (EntityConfig | ChildEntityDefinition)[]
```

**Usage:**

```typescript
import { getRegisteredEntities } from '@/core/lib/registries/entity-registry'

// Get all entities
const entities = getRegisteredEntities()
// Returns: [taskEntityConfig, aiHistoryEntityConfig, ...]

// Use in components
entities.map(entity => (
  <EntityCard key={entity.name} entity={entity} />
))
```

**Returns:** Array of all entity configs (not metadata, just configs)

**Performance:** <1ms for 1,000+ entities

### 2. getEntity(name)

**Get single entity config by name** (ultra-fast, zero I/O)

```typescript
export function getEntity(name: EntityName): EntityConfig | ChildEntityDefinition | undefined
```

**Usage:**

```typescript
import { getEntity } from '@/core/lib/registries/entity-registry'

// Get specific entity
const taskConfig = getEntity('tasks')
// Returns: taskEntityConfig

// Type-safe entity names
const config = getEntity('invalid-name') // TypeScript error ✅
```

**Returns:** Entity config or `undefined` if not found

**Type Safety:** `EntityName` type ensures only valid entity names

### 3. getEntityMetadata(name)

**Get entity with full metadata**

```typescript
export function getEntityMetadata(name: EntityName): EntityRegistryEntry | undefined
```

**Usage:**

```typescript
import { getEntityMetadata } from '@/core/lib/registries/entity-registry'

// Get full metadata
const taskMeta = getEntityMetadata('tasks')
// Returns: {
//   name: 'tasks',
//   config: taskEntityConfig,
//   tableName: 'tasks',
//   hasComponents: false,
//   hasHooks: false,
//   hasMigrations: true,
//   hasMessages: true,
//   ...
// }

// Check capabilities
if (taskMeta?.hasMessages) {
  // Load translations
}

if (taskMeta?.hasComponents) {
  // Load custom components
}
```

**Returns:** Full `EntityRegistryEntry` with all 17 properties

**Use case:** When you need metadata beyond just the config

### 4. getRootEntities()

**Get root entities** (entities without parent)

```typescript
export function getRootEntities(): EntityRegistryEntry[]
```

**Usage:**

```typescript
import { getRootEntities } from '@/core/lib/registries/entity-registry'

// Get only root-level entities
const roots = getRootEntities()
// Returns: [{ name: 'tasks', parent: null, ... }, ...]

// Build navigation
roots.map(entity => (
  <NavItem key={entity.name} entity={entity} />
))
```

**Returns:** Array of entities with `parent: null`

**Use case:** Building top-level navigation, entity lists

### 5. getChildEntities(parentName)

**Get child entities of a parent**

```typescript
export function getChildEntities(parentName: EntityName): EntityRegistryEntry[]
```

**Usage:**

```typescript
import { getChildEntities } from '@/core/lib/registries/entity-registry'

// Get children of 'products'
const variants = getChildEntities('products')
// Returns: [{ name: 'variants', parent: 'products', ... }, ...]

// Recursive navigation
function EntityNav({ entityName }: { entityName: EntityName }) {
  const children = getChildEntities(entityName)

  return (
    <ul>
      {children.map(child => (
        <li key={child.name}>
          {child.name}
          <EntityNav entityName={child.name} />
        </li>
      ))}
    </ul>
  )
}
```

**Returns:** Array of entities with matching `parent`

**Use case:** Hierarchical entity navigation, nested menus

### 6. getEntityTree()

**Get entity tree** (hierarchical structure)

```typescript
export function getEntityTree(): EntityRegistryEntry[]
```

**Usage:**

```typescript
import { getEntityTree } from '@/core/lib/registries/entity-registry'

// Get full tree (roots with nested children)
const tree = getEntityTree()
// Returns: [
//   {
//     name: 'products',
//     parent: null,
//     children: [
//       { name: 'variants', parent: 'products', children: [...] },
//       { name: 'reviews', parent: 'products', children: [...] }
//     ]
//   },
//   ...
// ]

// Render tree
function EntityTree({ tree }: { tree: EntityRegistryEntry[] }) {
  return (
    <ul>
      {tree.map(node => (
        <li key={node.name}>
          {node.config.label}
          {node.children.length > 0 && (
            <EntityTree tree={node.children} />
          )}
        </li>
      ))}
    </ul>
  )
}
```

**Returns:** Array of root entities with nested `children` populated

**Use case:** Sidebar navigation, entity hierarchy visualization

### 7. getEntitiesByDepth(depth)

**Get entities by depth level**

```typescript
export function getEntitiesByDepth(depth: number): EntityRegistryEntry[]
```

**Usage:**

```typescript
import { getEntitiesByDepth } from '@/core/lib/registries/entity-registry'

// Get all root entities (depth 0)
const roots = getEntitiesByDepth(0)

// Get all first-level children (depth 1)
const firstLevel = getEntitiesByDepth(1)

// Get all second-level children (depth 2)
const secondLevel = getEntitiesByDepth(2)
```

**Returns:** Array of entities at specified depth

**Use case:** Breadcrumb generation, hierarchy analysis

### 8. getEntityTableName(name)

**Get database table name for entity**

```typescript
export function getEntityTableName(name: EntityName): string | undefined
```

**Usage:**

```typescript
import { getEntityTableName } from '@/core/lib/registries/entity-registry'

// Get table name
const tableName = getEntityTableName('tasks')
// Returns: 'tasks'

// Use in dynamic queries
const data = await db.query(`SELECT * FROM ${tableName}`)
```

**Returns:** Database table name or `undefined`

**Use case:** Dynamic service layer, database queries

### 9. getEntityByTableName(tableName)

**Get entity by table name** (reverse lookup)

```typescript
export function getEntityByTableName(tableName: string): EntityRegistryEntry | undefined
```

**Usage:**

```typescript
import { getEntityByTableName } from '@/core/lib/registries/entity-registry'

// Reverse lookup from table name
const entity = getEntityByTableName('tasks')
// Returns: { name: 'tasks', config: ..., ... }

// Use in database triggers/webhooks
function handleDatabaseEvent(tableName: string) {
  const entity = getEntityByTableName(tableName)
  if (entity) {
    // Process entity-specific logic
  }
}
```

**Returns:** Full entity metadata or `undefined`

**Use case:** Database event handlers, webhooks

### 10. getPluginEntities(pluginName)

**Get all entities from a plugin**

```typescript
export function getPluginEntities(pluginName: string): EntityRegistryEntry[]
```

**Usage:**

```typescript
import { getPluginEntities } from '@/core/lib/registries/entity-registry'

// Get all AI plugin entities
const aiEntities = getPluginEntities('ai')
// Returns: [{ name: 'ai-history', pluginContext: { pluginName: 'ai' }, ... }]

// Plugin dashboard
function PluginDashboard({ pluginName }: { pluginName: string }) {
  const entities = getPluginEntities(pluginName)

  return (
    <div>
      <h2>{pluginName} Entities</h2>
      <ul>
        {entities.map(entity => (
          <li key={entity.name}>{entity.config.label}</li>
        ))}
      </ul>
    </div>
  )
}
```

**Returns:** Array of entities owned by plugin

**Use case:** Plugin management, plugin dashboards

### 11. getThemeEntities(themeName)

**Get all entities from a theme**

```typescript
export function getThemeEntities(themeName: string): EntityRegistryEntry[]
```

**Usage:**

```typescript
import { getThemeEntities } from '@/core/lib/registries/entity-registry'

// Get all theme entities
const themeEntities = getThemeEntities('default')
// Returns: [{ name: 'tasks', themeContext: { themeName: 'default' }, ... }]

// Theme configuration
function ThemeConfig({ themeName }: { themeName: string }) {
  const entities = getThemeEntities(themeName)

  return (
    <div>
      <h2>Theme: {themeName}</h2>
      <p>Entities: {entities.length}</p>
    </div>
  )
}
```

**Returns:** Array of entities owned by theme

**Use case:** Theme management, theme customization

### 12. getEntityOwner(entityName)

**Get entity owner** (plugin, theme, or core)

```typescript
export function getEntityOwner(entityName: EntityName): { type: 'plugin' | 'theme' | 'core', name: string } | null
```

**Usage:**

```typescript
import { getEntityOwner } from '@/core/lib/registries/entity-registry'

// Get owner info
const owner = getEntityOwner('tasks')
// Returns: { type: 'theme', name: 'default' }

const aiOwner = getEntityOwner('ai-history')
// Returns: { type: 'plugin', name: 'ai' }

// Display ownership
function EntityInfo({ entityName }: { entityName: EntityName }) {
  const owner = getEntityOwner(entityName)

  return (
    <div>
      <p>Owned by: {owner?.type} ({owner?.name})</p>
    </div>
  )
}
```

**Returns:** Owner info or `null`

**Use case:** Entity attribution, permissions, debugging

### 13. getEntityBySlug(slug)

**Get entity by slug** (ultra-fast, zero I/O)

```typescript
export function getEntityBySlug(slug: string): EntityConfig | ChildEntityDefinition | undefined
```

**Usage:**

```typescript
import { getEntityBySlug } from '@/core/lib/registries/entity-registry'

// Get entity by slug
const entity = getEntityBySlug('tasks')
// Returns: taskEntityConfig

// URL routing
async function EntityPage({ params }: { params: { slug: string } }) {
  const entity = getEntityBySlug(params.slug)

  if (!entity) {
    notFound()
  }

  return <EntityDetail entity={entity} />
}
```

**Returns:** Entity config or `undefined`

**Use case:** URL routing, slug-based lookups

---

## ENTITY_METADATA

**Registry statistics** (auto-generated)

```typescript
export const ENTITY_METADATA = {
  totalEntities: 2,
  coreEntities: 0,
  pluginEntities: 1,
  themeEntities: 1,
  entitiesWithComponents: 0,
  entitiesWithHooks: 0,
  entitiesWithMigrations: 2,
  entitiesWithMessages: 2,
  entitiesWithAssets: 0,
  maxDepth: 0,
  generatedAt: '2025-11-19T20:33:45.810Z',
  entities: ['ai-history', 'tasks']
}
```

**Usage:**

```typescript
import { ENTITY_METADATA } from '@/core/lib/registries/entity-registry'

// Display statistics
console.log(`Total entities: ${ENTITY_METADATA.totalEntities}`)
console.log(`Generated at: ${ENTITY_METADATA.generatedAt}`)

// Dashboard stats
function EntityStats() {
  return (
    <div>
      <p>Total: {ENTITY_METADATA.totalEntities}</p>
      <p>Core: {ENTITY_METADATA.coreEntities}</p>
      <p>Plugin: {ENTITY_METADATA.pluginEntities}</p>
      <p>Theme: {ENTITY_METADATA.themeEntities}</p>
    </div>
  )
}
```

---

## Common Patterns

### Pattern 1: Entity List Page

```typescript
// app/(protected)/entities/page.tsx
import { getRootEntities } from '@/core/lib/registries/entity-registry'
import { EntityCard } from '@/core/components/entities/EntityCard'

export default async function EntitiesPage() {
  const entities = getRootEntities()

  return (
    <div className="grid grid-cols-3 gap-4">
      {entities.map(entity => (
        <EntityCard key={entity.name} entity={entity} />
      ))}
    </div>
  )
}
```

### Pattern 2: Dynamic Entity Page

```typescript
// app/(protected)/entities/[slug]/page.tsx
import { getEntityBySlug } from '@/core/lib/registries/entity-registry'
import { notFound } from 'next/navigation'

export default async function EntityPage({ params }: { params: { slug: string } }) {
  const entity = getEntityBySlug(params.slug)

  if (!entity) {
    notFound()
  }

  return (
    <div>
      <h1>{entity.label}</h1>
      <p>{entity.description}</p>
    </div>
  )
}
```

### Pattern 3: API Route with Entity

```typescript
// app/api/v1/[entity]/route.ts
import { getEntity, getEntityTableName } from '@/core/lib/registries/entity-registry'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { entity: string } }
) {
  const entityConfig = getEntity(params.entity)
  if (!entityConfig) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }

  const tableName = getEntityTableName(params.entity)
  const data = await db.query(`SELECT * FROM ${tableName}`)

  return NextResponse.json({ data })
}
```

### Pattern 4: Hierarchical Navigation

```typescript
// core/components/EntityNav.tsx
import { getEntityTree } from '@/core/lib/registries/entity-registry'
import type { EntityRegistryEntry } from '@/core/lib/registries/entity-registry'

export async function EntityNav() {
  const tree = getEntityTree()

  return (
    <nav>
      <TreeLevel nodes={tree} />
    </nav>
  )
}

function TreeLevel({ nodes }: { nodes: EntityRegistryEntry[] }) {
  return (
    <ul>
      {nodes.map(node => (
        <li key={node.name}>
          <a href={`/entities/${node.name}`}>{node.config.label}</a>
          {node.children.length > 0 && (
            <TreeLevel nodes={node.children} />
          )}
        </li>
      ))}
    </ul>
  )
}
```

---

## Testing Patterns

### Mock Server-Only Registry

```typescript
// __tests__/components/EntityList.test.tsx
jest.mock('server-only', () => ({})) // Allow testing server components

import { getRegisteredEntities } from '@/core/lib/registries/entity-registry'
import { EntityList } from '@/components/EntityList'

describe('EntityList', () => {
  it('should render all entities', () => {
    const entities = getRegisteredEntities()
    const { container } = render(<EntityList entities={entities} />)
    expect(container).toMatchSnapshot()
  })
})
```

### Test Helper Functions

```typescript
// __tests__/registries/entity-registry.test.ts
import {
  getEntity,
  getRootEntities,
  getChildEntities,
  getPluginEntities
} from '@/core/lib/registries/entity-registry'

describe('Entity Registry', () => {
  it('should get entity by name', () => {
    const entity = getEntity('tasks')
    expect(entity).toBeDefined()
    expect(entity?.name).toBe('tasks')
  })

  it('should get root entities', () => {
    const roots = getRootEntities()
    expect(roots.length).toBeGreaterThan(0)
    expect(roots.every(e => e.parent === null)).toBe(true)
  })

  it('should get plugin entities', () => {
    const aiEntities = getPluginEntities('ai')
    expect(aiEntities.length).toBeGreaterThan(0)
    expect(aiEntities.every(e => e.pluginContext?.pluginName === 'ai')).toBe(true)
  })
})
```

---

## Performance Characteristics

**All operations are O(1) or O(n) with n = total entities:**

| Function | Complexity | Performance |
|----------|------------|-------------|
| `ENTITY_REGISTRY.tasks` | O(1) | <0.1ms |
| `getEntity(name)` | O(1) | <0.1ms |
| `getEntityMetadata(name)` | O(1) | <0.1ms |
| `getRegisteredEntities()` | O(n) | <1ms for 1,000 entities |
| `getRootEntities()` | O(n) | <1ms for 1,000 entities |
| `getChildEntities(parent)` | O(n) | <1ms for 1,000 entities |
| `getEntityTree()` | O(n × depth) | <2ms for 1,000 entities |
| `getPluginEntities(plugin)` | O(n) | <1ms for 1,000 entities |

**Scaling:**
- 10 entities: <0.5ms
- 100 entities: <1ms
- 1,000 entities: <2ms
- 10,000 entities: <5ms

---

## Summary

**Entity Registry provides:**

- ✅ **Zero I/O access** to all entities
- ✅ **Data-only pattern** - pure data in server registry
- ✅ **8 helper functions** in client registry
- ✅ **Type-safe entity names** (EntityName type)
- ✅ **Full metadata** (17 properties per entity)
- ✅ **Server and client** versions
- ✅ **Hierarchical queries** (tree, depth, parent/child)
- ✅ **Ownership tracking** (core, theme, plugin)
- ✅ **Statistics** (ENTITY_METADATA)

**Key helper functions (in entity-registry.client.ts):**
- `getEntity(name)` - Get single entity
- `getRegisteredEntities()` - Get all entities
- `getEntityBySlug(slug)` - Get entity by slug
- `getEntityApiPath(entityType)` - Get API path for entity
- `hasEntity(name)` - Check if entity exists
- `getEntityDisplayName(slug)` - Get display name
- `ensureClientInitialized()` - Ensure client is ready
- `parseChildEntity(entityType)` - Parse child entity relationship

**Common patterns:**
- Entity list pages
- Dynamic entity pages
- API routes with entities
- Hierarchical navigation
- Plugin/theme management

**Next:** [Route Handlers Registry](./06-route-handlers-registry.md) - Zero dynamic imports for API routes

---

**Last Updated**: 2025-12-26
**Version**: 2.0.0
**Status**: Complete
**Pattern**: Data-only (functions in client registry)
**Performance**: <1ms for all operations
