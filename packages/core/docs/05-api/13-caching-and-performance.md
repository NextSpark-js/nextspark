# Caching and Performance

**Response caching • Redis integration • Query optimization • Performance monitoring**

---

## Table of Contents

- [Overview](#overview)
- [HTTP Caching](#http-caching)
- [Redis Caching](#redis-caching)
- [Query Optimization](#query-optimization)
- [Response Compression](#response-compression)
- [Performance Monitoring](#performance-monitoring)

---

## Overview

Optimize API performance through strategic caching and optimization:

- ✅ **HTTP caching** - Browser and CDN caching
- ✅ **Redis caching** - Server-side caching layer
- ✅ **Query optimization** - Database performance
- ✅ **Response compression** - Reduce payload size
- ✅ **Performance monitoring** - Track and improve

---

## HTTP Caching

Use standard HTTP cache headers.

### Cache-Control Headers

```typescript
export async function GET(request: NextRequest) {
  const tasks = await getTasks()

  return NextResponse.json(
    { success: true, data: tasks },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=120',
        'ETag': generateETag(tasks),
        'Vary': 'Authorization'
      }
    }
  )
}
```

**Header Explanation:**
- `public` - Can be cached by any cache
- `max-age=60` - Browser cache for 60 seconds
- `s-maxage=120` - CDN cache for 120 seconds
- `ETag` - Validation token
- `Vary: Authorization` - Cache per user

### ETag Validation

```typescript
function generateETag(data: any): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex')
}

export async function GET(request: NextRequest) {
  const tasks = await getTasks()
  const etag = generateETag(tasks)

  const clientETag = request.headers.get('if-none-match')

  if (clientETag === etag) {
    return new NextResponse(null, { status: 304 })
  }

  return NextResponse.json(
    { success: true, data: tasks },
    { headers: { 'ETag': etag } }
  )
}
```

---

## Redis Caching

Implement server-side caching with Redis.

### Setup Redis

```typescript
// lib/redis.ts
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
})
```

### Cache Helper

```typescript
// lib/cache.ts
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = 60
): Promise<T> {
  // Check cache
  const cached = await redis.get<T>(key)
  if (cached) return cached

  // Execute function
  const result = await fn()

  // Store in cache
  await redis.setex(key, ttl, result)

  return result
}
```

### Usage in API Route

```typescript
export async function GET(request: NextRequest) {
  const tasks = await cached(
    'tasks:all',
    () => getTasks(),
    60 // Cache for 60 seconds
  )

  return NextResponse.json({ success: true, data: tasks })
}
```

### Cache Invalidation

```typescript
export async function POST(request: NextRequest) {
  const task = await createTask(data)

  // Invalidate related caches
  await redis.del('tasks:all')
  await redis.del(`user:${userId}:tasks`)

  return NextResponse.json({ success: true, data: task })
}
```

### Cache Patterns

**Pattern 1: Cache-Aside**
```typescript
async function getTask(taskId: string) {
  const cacheKey = `task:${taskId}`

  // Try cache first
  let task = await redis.get(cacheKey)

  if (!task) {
    // Cache miss - fetch from DB
    task = await db.findOne('tasks', { id: taskId })
    await redis.setex(cacheKey, 300, task)
  }

  return task
}
```

**Pattern 2: Write-Through**
```typescript
async function updateTask(taskId: string, data: any) {
  // Update DB
  const task = await db.update('tasks', { id: taskId }, data)

  // Update cache
  await redis.setex(`task:${taskId}`, 300, task)

  return task
}
```

---

## Query Optimization

### Database Indexes

```sql
-- Index frequently queried fields
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
```

### Query Performance

```typescript
// ❌ BAD: N+1 query problem
const tasks = await db.query('SELECT * FROM tasks')
for (const task of tasks) {
  task.assignee = await db.findOne('users', { id: task.assigneeId })
}

// ✅ GOOD: Join query
const tasks = await db.query(`
  SELECT t.*, u.name as assignee_name
  FROM tasks t
  LEFT JOIN users u ON t.assignee_id = u.id
`)
```

### Pagination

```typescript
// ✅ GOOD: Use LIMIT/OFFSET
const tasks = await db.query(
  'SELECT * FROM tasks LIMIT ? OFFSET ?',
  [limit, offset]
)

// ⚠️ BETTER: Use cursor-based pagination for large datasets
const tasks = await db.query(
  'SELECT * FROM tasks WHERE id > ? ORDER BY id LIMIT ?',
  [cursor, limit]
)
```

---

## Response Compression

Enable gzip compression for responses.

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Enable compression
  response.headers.set('Content-Encoding', 'gzip')

  return response
}
```

---

## Performance Monitoring

### Request Timing

```typescript
export async function GET(request: NextRequest) {
  const start = Date.now()

  const tasks = await getTasks()

  const duration = Date.now() - start

  return NextResponse.json(
    { success: true, data: tasks },
    {
      headers: {
        'Server-Timing': `db;dur=${duration}`
      }
    }
  )
}
```

### Performance Metrics

```typescript
const metrics = {
  requestCount: 0,
  totalDuration: 0,
  cacheHits: 0,
  cacheMisses: 0
}

export async function GET(request: NextRequest) {
  const start = Date.now()
  metrics.requestCount++

  const cached = await redis.get('tasks')
  if (cached) {
    metrics.cacheHits++
    return NextResponse.json({ success: true, data: cached })
  }

  metrics.cacheMisses++
  const tasks = await getTasks()

  metrics.totalDuration += Date.now() - start

  return NextResponse.json({ success: true, data: tasks })
}

// Metrics endpoint
export async function getMetrics() {
  return {
    requests: metrics.requestCount,
    avgDuration: metrics.totalDuration / metrics.requestCount,
    cacheHitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)
  }
}
```

---

## Next Steps

- [Monitoring and Logging](./19-monitoring-and-logging.md) - Production monitoring
- [Best Practices](./11-best-practices.md) - API best practices
- [Troubleshooting](./18-troubleshooting.md) - Performance issues

**Documentation:** `core/docs/05-api/13-caching-and-performance.md`
