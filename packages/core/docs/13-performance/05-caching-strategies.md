# Caching Strategies

## Introduction

Caching is a **multi-layer optimization strategy** that dramatically reduces latency by serving data from faster storage layers. Our architecture implements caching at four distinct levels, each serving a specific purpose in the performance hierarchy.

**Core Principle:** Cache at the appropriate layer to minimize latency while maintaining data freshness.

---

## The Caching Hierarchy

### Four-Layer Strategy

```text
User Request
      ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 1: BROWSER CACHE (0-5ms)                        │
│  • HTTP Cache-Control headers                          │
│  • Service Workers / PWA cache                         │
│  • Fastest, but shared across users                    │
└─────────────────────────────────────────────────────────┘
      ↓ (Cache Miss)
┌─────────────────────────────────────────────────────────┐
│  Layer 2: CLIENT STATE (5-10ms)                        │
│  • TanStack Query cache                                │
│  • React state / Context                               │
│  • User-specific, in-memory                            │
└─────────────────────────────────────────────────────────┘
      ↓ (Cache Miss)
┌─────────────────────────────────────────────────────────┐
│  Layer 3: SERVER CACHE (10-50ms)                       │
│  • Next.js fetch cache                                 │
│  • React cache() API                                   │
│  • Registry System (build-time)                        │
└─────────────────────────────────────────────────────────┘
      ↓ (Cache Miss)
┌─────────────────────────────────────────────────────────┐
│  Layer 4: CDN CACHE (50-100ms)                         │
│  • Vercel Edge Network                                 │
│  • Geographic distribution                             │
│  • Public/static assets                                │
└─────────────────────────────────────────────────────────┘
      ↓ (Cache Miss)
┌─────────────────────────────────────────────────────────┐
│  DATABASE (100-200ms+)                                 │
│  • PostgreSQL with connection pooling                  │
│  • Last resort, slowest                                │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Browser Caching

### HTTP Cache-Control Headers

Control how browsers and CDNs cache responses:

```typescript
// app/api/v1/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const tasks = await getTasks()

  return NextResponse.json(
    { success: true, data: tasks },
    {
      headers: {
        // Browser cache for 60s, CDN for 120s
        'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=86400',
        'Vary': 'Authorization',  // Cache per user
      }
    }
  )
}
```

**Header Breakdown:**

| Directive | Purpose | Duration |
|-----------|---------|----------|
| `public` | Can be cached by any cache | - |
| `private` | Cache only in browser (user-specific) | - |
| `max-age=60` | Browser cache TTL | 60 seconds |
| `s-maxage=120` | CDN cache TTL | 120 seconds |
| `stale-while-revalidate=86400` | Serve stale while updating | 24 hours |
| `no-cache` | Revalidate before using cache | - |
| `no-store` | Never cache | - |

### When to Use Each

```typescript
// ✅ CORRECT - Public, rarely-changing data
// Cache for 1 hour
headers: {
  'Cache-Control': 'public, max-age=3600, s-maxage=7200'
}

// ✅ CORRECT - User-specific data
// Cache in browser only for 5 minutes
headers: {
  'Cache-Control': 'private, max-age=300'
}

// ✅ CORRECT - Dynamic, frequently-changing data
// Revalidate every time, but allow stale
headers: {
  'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600'
}

// ✅ CORRECT - Never cache sensitive data
headers: {
  'Cache-Control': 'no-store, no-cache, must-revalidate'
}
```

### ETag Validation

Efficient cache revalidation with ETags:

```typescript
import crypto from 'crypto'

function generateETag(data: any): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex')
}

export async function GET(request: NextRequest) {
  const tasks = await getTasks()
  const etag = generateETag(tasks)

  // Check if client has current version
  const clientETag = request.headers.get('if-none-match')

  if (clientETag === etag) {
    // Data unchanged - return 304 Not Modified
    return new NextResponse(null, { status: 304 })
  }

  // Data changed - return full response
  return NextResponse.json(
    { success: true, data: tasks },
    { headers: { 'ETag': etag, 'Cache-Control': 'private, max-age=300' } }
  )
}
```

---

## Layer 2: TanStack Query Caching

### Client-Side Query Cache

TanStack Query v5.85 provides powerful client-side caching:

```typescript
// core/hooks/useEntityQuery.ts
import { useQuery } from '@tanstack/react-query'

export function useEntityQuery(options: UseEntityQueryOptions) {
  const {
    entityConfig,
    pageSize = 10,
    search = '',
    filters = {},
    sort = null,
    staleTime = 1000 * 60 * 5,  // 5 minutes
    gcTime = 1000 * 60 * 60,     // 1 hour
  } = options

  const { user } = useAuth()

  // Query key determines cache identity
  const queryKey = [
    'entity',
    entityConfig.slug,
    {
      pageSize,
      search,
      filters,
      sort,
    },
  ]

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        ...(search && { search }),
        ...(sort && {
          sortBy: sort.field,
          sortOrder: sort.direction
        }),
      })

      const response = await fetch(`/api/v1/${entityConfig.slug}?${params}`)
      if (!response.ok) throw new Error('Failed to fetch')
      
      return response.json()
    },
    enabled: !!user,
    staleTime,  // Data fresh for 5 minutes
    gcTime,     // Keep in cache for 1 hour after unused
  })
}
```

### staleTime vs gcTime

```typescript
const CACHE_CONFIG = {
  // staleTime: How long data is considered "fresh"
  // During this time, no refetch occurs
  staleTime: {
    static: 1000 * 60 * 60,      // 1 hour (rarely changes)
    normal: 1000 * 60 * 5,        // 5 minutes (typical data)
    realtime: 1000 * 30,          // 30 seconds (frequent updates)
    never: 0,                     // Always stale, refetch on mount
  },
  
  // gcTime (garbage collection time): How long unused data stays in cache
  // After this, data is removed from memory
  gcTime: {
    longLived: 1000 * 60 * 60 * 24,  // 24 hours
    normal: 1000 * 60 * 60,           // 1 hour
    shortLived: 1000 * 60 * 10,       // 10 minutes
  },
}

// Examples

// Rarely-changing entity config
useQuery({
  queryKey: ['entity-config', 'tasks'],
  queryFn: fetchConfig,
  staleTime: 1000 * 60 * 60,  // Fresh for 1 hour
  gcTime: 1000 * 60 * 60 * 24, // Keep for 24 hours
})

// User tasks (changes moderately)
useQuery({
  queryKey: ['tasks', userId],
  queryFn: fetchTasks,
  staleTime: 1000 * 60 * 5,    // Fresh for 5 minutes
  gcTime: 1000 * 60 * 60,       // Keep for 1 hour
})

// Real-time notifications (frequent updates)
useQuery({
  queryKey: ['notifications', userId],
  queryFn: fetchNotifications,
  staleTime: 1000 * 30,         // Fresh for 30 seconds
  gcTime: 1000 * 60 * 10,       // Keep for 10 minutes
  refetchInterval: 1000 * 60,   // Poll every minute
})
```

### Cache Invalidation Patterns

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (task: NewTask) => {
      const response = await fetch('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      })
      return response.json()
    },
    onSuccess: (newTask) => {
      // Strategy 1: Invalidate to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ['entity', 'tasks']
      })

      // Strategy 2: Optimistic update (instant UI)
      queryClient.setQueryData(
        ['entity', 'tasks'],
        (old: any) => ({
          ...old,
          items: [newTask, ...old.items],
          total: old.total + 1,
        })
      )
    },
  })
}
```

### Prefetching Data

```typescript
// Prefetch data before user needs it
function TaskListPage() {
  const queryClient = useQueryClient()

  const prefetchTask = (taskId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['task', taskId],
      queryFn: () => fetch(`/api/v1/tasks/${taskId}`).then(r => r.json()),
      staleTime: 1000 * 60 * 5,
    })
  }

  return (
    <div>
      {tasks.map(task => (
        <div
          key={task.id}
          onMouseEnter={() => prefetchTask(task.id)}  // Prefetch on hover
        >
          <Link href={`/tasks/${task.id}`}>{task.title}</Link>
        </div>
      ))}
    </div>
  )
}
```

---

## Layer 3: Next.js Server Caching

### Next.js 15 Fetch Cache

Next.js automatically caches fetch requests:

```typescript
// app/dashboard/page.tsx
export default async function DashboardPage() {
  // ✅ Cached by default (until revalidation)
  const tasks = await fetch('https://api.example.com/tasks', {
    next: { revalidate: 3600 }  // Revalidate every hour
  })

  // ✅ No cache (always fresh)
  const notifications = await fetch('https://api.example.com/notifications', {
    cache: 'no-store'
  })

  // ✅ Force cache (never revalidate)
  const config = await fetch('https://api.example.com/config', {
    cache: 'force-cache'
  })

  return <div>{/* ... */}</div>
}
```

### React cache() API

Deduplicate requests within a single render:

```typescript
import { cache } from 'react'

// ✅ Deduplicated across multiple calls in same request
const getUser = cache(async (userId: string) => {
  console.log('Fetching user:', userId)  // Only logs once per request
  
  const user = await fetch(`/api/users/${userId}`)
  return user.json()
})

// Called multiple times, fetches once
async function UserProfile({ userId }: { userId: string }) {
  const user = await getUser(userId)  // First call
  return <div>{user.name}</div>
}

async function UserAvatar({ userId }: { userId: string }) {
  const user = await getUser(userId)  // Cached, no second fetch
  return <img src={user.avatar} />
}
```

### unstable_cache for Database Queries

```typescript
import { unstable_cache } from 'next/cache'
import { query } from '@/core/lib/db'

// ✅ Cache database query results
const getCachedTasks = unstable_cache(
  async (userId: string) => {
    return await query('SELECT * FROM tasks WHERE "userId" = $1', [userId])
  },
  ['tasks'],           // Cache key
  {
    revalidate: 60,    // Revalidate every 60 seconds
    tags: ['tasks'],   // Tags for invalidation
  }
)

// Usage
export default async function TasksPage({ userId }: { userId: string }) {
  const tasks = await getCachedTasks(userId)
  
  return <TaskList tasks={tasks} />
}
```

### Cache Invalidation with Tags

```typescript
import { revalidateTag, revalidatePath } from 'next/cache'

// After creating a task
export async function POST(request: NextRequest) {
  const task = await createTask(data)

  // Invalidate all queries tagged 'tasks'
  revalidateTag('tasks')

  // Or invalidate specific path
  revalidatePath('/dashboard/tasks')

  return NextResponse.json({ success: true, data: task })
}
```

---

## Layer 4: Registry System Caching

### Build-Time Precomputation

The **Registry System** provides the ultimate cache—data computed at build time:

```typescript
// ✅ Zero runtime I/O - instant access
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'

function getEntityConfig(entityName: string) {
  return ENTITY_REGISTRY[entityName]  // O(1) lookup, ~6ms total
}

// vs Traditional Approach (140ms per entity)
async function getEntityConfigSlow(entityName: string) {
  const dir = await findEntityDirectory(entityName)      // 20ms
  const config = await import(configPath)                 // 40ms
  const processed = await processConfig(config)           // 15ms
  const resources = await discoverResources(dir)          // 35ms
  const metadata = await buildMetadata(processed)         // 30ms
  return metadata  // Total: ~140ms
}
```

**Registry System Benefits:**
- ~17,255x faster than runtime discovery
- Zero filesystem I/O at runtime
- Data never stale (regenerated on build)
- Type-safe with full TypeScript autocomplete

**See:** [Registry System Introduction](../03-registry-system/01-introduction.md) for complete details.

---

## CDN Caching

### Vercel Edge Network

Static assets automatically cached at edge locations:

```typescript
// next.config.ts
const nextConfig = {
  // Images automatically optimized and cached
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
}

// Static files in /public automatically cached
// Cache-Control: public, max-age=31536000, immutable
```

### Custom CDN Headers

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Cache static entity configs at edge
  if (request.nextUrl.pathname.startsWith('/api/entity-config/')) {
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
    )
    response.headers.set('CDN-Cache-Control', 'max-age=3600')
  }

  return response
}
```

---

## Cache Invalidation Strategies

### When to Invalidate

```typescript
const INVALIDATION_RULES = {
  // Immediate invalidation (critical data)
  onCreate: ['entity-list', 'entity-count'],
  onUpdate: ['entity-detail', 'entity-list'],
  onDelete: ['entity-list', 'entity-count', 'entity-detail'],
  
  // Time-based invalidation (non-critical)
  configChanges: '1 hour',
  publicContent: '24 hours',
  staticAssets: 'never (versioned URLs)',
}
```

### TanStack Query Invalidation

```typescript
import { useQueryClient } from '@tanstack/react-query'

function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTask,
    onSuccess: (updatedTask) => {
      // Invalidate list queries
      queryClient.invalidateQueries({
        queryKey: ['entity', 'tasks']
      })

      // Update specific task in cache
      queryClient.setQueryData(
        ['task', updatedTask.id],
        updatedTask
      )
    },
  })
}
```

### Next.js Cache Invalidation

```typescript
import { revalidateTag, revalidatePath } from 'next/cache'

// Invalidate by tag
revalidateTag('tasks')

// Invalidate by path
revalidatePath('/dashboard/tasks')

// Invalidate everything (use sparingly)
revalidatePath('/', 'layout')
```

---

## Choosing the Right Cache Layer

### Decision Matrix

| Data Type | Frequency | Cache Layer | TTL |
|-----------|-----------|-------------|-----|
| **Entity configs** | Never changes | Registry (build-time) | Forever |
| **Static pages** | Rarely | CDN + Browser | 1-24 hours |
| **User lists** | Occasionally | TanStack Query | 5 minutes |
| **Entity details** | Occasionally | TanStack Query | 5 minutes |
| **Search results** | Frequently | TanStack Query | 30 seconds |
| **Real-time data** | Constantly | No cache / 0s TTL | - |

### Code Examples

```typescript
// Static config (Registry)
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
const config = ENTITY_REGISTRY.tasks  // Instant

// Rarely-changing (CDN + Browser)
const response = await fetch('/api/config')
// headers: Cache-Control: public, max-age=3600

// User data (TanStack Query)
const { data: tasks } = useQuery({
  queryKey: ['tasks', userId],
  queryFn: fetchTasks,
  staleTime: 1000 * 60 * 5,  // 5 minutes
})

// Real-time (No cache)
const { data: notifications } = useQuery({
  queryKey: ['notifications', userId],
  queryFn: fetchNotifications,
  staleTime: 0,  // Always stale
  refetchInterval: 30000,  // Poll every 30s
})
```

---

## Best Practices Summary

### ✅ DO

```typescript
// Use appropriate cache duration
staleTime: 1000 * 60 * 5  // 5 minutes for typical data

// Include all parameters in query key
queryKey: ['tasks', { userId, filters, sort }]

// Invalidate caches on mutations
onSuccess: () => queryClient.invalidateQueries(['tasks'])

// Use Registry System for static configs
import { ENTITY_REGISTRY } from '@/core/lib/registries'

// Add Cache-Control headers to API routes
headers: { 'Cache-Control': 'private, max-age=300' }

// Prefetch data before user needs it
queryClient.prefetchQuery({ queryKey, queryFn })
```

### ❌ DON'T

```typescript
// Cache user-specific data publicly
'Cache-Control': 'public, max-age=3600'  // Leaks user data!

// Forget to invalidate on mutations
// Stale data shown until TTL expires

// Use extremely long TTLs for dynamic data
staleTime: 1000 * 60 * 60 * 24  // 24 hours for user tasks?

// Miss parameters in query keys
queryKey: ['tasks']  // Missing userId, filters → wrong cache hits

// Bypass cache for static data
await fetch(url, { cache: 'no-store' })  // Static config doesn't need this
```

---

## Monitoring Cache Performance

### TanStack Query DevTools

```typescript
// app/providers.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

// View cache contents, stale queries, and refetch behavior
```

### Cache Hit Metrics

```typescript
// Track cache effectiveness
const cacheMetrics = {
  tanstackQuery: {
    hits: queryClient.getQueryCache().getAll().filter(q => !q.state.isFetching).length,
    misses: queryClient.getQueryCache().getAll().filter(q => q.state.isFetching).length,
  },
}

console.log('Cache hit rate:', 
  cacheMetrics.tanstackQuery.hits / 
  (cacheMetrics.tanstackQuery.hits + cacheMetrics.tanstackQuery.misses)
)
```

---

## Next Steps

- **Implement caching:** Start with TanStack Query for user data
- **Add HTTP headers:** Set Cache-Control on API routes
- **Monitor effectiveness:** Use React Query DevTools
- **Optimize TTLs:** Adjust based on data freshness requirements

**Related Documentation:**
- [Performance Overview](./01-performance-overview.md) - Overall strategy
- [Registry System](../03-registry-system/01-introduction.md) - Build-time caching
- [API Caching](../05-api/13-caching-and-performance.md) - Server-side patterns

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Complete  
**TanStack Query:** v5.85.0  
**Next.js:** 15.4.6
