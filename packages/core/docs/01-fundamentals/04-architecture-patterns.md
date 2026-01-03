# Architecture Patterns

## Introduction

This document describes the core architectural patterns that define how the application is built and operates. These patterns are fundamental to understanding the codebase and making effective contributions.

**Key Principles:**
- **Zero Runtime I/O** - All configuration loaded at build-time
- **Registry-Based Access** - Static registries replace dynamic imports
- **Config-Driven Development** - Entities, plugins, and themes are config-first
- **Build-Time Generation** - ~17,255x performance improvement over runtime loading
- **Type Safety** - Full TypeScript coverage with strict mode

---

## 1. Registry-Based Loading Pattern

### Overview

The registry pattern is the foundation of the architecture. Instead of loading content at runtime with dynamic imports (slow), all content is loaded at build-time and compiled into static registries (fast).

**Performance Impact:**
- Runtime import: ~140ms per entity
- Build-time registry: ~6ms total for all entities
- **Improvement: ~17,255x faster**

### Implementation

**Build Script (`core/scripts/build/registry.mjs`):**
```typescript
// This is the ONLY place that can import from @/contents
import { taskConfig } from '@/contents/themes/default/entities/tasks/tasks.config.ts'
import { themeConfig } from '@/contents/themes/default/config/theme.config.ts'

// Generate static registries
const ENTITY_REGISTRY = {
  tasks: taskConfig,
  // ... all entities
}

// Write to core/lib/registries/entity-registry.ts
fs.writeFileSync('core/lib/registries/entity-registry.ts', generatedCode)
```

**Server-Side Usage:**
```typescript
// ✅ CORRECT - Import from build-time registry
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'

const taskConfig = ENTITY_REGISTRY.tasks
// Instant access, zero I/O

// ❌ WRONG - Runtime dynamic import
const taskConfig = await import('@/contents/themes/default/entities/tasks/tasks.config')
// 140ms I/O operation, defeats registry architecture
```

**Client-Side Usage:**
```typescript
// ✅ CORRECT - Use client-safe registry
import { ENTITY_REGISTRY_CLIENT } from '@/core/lib/registries/entity-registry.client'

// Only public, client-safe data included
const entityName = ENTITY_REGISTRY_CLIENT.tasks.name

// ❌ WRONG - Using server registry in client
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
// Will fail - contains server-only code
```

### Registry Types

**Entity Registry:**
- `entity-registry.ts` - Server-only, full configs
- `entity-registry.client.ts` - Client-safe subset

**Plugin Registry:**
- `plugin-registry.ts` - Server-only
- `plugin-registry.client.ts` - Client-safe

**Theme Registry:**
- `theme-registry.ts` - Theme configurations

**Route Handlers:**
- `route-handlers.ts` - API route handlers for dynamic routes

**Translation Registry:**
- `translation-registry.ts` - i18n message loaders

### Rules

1. **NEVER** import from `@/contents` in application code
2. **ALWAYS** use registries for content access
3. **ONLY** `core/scripts/build/registry.mjs` can import from `@/contents`
4. **Server vs Client** - Use appropriate registry version
5. **Regenerate** - Run `pnpm registry:build` after content changes

---

## 2. Build-Time Generation Pattern

### Overview

The build-time generation pattern pre-compiles all dynamic content into static code at build time, eliminating runtime overhead.

### Generated Artifacts

**1. Registries** (`core/scripts/build/registry.mjs`)
```bash
# Input: Contents from themes/plugins/entities
contents/themes/default/entities/tasks/tasks.config.ts
contents/plugins/ai/plugin.config.ts

# Output: Static registries
core/lib/registries/entity-registry.ts
core/lib/registries/plugin-registry.ts
```

**2. Theme CSS** (`core/scripts/build/theme.mjs`)
```bash
# Input: Theme CSS files
contents/themes/default/styles/*.css

# Output: Compiled theme CSS
app/theme-styles.css
```

**3. Theme Assets** (`core/scripts/build/theme.mjs`)
```bash
# Input: Theme public assets
contents/themes/default/public/brand/
contents/themes/default/public/images/

# Output: Copied to public/
public/theme/brand/
public/theme/images/
```

**4. Documentation Index** (`core/scripts/build/docs.mjs`)
```bash
# Input: Markdown documentation
core/docs/**/*.md

# Output: Searchable index
core/lib/registries/docs-registry.ts
```

### Build Pipeline

```typescript
// package.json scripts
{
  "scripts": {
    "registry:build": "node core/scripts/build/registry.mjs",
    "theme:build": "node core/scripts/build/theme.mjs",
    "docs:build": "node core/scripts/build/docs.mjs",
    "build": "npm run registry:build && npm run theme:build && npm run docs:build && next build"
  }
}
```

**Watch Mode:**
```bash
# Development - auto-rebuild on changes
pnpm registry:build-watch  # Rebuilds registries on content changes
pnpm theme:build-watch     # Rebuilds theme CSS on style changes
pnpm dev                   # Runs all watchers + Next.js dev server
```

### Rules

1. **Auto-Generated Files** - Never edit manually:
   - `core/lib/registries/*` (except `index.ts` exports)
   - `app/theme-styles.css`
   - `public/theme/*`
   - `.next/*`

2. **Source of Truth** - Edit these instead:
   - `contents/` - All content (themes, plugins, entities)
   - `core/scripts/build/*.mjs` - Generation logic

3. **Build Order** - Must run before `next build`:
   - Registry build → Theme build → Docs build → Next.js build

---

## 3. Config-Driven Development Pattern

### Overview

Entities, plugins, and themes are defined declaratively through configuration files, enabling code generation and reducing boilerplate.

### Entity Configuration

**Config File (`contents/themes/default/entities/tasks/tasks.config.ts`):**
```typescript
import type { EntityConfig } from '@/core/lib/entities/types'

export const taskConfig: EntityConfig = {
  name: 'tasks',
  label: 'Tasks',
  pluralLabel: 'Tasks',
  icon: 'CheckSquare',

  // Auto-generates CRUD API routes
  api: {
    enabled: true,
    basePath: '/api/v1/tasks'
  },

  // Auto-generates dashboard pages
  dashboard: {
    enabled: true,
    path: '/dashboard/tasks'
  },

  // Auto-generates database queries
  database: {
    table: 'tasks',
    primaryKey: 'id'
  }
}
```

**Generated Features:**
- ✅ API routes: `/api/v1/tasks` (GET, POST, PATCH, DELETE)
- ✅ Dashboard page: `/dashboard/tasks`
- ✅ Database service: `TaskService.list()`, `.get()`, `.create()`, etc.
- ✅ Type definitions: `Task` interface
- ✅ Validation schemas: Zod schemas for CRUD operations
- ✅ UI components: `TaskList`, `TaskForm`, `TaskCard`

### Field Definitions

**Fields File (`tasks.fields.ts`):**
```typescript
import type { FieldDefinition } from '@/core/lib/entities/types'

export const taskFields: FieldDefinition[] = [
  {
    name: 'title',
    type: 'text',
    label: 'Title',
    required: true,
    validation: {
      minLength: 3,
      maxLength: 255
    }
  },
  {
    name: 'status',
    type: 'select',
    label: 'Status',
    required: true,
    options: [
      { value: 'todo', label: 'To Do' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'done', label: 'Done' }
    ]
  },
  {
    name: 'priority',
    type: 'select',
    label: 'Priority',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }
    ]
  }
]
```

**Generated Features:**
- ✅ Type-safe form generation
- ✅ Automatic validation (client + server)
- ✅ Database column types
- ✅ Filter UI components
- ✅ Table column definitions

### Plugin Configuration

**Plugin Config (`contents/plugins/ai/plugin.config.ts`):**
```typescript
import type { PluginConfig } from '@/core/lib/plugins/types'

export const aiPluginConfig: PluginConfig = {
  id: 'ai',
  name: 'AI Assistant',
  version: '1.0.0',

  // Auto-injects API routes
  routes: [
    {
      path: '/api/ai/chat',
      handler: './api/chat.ts'
    }
  ],

  // Auto-injects UI components
  components: {
    'dashboard.header': './components/AiButton.tsx'
  },

  // Auto-runs migrations
  migrations: './migrations/'
}
```

### Theme Configuration

**Theme Config (`contents/themes/default/config/theme.config.ts`):**
```typescript
import type { ThemeConfig } from '@/core/lib/theme/types'

export const defaultTheme: ThemeConfig = {
  id: 'default',
  name: 'Default Theme',

  // CSS variables (auto-injected)
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6'
  },

  // Brand assets
  brand: {
    logo: '/theme/brand/logo.svg',
    favicon: '/theme/brand/favicon.ico'
  },

  // Layout config
  layout: {
    sidebar: 'left',
    header: 'sticky'
  }
}
```

### Benefits

1. **Less Boilerplate** - Configuration generates implementation
2. **Type Safety** - Configs are TypeScript with full validation
3. **Consistency** - Generated code follows standards
4. **Maintainability** - Change config, regenerate code
5. **Extensibility** - Add features by extending configs

---

## 4. Zero-Runtime-I/O Pattern

### Overview

The zero-runtime-I/O pattern eliminates all file system operations, dynamic imports, and database queries at runtime for configuration loading.

**Performance Comparison:**
```typescript
// ❌ Runtime I/O (140ms per entity)
const entities = await Promise.all(
  entityPaths.map(path => import(path))
)
// Total: 140ms × 10 entities = 1,400ms

// ✅ Build-time registry (6ms total)
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
const entities = Object.values(ENTITY_REGISTRY)
// Total: 6ms for all entities
```

### Prohibited Patterns

**❌ Dynamic Imports:**
```typescript
// NEVER do this for config/content loading
const config = await import(`@/contents/themes/${themeName}/theme.config`)
const entity = await import(`@/contents/entities/${entityName}/config`)
```

**❌ File System Operations:**
```typescript
// NEVER do this at runtime
const files = fs.readdirSync('contents/themes')
const config = JSON.parse(fs.readFileSync('config.json'))
```

**❌ Database Queries for Config:**
```typescript
// NEVER load config from database at runtime
const entities = await db.query('SELECT * FROM entity_configs')
```

### Allowed Patterns

**✅ Static Imports:**
```typescript
// Build-time registry imports (zero runtime overhead)
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
import { THEME_REGISTRY } from '@/core/lib/registries/theme-registry'
```

**✅ UI Code-Splitting:**
```typescript
// ONLY allowed dynamic import pattern
import { lazy } from 'react'

const HeavyComponent = lazy(() => import('./HeavyComponent'))
// Lazy-loads component code (not config)
```

### Enforcement

**Pre-Commit Hook:**
```bash
# core/scripts/validation/check-imports.sh
#!/bin/bash

# Check for prohibited dynamic imports
VIOLATIONS=$(grep -r "await import(" core/ app/ | \
  grep -v "lazy(" | \
  grep -v "messages/" | \
  grep -v "\.test\.")

if [ -n "$VIOLATIONS" ]; then
  echo "❌ PROHIBITED: Dynamic imports detected"
  echo "$VIOLATIONS"
  exit 1
fi
```

**CI/CD Validation:**
```yaml
# .github/workflows/ci.yml
- name: Check Dynamic Imports
  run: |
    npm run check:dynamic-imports
    npm run check:hardcoded-imports
```

---

## 5. Dual Authentication Pattern

### Overview

The application supports two authentication modes simultaneously:
1. **Session-based** - For dashboard users (cookies + Better Auth)
2. **API key-based** - For external API access (Bearer tokens)

### Implementation

**Dual Auth Middleware:**
```typescript
// core/lib/api/auth/dual-auth.ts
import { auth } from '@/core/lib/auth/auth'
import { validateApiKey } from '@/core/lib/services/api-key.service'

export async function authenticateRequest(request: NextRequest) {
  // Try session auth first (Better Auth)
  const session = await auth.api.getSession({
    headers: request.headers
  })

  if (session?.user) {
    return {
      authenticated: true,
      user: session.user,
      type: 'session'
    }
  }

  // Fall back to API key auth
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (apiKey) {
    const validation = await validateApiKey(apiKey)

    if (validation.valid) {
      return {
        authenticated: true,
        user: validation.user,
        type: 'api-key',
        scopes: validation.scopes
      }
    }
  }

  return { authenticated: false }
}
```

**API Route Usage:**
```typescript
// app/api/v1/tasks/route.ts
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)

  if (!authResult.authenticated) {
    return createAuthError('Unauthorized', 401)
  }

  // Check API key scopes if applicable
  if (authResult.type === 'api-key') {
    if (!authResult.scopes?.includes('tasks:read')) {
      return createAuthError('Insufficient permissions', 403)
    }
  }

  // Proceed with request
  const tasks = await TaskService.list(authResult.user.id)
  return createApiResponse({ data: tasks })
}
```

### API Key Scopes

```typescript
// core/lib/api/keys.ts
export const API_KEY_SCOPES = {
  // Entity scopes
  'tasks:read': 'Read tasks',
  'tasks:write': 'Create and update tasks',
  'tasks:delete': 'Delete tasks',

  // System scopes
  'users:read': 'Read user data',
  'api-keys:manage': 'Manage API keys',

  // Wildcard (admin only)
  '*': 'Full access'
} as const
```

### Benefits

1. **Flexibility** - Dashboard users + API consumers
2. **Security** - Scoped permissions for API keys
3. **Compatibility** - Works with any HTTP client
4. **Isolation** - API keys can't access dashboard
5. **Auditability** - Track usage per API key

---

## 6. Row-Level Security (RLS) Pattern

### Overview

Row-Level Security ensures users can only access their own data at the database level, providing defense-in-depth security.

### Implementation

**Database Setup:**
```sql
-- Enable RLS on table
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tasks
CREATE POLICY tasks_user_isolation ON tasks
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

**Service Layer:**
```typescript
// core/lib/security/rls-helpers.ts
export async function queryWithRLS<T>(
  query: string,
  params: any[],
  userId: string
): Promise<T[]> {
  const client = await pool.connect()

  try {
    // Set RLS context
    await client.query('SET app.current_user_id = $1', [userId])

    // Execute query (RLS enforced)
    const result = await client.query<T>(query, params)

    return result.rows
  } finally {
    // Reset context
    await client.query('RESET app.current_user_id')
    client.release()
  }
}
```

**Service Usage:**
```typescript
// core/lib/services/task.service.ts
export class TaskService {
  static async list(userId: string): Promise<Task[]> {
    return queryWithRLS<Task>(
      'SELECT * FROM tasks WHERE status = $1 ORDER BY created_at DESC',
      ['active'],
      userId // RLS ensures only user's tasks returned
    )
  }

  static async get(taskId: string, userId: string): Promise<Task | null> {
    const tasks = await queryWithRLS<Task>(
      'SELECT * FROM tasks WHERE id = $1',
      [taskId],
      userId // RLS ensures user owns this task
    )

    return tasks[0] || null
  }
}
```

### Benefits

1. **Defense-in-Depth** - Database-level security
2. **Automatic Isolation** - No manual WHERE clauses
3. **Error Prevention** - Can't accidentally expose data
4. **Compliance** - Meets data isolation requirements
5. **Performance** - Database-optimized filtering

---

## 7. Service Layer Pattern

### Overview

The service layer abstracts business logic and database operations, providing a consistent interface for data access with built-in RLS support.

### Structure

```typescript
// core/lib/services/[entity].service.ts
export class EntityService {
  // CRUD operations
  static async list(userId: string, filters?: EntityFilters): Promise<Entity[]>
  static async get(id: string, userId: string): Promise<Entity | null>
  static async create(data: CreateEntityInput, userId: string): Promise<Entity>
  static async update(id: string, data: UpdateEntityInput, userId: string): Promise<Entity>
  static async delete(id: string, userId: string): Promise<void>
}
```

### Example Service

```typescript
// core/lib/services/task.service.ts
import { queryWithRLS } from '@/core/lib/security/rls-helpers'
import type { Task, CreateTaskInput, UpdateTaskInput } from '@/core/types/entities'

export class TaskService {
  static async list(userId: string, filters?: TaskFilters): Promise<Task[]> {
    let query = 'SELECT * FROM tasks WHERE 1=1'
    const params: any[] = []

    if (filters?.status) {
      params.push(filters.status)
      query += ` AND status = $${params.length}`
    }

    if (filters?.priority) {
      params.push(filters.priority)
      query += ` AND priority = $${params.length}`
    }

    query += ' ORDER BY created_at DESC'

    return queryWithRLS<Task>(query, params, userId)
  }

  static async get(id: string, userId: string): Promise<Task | null> {
    const tasks = await queryWithRLS<Task>(
      'SELECT * FROM tasks WHERE id = $1',
      [id],
      userId
    )

    return tasks[0] || null
  }

  static async create(data: CreateTaskInput, userId: string): Promise<Task> {
    const tasks = await queryWithRLS<Task>(
      `INSERT INTO tasks (title, description, status, priority, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.title, data.description, data.status, data.priority, userId],
      userId
    )

    return tasks[0]
  }

  static async update(
    id: string,
    data: UpdateTaskInput,
    userId: string
  ): Promise<Task> {
    const updateFields: string[] = []
    const params: any[] = []

    if (data.title !== undefined) {
      params.push(data.title)
      updateFields.push(`title = $${params.length}`)
    }

    if (data.status !== undefined) {
      params.push(data.status)
      updateFields.push(`status = $${params.length}`)
    }

    params.push(id)
    const idParam = params.length

    const tasks = await queryWithRLS<Task>(
      `UPDATE tasks SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${idParam}
       RETURNING *`,
      params,
      userId
    )

    if (!tasks[0]) {
      throw new Error('Task not found or access denied')
    }

    return tasks[0]
  }

  static async delete(id: string, userId: string): Promise<void> {
    await queryWithRLS(
      'DELETE FROM tasks WHERE id = $1',
      [id],
      userId
    )
  }
}
```

### API Route Integration

```typescript
// app/api/v1/tasks/route.ts
import { TaskService } from '@/core/lib/services/task.service'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)

  if (!authResult.authenticated) {
    return createAuthError('Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const filters = {
    status: searchParams.get('status') || undefined,
    priority: searchParams.get('priority') || undefined
  }

  const tasks = await TaskService.list(authResult.user.id, filters)

  return createApiResponse({ data: tasks })
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request)

  if (!authResult.authenticated) {
    return createAuthError('Unauthorized', 401)
  }

  const data = await request.json()
  const task = await TaskService.create(data, authResult.user.id)

  return createApiResponse({ data: task }, 201)
}
```

### Benefits

1. **Separation of Concerns** - Business logic isolated from routes
2. **Reusability** - Services used by API routes, Server Actions, cron jobs
3. **Testability** - Easy to unit test services independently
4. **RLS Built-In** - Security enforced at service layer
5. **Type Safety** - Full TypeScript support

---

## 8. Plugin Lifecycle Pattern

### Overview

Plugins follow a predictable lifecycle with hooks for initialization, configuration, and cleanup.

### Lifecycle Stages

```typescript
// core/lib/plugins/types.ts
export interface PluginLifecycle {
  onRegister?: () => Promise<void>    // Build-time registration
  onInit?: () => Promise<void>         // App initialization
  onRequest?: (req: Request) => void   // Per-request hook
  onShutdown?: () => Promise<void>     // App shutdown
}
```

### Plugin Implementation

```typescript
// contents/plugins/ai/plugin.config.ts
import type { PluginConfig } from '@/core/lib/plugins/types'

export const aiPlugin: PluginConfig = {
  id: 'ai',
  name: 'AI Assistant',
  version: '1.0.0',

  // Lifecycle hooks
  lifecycle: {
    async onRegister() {
      console.log('AI plugin registered at build-time')
    },

    async onInit() {
      console.log('AI plugin initializing')
      await this.initializeOpenAI()
    },

    onRequest(request: Request) {
      // Track usage per request
      this.trackRequest(request)
    },

    async onShutdown() {
      console.log('AI plugin shutting down')
      await this.cleanup()
    }
  },

  // Custom plugin methods
  async initializeOpenAI() {
    // Initialize OpenAI client
  },

  trackRequest(request: Request) {
    // Track API usage
  },

  async cleanup() {
    // Cleanup resources
  }
}
```

### Plugin Loading

```typescript
// core/lib/plugins/plugin-loader.ts
import { PLUGIN_REGISTRY } from '@/core/lib/registries/plugin-registry'

export async function initializePlugins() {
  const plugins = Object.values(PLUGIN_REGISTRY)

  for (const plugin of plugins) {
    if (plugin.lifecycle?.onInit) {
      await plugin.lifecycle.onInit()
    }
  }
}

// Called in app initialization
// app/layout.tsx or app/providers.tsx
```

### Benefits

1. **Predictable Behavior** - Standard lifecycle stages
2. **Resource Management** - Proper initialization/cleanup
3. **Performance** - Lazy initialization when needed
4. **Debugging** - Clear plugin loading order
5. **Isolation** - Plugins can't interfere with each other

---

## 9. Theme System Pattern

### Overview

Themes customize the application's appearance through CSS variables, brand assets, and layout configuration.

### Theme Structure

```text
contents/themes/default/
├── config/                # All configuration files
│   ├── theme.config.ts    # Theme metadata and config
│   ├── app.config.ts      # App-level overrides (optional)
│   ├── dashboard.config.ts # Dashboard config (optional)
│   ├── permissions.config.ts # Permissions (optional)
│   └── billing.config.ts  # Billing/plans (optional)
├── styles/                # Theme CSS files
│   ├── globals.css
│   ├── components.css
│   └── utilities.css
├── public/                # Theme assets
│   ├── brand/
│   ├── images/
│   └── fonts/
├── entities/              # Theme-specific entities
├── messages/              # Theme translations
└── templates/             # Page templates (optional)
```

### Theme Configuration

```typescript
// contents/themes/default/config/theme.config.ts
import type { ThemeConfig } from '@/core/lib/theme/types'

export const defaultTheme: ThemeConfig = {
  id: 'default',
  name: 'Default Theme',
  version: '1.0.0',

  // CSS variables (injected into :root)
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#f59e0b',
    background: '#ffffff',
    foreground: '#1f2937'
  },

  // Typography
  fonts: {
    sans: 'Inter, system-ui, sans-serif',
    mono: 'Fira Code, monospace'
  },

  // Brand assets
  brand: {
    logo: '/theme/brand/logo.svg',
    logoText: '/theme/brand/logo-text.svg',
    favicon: '/theme/brand/favicon.ico',
    appleTouchIcon: '/theme/brand/apple-touch-icon.png'
  },

  // Layout configuration
  layout: {
    sidebar: 'left',
    header: 'sticky',
    maxWidth: '1280px'
  }
}
```

### Theme Activation

```bash
# .env.local
NEXT_PUBLIC_ACTIVE_THEME=default
```

**Build Process:**
```bash
# Builds theme CSS and copies assets
pnpm theme:build

# Output:
# - app/theme-styles.css (compiled CSS)
# - public/theme/* (copied assets)
```

### CSS Variables Pattern

**Generated CSS:**
```css
/* Auto-generated in app/theme-styles.css */
:root {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --color-accent: #f59e0b;
  --font-sans: Inter, system-ui, sans-serif;
}
```

**Usage in Components:**
```typescript
// ✅ CORRECT - Use CSS variables
<div className="bg-[var(--color-primary)] text-[var(--color-foreground)]">
  Themed content
</div>

// ❌ WRONG - Hardcoded colors
<div className="bg-blue-500 text-gray-900">
  Not themeable
</div>
```

### Benefits

1. **Hot-Swappable** - Change theme without code changes
2. **Brand Consistency** - Centralized brand assets
3. **CSS Variables** - Dynamic theming at runtime
4. **Asset Isolation** - Theme assets in `/theme/` namespace
5. **Type Safety** - TypeScript theme configs

---

## 10. Metadata System Pattern

### Overview

The metadata system allows attaching arbitrary key-value data to any entity, with support for user-specific and global metadata.

### Implementation

**Database Schema:**
```sql
CREATE TABLE meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id VARCHAR(255) NOT NULL,     -- e.g., 'task_123'
  key VARCHAR(255) NOT NULL,            -- e.g., 'priority'
  value TEXT NOT NULL,                  -- JSON-encoded value
  user_id UUID,                         -- NULL = global metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(entity_id, key, user_id)      -- Prevent duplicates
);

-- RLS policy
CREATE POLICY meta_user_isolation ON meta
  FOR ALL
  USING (
    user_id IS NULL OR
    user_id = current_setting('app.current_user_id')::uuid
  );
```

**Service Layer:**
```typescript
// core/lib/services/meta.service.ts
export class MetaService {
  // Create or update metadata
  static async createMeta(data: CreateMetaInput): Promise<Meta> {
    return queryWithRLS<Meta>(
      `INSERT INTO meta (entity_id, key, value, user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (entity_id, key, user_id)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING *`,
      [data.entityId, data.key, data.value, data.userId],
      data.userId
    )[0]
  }

  // Get metadata for entity
  static async getMeta(
    entityId: string,
    userId: string
  ): Promise<Record<string, any>> {
    const rows = await queryWithRLS<Meta>(
      'SELECT key, value FROM meta WHERE entity_id = $1',
      [entityId],
      userId
    )

    return rows.reduce((acc, row) => {
      acc[row.key] = JSON.parse(row.value)
      return acc
    }, {} as Record<string, any>)
  }

  // Merge global + user metadata (user overrides global)
  static async getMergedMeta(
    entityId: string,
    userId: string
  ): Promise<Record<string, any>> {
    const globalMeta = await this.getGlobalMeta(entityId)
    const userMeta = await this.getUserMeta(entityId, userId)

    return { ...globalMeta, ...userMeta }
  }
}
```

**Usage Example:**
```typescript
// Store user preferences for a task
await MetaService.createMeta({
  entityId: 'task_123',
  key: 'view_mode',
  value: JSON.stringify('kanban'),
  userId: 'user_456'
})

// Retrieve all metadata for task
const metadata = await MetaService.getMergedMeta('task_123', 'user_456')
// { priority: 'high', view_mode: 'kanban', ... }
```

### Benefits

1. **Flexibility** - Extend entities without schema changes
2. **User-Specific** - Per-user customization
3. **Global Fallback** - Default values for all users
4. **Type Safety** - JSON validation via Zod
5. **Performance** - Indexed queries for fast access

---

## Summary

**Core Patterns:**
1. **Registry-Based Loading** - Build-time registries (~17,255x faster)
2. **Build-Time Generation** - Static artifacts eliminate runtime overhead
3. **Config-Driven Development** - Declarative configs generate implementation
4. **Zero-Runtime-I/O** - No dynamic imports or file system operations
5. **Dual Authentication** - Sessions + API keys simultaneously
6. **Row-Level Security** - Database-level data isolation
7. **Service Layer** - Business logic abstraction with RLS
8. **Plugin Lifecycle** - Predictable initialization and cleanup
9. **Theme System** - Hot-swappable CSS + brand assets
10. **Metadata System** - Flexible key-value data attachment

**Key Principles:**
- **Performance First** - Build-time over runtime
- **Type Safety** - Full TypeScript coverage
- **Security Built-In** - RLS, dual auth, scoped permissions
- **Developer Experience** - Config-driven, auto-generated code
- **Maintainability** - Clear separation of concerns

**Next:** [TypeScript Standards](./05-typescript-standards.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
