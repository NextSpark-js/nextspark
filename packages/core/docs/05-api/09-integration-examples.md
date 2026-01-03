# API Integration Examples

**Real-world integration patterns • React/Next.js • Python • Node.js • Error handling • Caching**

---

## Table of Contents

- [Overview](#overview)
- [React with TanStack Query](#react-with-tanstack-query)
- [Next.js Server Components](#nextjs-server-components)
- [Vanilla JavaScript](#vanilla-javascript)
- [Node.js Backend](#nodejs-backend)
- [Python Client](#python-client)
- [Common Patterns](#common-patterns)

---

## Overview

This guide provides **complete, production-ready examples** of integrating with the API v1 from different environments.

**Examples include:**
- ✅ React with TanStack Query (recommended)
- ✅ Next.js Server Components
- ✅ Vanilla JavaScript with fetch
- ✅ Node.js backend integration
- ✅ Python client library
- ✅ Error handling patterns
- ✅ Caching strategies
- ✅ Pagination helpers

---

## React with TanStack Query

**Recommended approach** for React applications.

### Setup

```bash
npm install @tanstack/react-query
```

### Query Client Configuration

```typescript
// app/providers/query-provider.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60000, // 1 minute
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
          }
        }
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

### API Client

```typescript
// lib/api-client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://yourdomain.com/api/v1'

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: Record<string, string>
  ) {
    super(message)
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = localStorage.getItem('apiKey')

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
      ...options.headers
    }
  })

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(
      data.error || 'Request failed',
      data.code || 'UNKNOWN_ERROR',
      response.status,
      data.details
    )
  }

  return data.data
}
```

### Custom Hooks

```typescript
// hooks/use-tasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api-client'

interface Task {
  id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  updatedAt: string
}

interface TaskFilters {
  page?: number
  limit?: number
  status?: string[]
  priority?: string
  search?: string
}

// List tasks
export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.page) params.append('page', filters.page.toString())
      if (filters.limit) params.append('limit', filters.limit.toString())
      if (filters.status) {
        params.append('filter', JSON.stringify({ status: { $in: filters.status } }))
      }
      if (filters.priority) {
        params.append('filter', JSON.stringify({ priority: filters.priority }))
      }
      if (filters.search) params.append('search', filters.search)

      return apiRequest<{
        data: Task[]
        pagination: {
          page: number
          limit: number
          total: number
          totalPages: number
          hasNext: boolean
          hasPrev: boolean
        }
      }>(`/tasks?${params}`)
    }
  })
}

// Get single task
export function useTask(taskId: string) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => apiRequest<Task>(`/tasks/${taskId}`),
    enabled: !!taskId
  })
}

// Create task
export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Task>) =>
      apiRequest<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  })
}

// Update task
export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Task>) =>
      apiRequest<Task>(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    }
  })
}

// Delete task
export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) =>
      apiRequest(`/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  })
}
```

### Component Usage

```typescript
// app/tasks/page.tsx
'use client'

import { useState } from 'react'
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/use-tasks'

export default function TasksPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useTasks({ page, limit: 20, search })
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const handleCreateTask = async () => {
    try {
      await createTask.mutateAsync({
        title: 'New task',
        status: 'todo',
        priority: 'medium'
      })
      alert('Task created!')
    } catch (error) {
      alert('Failed to create task')
    }
  }

  const handleUpdateTask = async (taskId: string) => {
    try {
      await updateTask.mutateAsync({
        status: 'completed'
      })
      alert('Task updated!')
    } catch (error) {
      alert('Failed to update task')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return

    try {
      await deleteTask.mutateAsync(taskId)
      alert('Task deleted!')
    } catch (error) {
      alert('Failed to delete task')
    }
  }

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tasks..."
      />

      <button onClick={handleCreateTask}>Create Task</button>

      {data?.data.map((task) => (
        <div key={task.id}>
          <h3>{task.title}</h3>
          <p>Status: {task.status}</p>
          <button onClick={() => handleUpdateTask(task.id)}>
            Mark Complete
          </button>
          <button onClick={() => handleDeleteTask(task.id)}>
            Delete
          </button>
        </div>
      ))}

      <div>
        <button
          disabled={!data?.pagination.hasPrev}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {data?.pagination.page} of {data?.pagination.totalPages}</span>
        <button
          disabled={!data?.pagination.hasNext}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
```

---

## Next.js Server Components

**Use Server Components** for better performance and SEO.

```typescript
// app/tasks/page.tsx
import { apiRequest } from '@/lib/api-server'

export default async function TasksPage({
  searchParams
}: {
  searchParams: { page?: string }
}) {
  const page = parseInt(searchParams.page || '1')

  const { data, pagination } = await apiRequest('/tasks', {
    params: { page, limit: 20 }
  })

  return (
    <div>
      {data.map((task) => (
        <div key={task.id}>
          <h3>{task.title}</h3>
          <p>{task.description}</p>
        </div>
      ))}

      <Pagination pagination={pagination} />
    </div>
  )
}
```

---

## Vanilla JavaScript

**Simple fetch-based client** for vanilla JavaScript.

```javascript
class ApiClient {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.baseUrl = 'https://yourdomain.com/api/v1'
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Request failed')
    }

    return data.data
  }

  // Tasks
  async getTasks(filters = {}) {
    const params = new URLSearchParams()
    if (filters.page) params.append('page', filters.page)
    if (filters.limit) params.append('limit', filters.limit)

    return this.request(`/tasks?${params}`)
  }

  async getTask(taskId) {
    return this.request(`/tasks/${taskId}`)
  }

  async createTask(data) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateTask(taskId, data) {
    return this.request(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }

  async deleteTask(taskId) {
    return this.request(`/tasks/${taskId}`, { method: 'DELETE' })
  }
}

// Usage
const client = new ApiClient('sk_live_abc123...')

// List tasks
const tasks = await client.getTasks({ page: 1, limit: 20 })

// Create task
const newTask = await client.createTask({
  title: 'New task',
  status: 'todo'
})

// Update task
await client.updateTask('tsk_abc123', {
  status: 'completed'
})

// Delete task
await client.deleteTask('tsk_abc123')
```

---

## Node.js Backend

**Server-to-server integration.**

```typescript
// lib/api-client.ts
import axios, { AxiosInstance } from 'axios'

export class ApiClient {
  private client: AxiosInstance

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: process.env.API_URL || 'https://yourdomain.com/api/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response.data.data,
      (error) => {
        if (error.response) {
          throw new Error(
            error.response.data.error || 'API request failed'
          )
        }
        throw error
      }
    )
  }

  // Tasks
  async getTasks(filters: {
    page?: number
    limit?: number
    status?: string[]
  } = {}) {
    return this.client.get('/tasks', { params: filters })
  }

  async createTask(data: {
    title: string
    description?: string
    status?: string
    priority?: string
  }) {
    return this.client.post('/tasks', data)
  }

  async updateTask(taskId: string, data: Partial<any>) {
    return this.client.patch(`/tasks/${taskId}`, data)
  }

  async deleteTask(taskId: string) {
    return this.client.delete(`/tasks/${taskId}`)
  }

  // Bulk operations
  async bulkCreateTasks(tasks: any[]) {
    return this.client.post('/import/tasks', {
      tasks,
      assignUsers: true,
      notify: true
    })
  }
}

// Usage
const api = new ApiClient(process.env.API_KEY!)

// Sync tasks from external system
const externalTasks = await fetchFromExternalSystem()

const result = await api.bulkCreateTasks(
  externalTasks.map(task => ({
    title: task.name,
    description: task.notes,
    status: task.completed ? 'completed' : 'todo'
  }))
)

console.log(`Imported ${result.imported} tasks`)
```

---

## Python Client

**Python integration example.**

```python
import requests
from typing import Dict, List, Optional

class ApiClient:
    def __init__(self, api_key: str, base_url: str = None):
        self.api_key = api_key
        self.base_url = base_url or "https://yourdomain.com/api/v1"
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })

    def _request(self, method: str, endpoint: str, **kwargs):
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()["data"]

    # Tasks
    def get_tasks(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[List[str]] = None
    ):
        params = {"page": page, "limit": limit}
        if status:
            params["filter"] = json.dumps({"status": {"$in": status}})

        return self._request("GET", "/tasks", params=params)

    def create_task(self, data: Dict):
        return self._request("POST", "/tasks", json=data)

    def update_task(self, task_id: str, data: Dict):
        return self._request("PATCH", f"/tasks/{task_id}", json=data)

    def delete_task(self, task_id: str):
        return self._request("DELETE", f"/tasks/{task_id}")

# Usage
client = ApiClient(api_key="sk_live_abc123...")

# List tasks
tasks = client.get_tasks(page=1, limit=20, status=["todo", "in_progress"])

# Create task
new_task = client.create_task({
    "title": "New task from Python",
    "status": "todo",
    "priority": "high"
})

# Update task
client.update_task("tsk_abc123", {"status": "completed"})

# Delete task
client.delete_task("tsk_abc123")
```

---

## Common Patterns

### Error Handling with Retry

```typescript
async function apiRequestWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry client errors (4xx)
      if (error instanceof ApiError && error.status < 500) {
        throw error
      }

      // Wait before retry (exponential backoff)
      if (i < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, i), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError!
}

// Usage
const tasks = await apiRequestWithRetry(() =>
  apiRequest('/tasks')
)
```

### Pagination Helper

```typescript
async function* paginateAll<T>(
  endpoint: string,
  pageSize = 100
): AsyncGenerator<T[], void, unknown> {
  let page = 1
  let hasNext = true

  while (hasNext) {
    const response = await apiRequest<{
      data: T[]
      pagination: { hasNext: boolean }
    }>(`${endpoint}?page=${page}&limit=${pageSize}`)

    yield response.data
    hasNext = response.pagination.hasNext
    page++
  }
}

// Usage: Process all tasks in chunks
for await (const tasks of paginateAll('/tasks')) {
  console.log(`Processing ${tasks.length} tasks...`)
  await processTasks(tasks)
}
```

### Caching Layer

```typescript
const cache = new Map<string, { data: any; expiry: number }>()

async function cachedApiRequest<T>(
  endpoint: string,
  ttl = 60000
): Promise<T> {
  const cached = cache.get(endpoint)

  if (cached && Date.now() < cached.expiry) {
    return cached.data
  }

  const data = await apiRequest<T>(endpoint)

  cache.set(endpoint, {
    data,
    expiry: Date.now() + ttl
  })

  return data
}

// Usage
const tasks = await cachedApiRequest('/tasks', 60000) // Cache for 1 minute
```

---

## Next Steps

- [Client Libraries](./14-client-libraries.md) - Official SDK patterns
- [Real-World Examples](./15-real-world-examples.md) - Complete applications
- [Code Recipes](./16-code-recipes.md) - Common code patterns
- [Testing APIs](./17-testing-apis.md) - Testing integration code

**Documentation:** `core/docs/05-api/09-integration-examples.md`
