# API Code Recipes

**Copy-paste ready code snippets • Common patterns • Production-tested solutions**

---

## Table of Contents

- [Overview](#overview)
- [Authentication Recipes](#authentication-recipes)
- [Data Fetching Recipes](#data-fetching-recipes)
- [Error Handling Recipes](#error-handling-recipes)
- [Performance Recipes](#performance-recipes)
- [Testing Recipes](#testing-recipes)

---

## Overview

**Ready-to-use code snippets** for common API patterns. Copy, paste, and customize.

---

## Authentication Recipes

### API Key Rotation

```typescript
// lib/api-key-rotation.ts
import { db } from '@/lib/db'
import { generateApiKey } from '@/lib/api-keys'

export async function rotateApiKey(userId: string, keyId: string) {
  // Generate new key
  const newKey = await generateApiKey({
    userId,
    name: 'Rotated Key',
    scopes: ['read', 'write']
  })

  // Deactivate old key (keep for 30 days for rollback)
  await db.update('api_keys', keyId, {
    active: false,
    rotatedAt: new Date().toISOString(),
    rotatedTo: newKey.id
  })

  // Schedule deletion in 30 days
  await scheduleKeyDeletion(keyId, 30)

  return newKey
}

async function scheduleKeyDeletion(keyId: string, days: number) {
  const deleteAt = new Date()
  deleteAt.setDate(deleteAt.getDate() + days)

  await db.create('scheduled_tasks', {
    type: 'delete_api_key',
    entityId: keyId,
    executeAt: deleteAt.toISOString()
  })
}
```

### Session Refresh

```typescript
// lib/session-refresh.ts
import { auth } from '@/lib/auth'

export async function refreshSession(sessionToken: string) {
  const session = await auth.api.getSession({
    headers: { cookie: `session=${sessionToken}` }
  })

  if (!session) {
    throw new Error('Invalid session')
  }

  // Check if session is expiring soon (within 1 hour)
  const expiresAt = new Date(session.expiresAt)
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000)

  if (expiresAt < oneHourFromNow) {
    // Extend session
    await auth.api.updateSession(sessionToken, {
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    })
  }

  return session
}
```

### Multi-Factor Authentication Check

```typescript
// lib/mfa-check.ts
export async function requireMFA(userId: string) {
  const user = await db.findOne('users', { id: userId })

  if (!user.mfaEnabled) {
    return { required: false }
  }

  // Check if MFA verified in current session
  const mfaVerified = await redis.get(`mfa:verified:${userId}`)

  if (mfaVerified) {
    return { required: false, verified: true }
  }

  return {
    required: true,
    verified: false,
    methods: user.mfaMethods // ['totp', 'sms', 'email']
  }
}

export async function verifyMFA(userId: string, code: string) {
  const user = await db.findOne('users', { id: userId })

  // Verify TOTP code
  const isValid = verifyTOTP(user.totpSecret, code)

  if (isValid) {
    // Mark as verified for 30 minutes
    await redis.setex(`mfa:verified:${userId}`, 1800, 'true')
    return { success: true }
  }

  return { success: false, error: 'Invalid code' }
}
```

---

## Data Fetching Recipes

### Infinite Scroll

```typescript
// hooks/use-infinite-scroll.ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export function useInfiniteScroll<T>(
  entity: string,
  options?: { limit?: number; filter?: any }
) {
  return useInfiniteQuery({
    queryKey: [entity, 'infinite', options],
    queryFn: async ({ pageParam = 1 }) => {
      return api.list<T>(entity, {
        page: pageParam,
        limit: options?.limit || 20,
        filter: options?.filter
      })
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.meta?.pagination?.hasNext) {
        return lastPage.meta.pagination.page + 1
      }
      return undefined
    },
    initialPageParam: 1
  })
}

// Usage
function InfiniteList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteScroll<Task>('tasks', { limit: 20 })

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget

    if (scrollHeight - scrollTop === clientHeight && hasNextPage) {
      fetchNextPage()
    }
  }

  return (
    <div onScroll={handleScroll} className="h-screen overflow-auto">
      {data?.pages.map((page) =>
        page.data.map((task) => <TaskCard key={task.id} task={task} />)
      )}
      {isFetchingNextPage && <Spinner />}
    </div>
  )
}
```

### Prefetch on Hover

```typescript
// hooks/use-prefetch.ts
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export function usePrefetch<T>(entity: string) {
  const queryClient = useQueryClient()

  const prefetch = (id: string) => {
    queryClient.prefetchQuery({
      queryKey: [entity, id],
      queryFn: () => api.get<T>(entity, id),
      staleTime: 60000 // Cache for 1 minute
    })
  }

  return { prefetch }
}

// Usage
function TaskList({ tasks }: { tasks: Task[] }) {
  const { prefetch } = usePrefetch<Task>('tasks')

  return (
    <div>
      {tasks.map((task) => (
        <Link
          key={task.id}
          href={`/tasks/${task.id}`}
          onMouseEnter={() => prefetch(task.id)}
        >
          {task.title}
        </Link>
      ))}
    </div>
  )
}
```

### Optimistic Updates

```typescript
// hooks/use-optimistic-update.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export function useOptimisticUpdate<T>(entity: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<T> }) =>
      api.update<T>(entity, id, data),

    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [entity] })

      // Snapshot previous value
      const previous = queryClient.getQueryData([entity, id])

      // Optimistically update
      queryClient.setQueryData([entity, id], (old: any) => ({
        ...old,
        ...data
      }))

      return { previous, id }
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData([entity, context.id], context.previous)
      }
    },

    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: [entity] })
    }
  })
}
```

### Parallel Fetching

```typescript
// hooks/use-parallel-fetch.ts
import { useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export function useParallelFetch<T>(entity: string, ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: [entity, id],
      queryFn: () => api.get<T>(entity, id)
    }))
  })
}

// Usage
function Dashboard() {
  const results = useParallelFetch<Task>('tasks', [
    'tsk_001',
    'tsk_002',
    'tsk_003'
  ])

  const allLoaded = results.every((r) => !r.isLoading)
  const allData = results.map((r) => r.data?.data)

  return (
    <div>
      {allLoaded ? (
        allData.map((task) => <TaskCard key={task.id} task={task} />)
      ) : (
        <Spinner />
      )}
    </div>
  )
}
```

---

## Error Handling Recipes

### Global Error Handler

```typescript
// lib/error-handler.ts
import { ApiError } from '@/lib/api-client'

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        // Redirect to login
        window.location.href = '/login'
        break

      case 'RATE_LIMIT_EXCEEDED':
        // Show rate limit message
        toast.error('Too many requests. Please try again later.')
        break

      case 'VALIDATION_ERROR':
        // Show validation errors
        if (error.details) {
          Object.entries(error.details).forEach(([field, message]) => {
            toast.error(`${field}: ${message}`)
          })
        }
        break

      case 'NOT_FOUND':
        // Show 404 page
        router.push('/404')
        break

      case 'SERVER_ERROR':
        // Log to error tracking service
        trackError(error)
        toast.error('Server error. Please try again.')
        break

      default:
        toast.error(error.error || 'An error occurred')
    }
  } else {
    // Unknown error
    console.error('Unknown error:', error)
    toast.error('An unexpected error occurred')
  }
}

// Usage with React Query
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      onError: handleApiError
    },
    queries: {
      onError: handleApiError
    }
  }
})
```

### Retry with Exponential Backoff

```typescript
// lib/retry.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry client errors
      if (error instanceof ApiError && error.status < 500) {
        throw error
      }

      // Last attempt - throw error
      if (i === maxRetries - 1) {
        throw lastError
      }

      // Calculate delay with jitter
      const delay = baseDelay * Math.pow(2, i)
      const jitter = Math.random() * 1000
      await new Promise((resolve) => setTimeout(resolve, delay + jitter))
    }
  }

  throw lastError!
}

// Usage
const data = await retryWithBackoff(
  () => api.get('tasks', 'tsk_abc123'),
  3,
  1000
)
```

### Error Boundary

```typescript
// components/error-boundary.tsx
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo)
    trackError(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex h-screen items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Something went wrong</h1>
              <p className="mt-2 text-gray-600">{this.state.error?.message}</p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="mt-4 rounded bg-blue-600 px-4 py-2 text-white"
              >
                Try again
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
```

---

## Performance Recipes

### Request Deduplication

```typescript
// lib/dedupe.ts
const pendingRequests = new Map<string, Promise<any>>()

export async function dedupeRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // Check if request is pending
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!
  }

  // Create new request
  const promise = fn().finally(() => {
    pendingRequests.delete(key)
  })

  pendingRequests.set(key, promise)

  return promise
}

// Usage
const task = await dedupeRequest('tasks/tsk_abc123', () =>
  api.get('tasks', 'tsk_abc123')
)
```

### Response Caching

```typescript
// lib/cache.ts
interface CacheEntry<T> {
  data: T
  expiry: number
}

class ResponseCache {
  private cache = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttl = 60000) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  delete(key: string) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  // Delete by pattern
  deletePattern(pattern: RegExp) {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }
}

export const responseCache = new ResponseCache()

// Usage
async function getCachedTask(id: string) {
  const cacheKey = `tasks/${id}`

  // Check cache
  const cached = responseCache.get<Task>(cacheKey)
  if (cached) return cached

  // Fetch and cache
  const task = await api.get('tasks', id)
  responseCache.set(cacheKey, task.data, 60000)

  return task.data
}

// Invalidate cache on mutation
async function updateTask(id: string, data: Partial<Task>) {
  await api.update('tasks', id, data)

  // Clear related caches
  responseCache.delete(`tasks/${id}`)
  responseCache.deletePattern(/^tasks/)
}
```

### Batch Requests

```typescript
// lib/batch.ts
interface BatchRequest {
  id: string
  entity: string
  operation: 'get' | 'list'
  params?: any
}

class RequestBatcher {
  private queue: BatchRequest[] = []
  private timeout: NodeJS.Timeout | null = null

  add(request: BatchRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ ...request, resolve, reject } as any)

      if (!this.timeout) {
        this.timeout = setTimeout(() => this.flush(), 50)
      }
    })
  }

  private async flush() {
    if (this.queue.length === 0) return

    const batch = this.queue.splice(0)
    this.timeout = null

    try {
      const response = await api.request({
        method: 'POST',
        path: '/batch',
        body: {
          requests: batch.map((r) => ({
            id: r.id,
            method: r.operation === 'get' ? 'GET' : 'GET',
            path: r.operation === 'get'
              ? `/${r.entity}/${r.params?.id}`
              : `/${r.entity}`,
            params: r.params
          }))
        }
      })

      // Resolve individual requests
      response.data.responses.forEach((res: any) => {
        const request = batch.find((r) => r.id === res.id) as any
        if (request) {
          if (res.status >= 400) {
            request.reject(new Error(res.body.error))
          } else {
            request.resolve(res.body)
          }
        }
      })
    } catch (error) {
      // Reject all requests
      batch.forEach((r: any) => r.reject(error))
    }
  }
}

export const batcher = new RequestBatcher()

// Usage
const task1 = batcher.add({
  id: 'req1',
  entity: 'tasks',
  operation: 'get',
  params: { id: 'tsk_001' }
})

const task2 = batcher.add({
  id: 'req2',
  entity: 'tasks',
  operation: 'get',
  params: { id: 'tsk_002' }
})

const [data1, data2] = await Promise.all([task1, task2])
```

---

## Testing Recipes

### Mock API Client

```typescript
// __mocks__/api-client.ts
import { vi } from 'vitest'

export const mockApiClient = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  bulkCreate: vi.fn(),
  uploadFile: vi.fn(),
  subscribe: vi.fn()
}

export const api = mockApiClient
```

### Test Helpers

```typescript
// test/helpers/api.ts
import { mockApiClient } from '@/__mocks__/api-client'

export function mockApiSuccess<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    }
  }
}

export function mockApiError(code: string, error: string, status = 400) {
  return {
    success: false,
    error,
    code,
    status
  }
}

// Usage in tests
describe('TaskList', () => {
  it('renders tasks', async () => {
    mockApiClient.list.mockResolvedValue(
      mockApiSuccess([
        { id: 'tsk_001', title: 'Task 1' },
        { id: 'tsk_002', title: 'Task 2' }
      ])
    )

    render(<TaskList />)

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument()
      expect(screen.getByText('Task 2')).toBeInTheDocument()
    })
  })

  it('handles errors', async () => {
    mockApiClient.list.mockRejectedValue(
      mockApiError('SERVER_ERROR', 'Server error', 500)
    )

    render(<TaskList />)

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })
})
```

### Integration Test

```typescript
// test/integration/tasks.test.ts
import { test, expect } from '@playwright/test'

test('complete task workflow', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.fill('[name=email]', 'test@example.com')
  await page.fill('[name=password]', 'password123')
  await page.click('button[type=submit]')

  // Navigate to tasks
  await page.goto('/tasks')

  // Create task
  await page.click('button:has-text("Create Task")')
  await page.fill('[name=title]', 'Test Task')
  await page.fill('[name=description]', 'Test Description')
  await page.click('button:has-text("Create")')

  // Verify task created
  await expect(page.locator('text=Test Task')).toBeVisible()

  // Complete task
  await page.click('text=Test Task >> .. >> button:has-text("Complete")')

  // Verify task completed
  await expect(page.locator('text=Test Task >> .. >> text=completed')).toBeVisible()

  // Delete task
  await page.click('text=Test Task >> .. >> button:has-text("Delete")')
  await page.click('button:has-text("Confirm")')

  // Verify task deleted
  await expect(page.locator('text=Test Task')).not.toBeVisible()
})
```

---

## Next Steps

- [Testing APIs](./17-testing-apis.md) - Comprehensive testing guide
- [Best Practices](./11-best-practices.md) - Production best practices
- [Integration Examples](./09-integration-examples.md) - Framework examples

**Documentation:** `core/docs/05-api/16-code-recipes.md`
