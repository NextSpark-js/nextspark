# Real-World API Examples

**Complete application patterns • Production-ready code • Full-stack integration • Best practices in action**

---

## Table of Contents

- [Overview](#overview)
- [Task Management App](#task-management-app)
- [E-Commerce Product Catalog](#e-commerce-product-catalog)
- [Multi-Tenant SaaS](#multi-tenant-saas)
- [Real-Time Collaboration](#real-time-collaboration)
- [Mobile App Backend](#mobile-app-backend)

---

## Overview

This guide provides **complete, production-ready examples** of real-world applications built with the API v1.

**What you'll find:**
- ✅ Complete working code (frontend + backend)
- ✅ Best practices applied
- ✅ Error handling patterns
- ✅ Authentication flows
- ✅ Real-time features
- ✅ Testing strategies

---

## Task Management App

**Complete task management system** with real-time updates, collaboration, and advanced filtering.

### Backend: Entity Configuration

```typescript
// contents/themes/default/entities/tasks/config.ts
import { EntityConfig } from '@/core/types/registry'

export const tasksEntity: EntityConfig = {
  name: 'tasks',
  label: 'Tasks',
  pluralLabel: 'Tasks',
  schema: {
    title: { type: 'string', required: true, maxLength: 200 },
    description: { type: 'text', required: false },
    status: {
      type: 'enum',
      values: ['todo', 'in_progress', 'completed'],
      default: 'todo'
    },
    priority: {
      type: 'enum',
      values: ['low', 'medium', 'high'],
      default: 'medium'
    },
    assigneeId: { type: 'string', required: false },
    dueDate: { type: 'date', required: false },
    tags: { type: 'array', items: 'string', required: false },
    archived: { type: 'boolean', default: false }
  },
  permissions: {
    read: ['user', 'admin'],
    write: ['user', 'admin'],
    delete: ['admin']
  },
  features: {
    search: true,
    sort: true,
    filter: true,
    export: true
  }
}
```

### Frontend: Complete Task Manager

```typescript
// app/tasks/page.tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Task, CreateTaskInput } from '@/lib/api-client/types'

export default function TasksPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    status: [] as string[],
    priority: undefined as string | undefined,
    search: ''
  })

  // Fetch tasks
  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', page, filters],
    queryFn: async () => {
      const filter: any = {}

      if (filters.status.length > 0) {
        filter.status = { $in: filters.status }
      }

      if (filters.priority) {
        filter.priority = filters.priority
      }

      if (filters.search) {
        filter.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ]
      }

      return api.list<Task>('tasks', {
        page,
        limit: 20,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        sort: '-createdAt'
      })
    }
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateTaskInput) => api.create<Task>('tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) =>
      api.update<Task>('tasks', id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete('tasks', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  })

  // Real-time updates
  useEffect(() => {
    const unsubscribe = api.subscribe<Task>('tasks', {
      onCreated: (task) => {
        queryClient.setQueryData(['tasks', page, filters], (old: any) => {
          if (!old) return old
          return {
            ...old,
            data: [task, ...old.data]
          }
        })
      },
      onUpdated: (task) => {
        queryClient.setQueryData(['tasks', page, filters], (old: any) => {
          if (!old) return old
          return {
            ...old,
            data: old.data.map((t: Task) => (t.id === task.id ? task : t))
          }
        })
      },
      onDeleted: (id) => {
        queryClient.setQueryData(['tasks', page, filters], (old: any) => {
          if (!old) return old
          return {
            ...old,
            data: old.data.filter((t: Task) => t.id !== id)
          }
        })
      }
    })

    return unsubscribe
  }, [page, filters, queryClient])

  const handleCreate = async (data: CreateTaskInput) => {
    try {
      await createMutation.mutateAsync(data)
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  const handleUpdate = async (id: string, data: Partial<Task>) => {
    try {
      await updateMutation.mutateAsync({ id, data })
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return

    try {
      await deleteMutation.mutateAsync(id)
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  if (isLoading) return <TaskSkeleton />
  if (error) return <ErrorMessage error={error} />

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <CreateTaskDialog onCreate={handleCreate} />
      </div>

      <TaskFilters filters={filters} onChange={setFilters} />

      <TaskList
        tasks={data?.data || []}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      <Pagination
        page={page}
        totalPages={data?.meta?.pagination?.totalPages || 1}
        onPageChange={setPage}
      />
    </div>
  )
}

// Components
function TaskList({
  tasks,
  onUpdate,
  onDelete
}: {
  tasks: Task[]
  onUpdate: (id: string, data: Partial<Task>) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

function TaskCard({
  task,
  onUpdate,
  onDelete
}: {
  task: Task
  onUpdate: (id: string, data: Partial<Task>) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{task.title}</h3>
          {task.description && (
            <p className="mt-1 text-gray-600">{task.description}</p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.dueDate && (
              <span className="text-sm text-gray-500">
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              onUpdate(task.id, {
                status:
                  task.status === 'completed' ? 'todo' : 'completed'
              })
            }
            className="text-sm text-blue-600 hover:underline"
          >
            {task.status === 'completed' ? 'Reopen' : 'Complete'}
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="text-sm text-red-600 hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## E-Commerce Product Catalog

**Product management** with variants, inventory, and pricing.

### Backend: Product Entity

```typescript
// contents/plugins/ecommerce/entities/products/config.ts
export const productsEntity: EntityConfig = {
  name: 'products',
  label: 'Product',
  pluralLabel: 'Products',
  schema: {
    name: { type: 'string', required: true, maxLength: 200 },
    description: { type: 'text', required: true },
    sku: { type: 'string', required: true, unique: true },
    price: { type: 'number', required: true, min: 0 },
    compareAtPrice: { type: 'number', required: false, min: 0 },
    stock: { type: 'number', required: true, min: 0 },
    images: { type: 'array', items: 'string', required: true },
    category: { type: 'string', required: true },
    tags: { type: 'array', items: 'string', required: false },
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', required: true },
          sku: { type: 'string', required: true },
          price: { type: 'number', required: true },
          stock: { type: 'number', required: true }
        }
      },
      required: false
    },
    published: { type: 'boolean', default: false },
    featured: { type: 'boolean', default: false }
  },
  permissions: {
    read: ['public'],
    write: ['admin'],
    delete: ['admin']
  },
  features: {
    search: true,
    sort: true,
    filter: true,
    export: true
  }
}
```

### Frontend: Product Catalog

```typescript
// app/products/page.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

interface Product {
  id: string
  name: string
  description: string
  sku: string
  price: number
  compareAtPrice?: number
  stock: number
  images: string[]
  category: string
  tags: string[]
  published: boolean
  featured: boolean
}

export default function ProductsPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    category: undefined as string | undefined,
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    inStock: true,
    search: ''
  })

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, filters],
    queryFn: async () => {
      const filter: any = { published: true }

      if (filters.category) {
        filter.category = filters.category
      }

      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        filter.price = {}
        if (filters.minPrice) filter.price.$gte = filters.minPrice
        if (filters.maxPrice) filter.price.$lte = filters.maxPrice
      }

      if (filters.inStock) {
        filter.stock = { $gt: 0 }
      }

      return api.list<Product>('products', {
        page,
        limit: 12,
        filter,
        search: filters.search,
        sort: '-featured,-createdAt'
      })
    }
  })

  return (
    <div className="container mx-auto p-6">
      <ProductFilters filters={filters} onChange={setFilters} />

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {isLoading ? (
          <ProductGridSkeleton />
        ) : (
          data?.data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        )}
      </div>

      <Pagination
        page={page}
        totalPages={data?.meta?.pagination?.totalPages || 1}
        onPageChange={setPage}
      />
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  const discount = product.compareAtPrice
    ? Math.round(
        ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100
      )
    : 0

  return (
    <div className="group overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-lg">
      <div className="relative aspect-square">
        <img
          src={product.images[0]}
          alt={product.name}
          className="h-full w-full object-cover"
        />
        {discount > 0 && (
          <div className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
            -{discount}%
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-lg font-bold text-white">Out of Stock</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold">{product.name}</h3>
        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
          {product.description}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold">${product.price.toFixed(2)}</span>
            {product.compareAtPrice && (
              <span className="ml-2 text-sm text-gray-500 line-through">
                ${product.compareAtPrice.toFixed(2)}
              </span>
            )}
          </div>

          <button
            disabled={product.stock === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Multi-Tenant SaaS

**Multi-tenant architecture** with organization isolation and metadata.

### Backend: Tenant Isolation

```typescript
// app/api/v1/[entity]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { entity: string } }
) {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }

  // Get user's organization from metadata
  const organizationId = session.user.metadata?.organizationId

  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: 'No organization', code: 'NO_ORGANIZATION' },
      { status: 403 }
    )
  }

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  // Parse filter and add organization isolation
  const filter = searchParams.get('filter')
    ? JSON.parse(searchParams.get('filter')!)
    : {}

  // CRITICAL: Always filter by organization
  filter.organizationId = organizationId

  // Query database
  const { data, total } = await db.findMany(params.entity, {
    filter,
    page,
    limit
  })

  return NextResponse.json({
    success: true,
    data,
    meta: {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  })
}
```

### Frontend: Organization Context

```typescript
// providers/organization-provider.tsx
'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

interface Organization {
  id: string
  name: string
  plan: 'free' | 'pro' | 'enterprise'
  limits: {
    users: number
    storage: number
    apiCalls: number
  }
  usage: {
    users: number
    storage: number
    apiCalls: number
  }
}

const OrganizationContext = createContext<{
  organization: Organization | null
  isLoading: boolean
}>({
  organization: null,
  isLoading: true
})

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.request<Organization>({
      method: 'GET',
      path: '/organization/current'
    })
  })

  return (
    <OrganizationContext.Provider
      value={{ organization: organization?.data || null, isLoading }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  return useContext(OrganizationContext)
}

// Usage in components
function Dashboard() {
  const { organization, isLoading } = useOrganization()

  if (isLoading) return <Skeleton />

  const usagePercent = {
    users: (organization.usage.users / organization.limits.users) * 100,
    storage: (organization.usage.storage / organization.limits.storage) * 100,
    apiCalls: (organization.usage.apiCalls / organization.limits.apiCalls) * 100
  }

  return (
    <div>
      <h1>{organization.name}</h1>
      <p>Plan: {organization.plan}</p>

      <UsageMetrics>
        <UsageBar label="Users" percent={usagePercent.users} />
        <UsageBar label="Storage" percent={usagePercent.storage} />
        <UsageBar label="API Calls" percent={usagePercent.apiCalls} />
      </UsageMetrics>
    </div>
  )
}
```

---

## Real-Time Collaboration

**Collaborative editing** with presence indicators and live updates.

### Backend: SSE Endpoint

```typescript
// app/api/v1/stream/[entity]/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { entity: string } }
) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection
      controller.enqueue(
        encoder.encode('data: {"type":"connected"}\n\n')
      )

      // Subscribe to entity updates
      const unsubscribe = subscribeToUpdates(params.entity, (event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        )
      })

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        controller.close()
      })
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

### Frontend: Collaborative Editor

```typescript
// components/collaborative-editor.tsx
'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

interface Presence {
  userId: string
  userName: string
  color: string
  cursor: { x: number; y: number } | null
}

export function CollaborativeEditor({ documentId }: { documentId: string }) {
  const queryClient = useQueryClient()
  const [presence, setPresence] = useState<Presence[]>([])
  const [content, setContent] = useState('')

  // Fetch document
  const { data: document } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => api.get<Document>('documents', documentId)
  })

  // Update mutation with debounce
  const updateMutation = useMutation({
    mutationFn: (content: string) =>
      api.update('documents', documentId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] })
    }
  })

  // Real-time updates
  useEffect(() => {
    const unsubscribe = api.subscribe('documents', {
      onUpdated: (doc) => {
        if (doc.id === documentId) {
          setContent(doc.content)
        }
      }
    })

    return unsubscribe
  }, [documentId])

  // Presence tracking
  useEffect(() => {
    const presenceChannel = new BroadcastChannel(`presence:${documentId}`)

    // Broadcast presence
    const interval = setInterval(() => {
      presenceChannel.postMessage({
        type: 'presence',
        userId: currentUser.id,
        userName: currentUser.name,
        color: currentUser.color,
        cursor: cursorPosition
      })
    }, 1000)

    // Listen for presence
    presenceChannel.onmessage = (event) => {
      if (event.data.type === 'presence') {
        setPresence((prev) => {
          const filtered = prev.filter((p) => p.userId !== event.data.userId)
          return [...filtered, event.data]
        })
      }
    }

    return () => {
      clearInterval(interval)
      presenceChannel.close()
    }
  }, [documentId])

  const handleChange = (newContent: string) => {
    setContent(newContent)
    debouncedUpdate(newContent)
  }

  return (
    <div className="relative">
      {/* Presence indicators */}
      <div className="mb-4 flex gap-2">
        {presence.map((p) => (
          <div
            key={p.userId}
            className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1"
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-sm">{p.userName}</span>
          </div>
        ))}
      </div>

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        className="h-96 w-full rounded-lg border p-4 font-mono"
      />

      {/* Cursor overlays */}
      {presence.map(
        (p) =>
          p.cursor && (
            <div
              key={p.userId}
              className="pointer-events-none absolute"
              style={{
                left: p.cursor.x,
                top: p.cursor.y,
                borderLeft: `2px solid ${p.color}`
              }}
            >
              <span
                className="rounded px-1 text-xs text-white"
                style={{ backgroundColor: p.color }}
              >
                {p.userName}
              </span>
            </div>
          )
      )}
    </div>
  )
}
```

---

## Mobile App Backend

**Mobile-first API** with offline sync and push notifications.

### Backend: Sync Endpoint

```typescript
// app/api/v1/sync/route.ts
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { lastSyncAt, changes } = await request.json()

  // Apply client changes
  const conflicts = []
  for (const change of changes) {
    try {
      if (change.type === 'create') {
        await db.create(change.entity, change.data)
      } else if (change.type === 'update') {
        const existing = await db.findOne(change.entity, { id: change.id })

        // Detect conflict
        if (existing && existing.updatedAt > change.updatedAt) {
          conflicts.push({ ...change, serverVersion: existing })
          continue
        }

        await db.update(change.entity, change.id, change.data)
      } else if (change.type === 'delete') {
        await db.delete(change.entity, change.id)
      }
    } catch (error) {
      conflicts.push({ ...change, error: error.message })
    }
  }

  // Get server changes since lastSyncAt
  const serverChanges = await db.getChangesSince(session.user.id, lastSyncAt)

  return NextResponse.json({
    success: true,
    data: {
      serverChanges,
      conflicts,
      syncedAt: new Date().toISOString()
    }
  })
}
```

---

## Next Steps

- [Code Recipes](./16-code-recipes.md) - Reusable code patterns
- [Testing APIs](./17-testing-apis.md) - Testing strategies
- [Integration Examples](./09-integration-examples.md) - Framework integration

**Documentation:** `core/docs/05-api/15-real-world-examples.md`
