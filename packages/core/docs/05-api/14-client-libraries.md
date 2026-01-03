# Client Libraries and SDKs

**Official SDK patterns • Type-safe clients • Auto-generated documentation • Multi-language support**

---

## Table of Contents

- [Overview](#overview)
- [TypeScript/JavaScript SDK](#typescriptjavascript-sdk)
- [Python SDK](#python-sdk)
- [SDK Architecture](#sdk-architecture)
- [Auto-Generated Types](#auto-generated-types)
- [SDK Configuration](#sdk-configuration)
- [Best Practices](#best-practices)

---

## Overview

Build type-safe, production-ready client libraries for the API v1.

**Key Features:**
- ✅ **Full TypeScript support** - Auto-generated types from Zod schemas
- ✅ **Multi-language SDKs** - JavaScript, TypeScript, Python
- ✅ **Auto-complete** - IntelliSense for all endpoints
- ✅ **Error handling** - Type-safe error responses
- ✅ **Retry logic** - Automatic retry with exponential backoff
- ✅ **Request/Response interceptors** - Custom middleware
- ✅ **Streaming support** - SSE and WebSocket integration

---

## TypeScript/JavaScript SDK

### Installation

```bash
npm install @your-company/api-client
# or
pnpm add @your-company/api-client
```

### Basic Setup

```typescript
// lib/api-client.ts
import { ApiClient } from '@your-company/api-client'

export const api = new ApiClient({
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://yourdomain.com/api/v1'
})
```

### Complete SDK Implementation

```typescript
// packages/api-client/src/index.ts
export interface ApiClientConfig {
  apiKey?: string
  baseUrl?: string
  timeout?: number
  retries?: number
  retryDelay?: number
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>
  onResponse?: (response: ApiResponse) => ApiResponse | Promise<ApiResponse>
  onError?: (error: ApiError) => void
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  params?: Record<string, any>
  body?: any
  headers?: Record<string, string>
}

export interface ApiResponse<T = any> {
  success: true
  data: T
  meta?: {
    pagination?: PaginationMeta
    [key: string]: any
  }
}

export interface ApiError {
  success: false
  error: string
  code: string
  status: number
  details?: Record<string, string>
}

export class ApiClient {
  private config: Required<ApiClientConfig>

  constructor(config: ApiClientConfig) {
    this.config = {
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || 'https://api.yourdomain.com/v1',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      onRequest: config.onRequest || ((c) => c),
      onResponse: config.onResponse || ((r) => r),
      onError: config.onError || (() => {})
    }
  }

  /**
   * Make API request with retry logic
   */
  private async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    let lastError: ApiError | null = null

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        // Apply request interceptor
        const finalConfig = await this.config.onRequest(config)

        // Build URL
        const url = new URL(finalConfig.path, this.config.baseUrl)
        if (finalConfig.params) {
          Object.entries(finalConfig.params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value))
            }
          })
        }

        // Make request
        const response = await fetch(url.toString(), {
          method: finalConfig.method,
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
            ...finalConfig.headers
          },
          body: finalConfig.body ? JSON.stringify(finalConfig.body) : undefined,
          signal: AbortSignal.timeout(this.config.timeout)
        })

        const data = await response.json()

        if (!response.ok) {
          const error: ApiError = {
            success: false,
            error: data.error || 'Request failed',
            code: data.code || 'UNKNOWN_ERROR',
            status: response.status,
            details: data.details
          }

          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            this.config.onError(error)
            throw error
          }

          lastError = error
          throw error
        }

        // Apply response interceptor
        const finalResponse = await this.config.onResponse(data)
        return finalResponse as ApiResponse<T>

      } catch (error) {
        lastError = error as ApiError

        // Last attempt - throw error
        if (attempt === this.config.retries - 1) {
          this.config.onError(lastError)
          throw lastError
        }

        // Wait before retry (exponential backoff)
        const delay = this.config.retryDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  }

  // ==================== Generic Entity Methods ====================

  /**
   * List entities with filtering and pagination
   */
  async list<T = any>(
    entity: string,
    options?: {
      page?: number
      limit?: number
      filter?: Record<string, any>
      sort?: string
      fields?: string[]
      search?: string
    }
  ): Promise<ApiResponse<T[]>> {
    const params: Record<string, any> = {}

    if (options?.page) params.page = options.page
    if (options?.limit) params.limit = options.limit
    if (options?.filter) params.filter = JSON.stringify(options.filter)
    if (options?.sort) params.sort = options.sort
    if (options?.fields) params.fields = options.fields.join(',')
    if (options?.search) params.search = options.search

    return this.request<T[]>({
      method: 'GET',
      path: `/${entity}`,
      params
    })
  }

  /**
   * Get single entity by ID
   */
  async get<T = any>(entity: string, id: string): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      path: `/${entity}/${id}`
    })
  }

  /**
   * Create new entity
   */
  async create<T = any>(entity: string, data: Partial<T>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      path: `/${entity}`,
      body: data
    })
  }

  /**
   * Update existing entity
   */
  async update<T = any>(
    entity: string,
    id: string,
    data: Partial<T>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      path: `/${entity}/${id}`,
      body: data
    })
  }

  /**
   * Delete entity
   */
  async delete(entity: string, id: string): Promise<ApiResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/${entity}/${id}`
    })
  }

  // ==================== Type-Safe Entity Methods ====================

  /**
   * Tasks API
   */
  tasks = {
    list: (options?: {
      page?: number
      limit?: number
      status?: string[]
      priority?: string
      search?: string
    }) => {
      const filter: Record<string, any> = {}
      if (options?.status) filter.status = { $in: options.status }
      if (options?.priority) filter.priority = options.priority

      return this.list<Task>('tasks', {
        page: options?.page,
        limit: options?.limit,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        search: options?.search
      })
    },

    get: (id: string) => this.get<Task>('tasks', id),

    create: (data: CreateTaskInput) => this.create<Task>('tasks', data),

    update: (id: string, data: UpdateTaskInput) =>
      this.update<Task>('tasks', id, data),

    delete: (id: string) => this.delete('tasks', id),

    // Custom task methods
    complete: async (id: string) => {
      return this.update<Task>('tasks', id, { status: 'completed' })
    },

    archive: async (id: string) => {
      return this.update<Task>('tasks', id, { archived: true })
    }
  }

  /**
   * Users API (if enabled)
   */
  users = {
    list: (options?: { page?: number; limit?: number; search?: string }) =>
      this.list<User>('users', options),

    get: (id: string) => this.get<User>('users', id),

    update: (id: string, data: UpdateUserInput) =>
      this.update<User>('users', id, data),

    me: async () => {
      return this.request<User>({
        method: 'GET',
        path: '/users/me'
      })
    }
  }

  // ==================== Bulk Operations ====================

  /**
   * Bulk create entities
   */
  async bulkCreate<T = any>(
    entity: string,
    items: Partial<T>[],
    options?: {
      skipInvalid?: boolean
      returnFailures?: boolean
    }
  ): Promise<ApiResponse<{
    created: number
    failed: number
    items: T[]
    failures?: Array<{ index: number; item: any; error: string }>
  }>> {
    return this.request({
      method: 'POST',
      path: `/import/${entity}`,
      body: { items, options }
    })
  }

  /**
   * Bulk update entities
   */
  async bulkUpdate<T = any>(
    entity: string,
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<ApiResponse<{ updated: number }>> {
    return this.request({
      method: 'PATCH',
      path: `/bulk/${entity}`,
      body: { updates }
    })
  }

  /**
   * Bulk delete entities
   */
  async bulkDelete(
    entity: string,
    ids: string[]
  ): Promise<ApiResponse<{ deleted: number }>> {
    return this.request({
      method: 'DELETE',
      path: `/bulk/${entity}`,
      body: { ids }
    })
  }

  // ==================== File Uploads ====================

  /**
   * Upload file
   */
  async uploadFile(
    file: File,
    options?: {
      onProgress?: (progress: number) => void
    }
  ): Promise<ApiResponse<{
    url: string
    filename: string
    size: number
    type: string
  }>> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.config.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
      },
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      throw {
        success: false,
        error: data.error || 'Upload failed',
        code: data.code || 'UPLOAD_ERROR',
        status: response.status
      } as ApiError
    }

    return data
  }

  // ==================== Real-Time Updates ====================

  /**
   * Subscribe to entity updates via SSE
   */
  subscribe<T = any>(
    entity: string,
    callbacks: {
      onCreated?: (item: T) => void
      onUpdated?: (item: T) => void
      onDeleted?: (id: string) => void
      onError?: (error: Error) => void
    }
  ): () => void {
    const eventSource = new EventSource(
      `${this.config.baseUrl}/stream/${entity}`,
      {
        withCredentials: true
      }
    )

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === `${entity}.created` && callbacks.onCreated) {
          callbacks.onCreated(data.data)
        } else if (data.type === `${entity}.updated` && callbacks.onUpdated) {
          callbacks.onUpdated(data.data)
        } else if (data.type === `${entity}.deleted` && callbacks.onDeleted) {
          callbacks.onDeleted(data.id)
        }
      } catch (error) {
        callbacks.onError?.(error as Error)
      }
    }

    eventSource.onerror = (error) => {
      callbacks.onError?.(new Error('SSE connection error'))
    }

    // Return cleanup function
    return () => eventSource.close()
  }
}

// ==================== Type Definitions ====================

export interface Task {
  id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  assigneeId?: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: 'todo' | 'in_progress' | 'completed'
  priority?: 'low' | 'medium' | 'high'
  assigneeId?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: 'todo' | 'in_progress' | 'completed'
  priority?: 'low' | 'medium' | 'high'
  assigneeId?: string
  archived?: boolean
}

export interface User {
  id: string
  name: string
  email: string
  image?: string
  createdAt: string
  updatedAt: string
}

export interface UpdateUserInput {
  name?: string
  email?: string
  image?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}
```

### Usage Examples

**Basic CRUD:**
```typescript
import { api } from '@/lib/api-client'

// List tasks
const { data: tasks } = await api.tasks.list({
  page: 1,
  limit: 20,
  status: ['todo', 'in_progress']
})

// Get task
const { data: task } = await api.tasks.get('tsk_abc123')

// Create task
const { data: newTask } = await api.tasks.create({
  title: 'New task',
  status: 'todo',
  priority: 'high'
})

// Update task
const { data: updated } = await api.tasks.update('tsk_abc123', {
  status: 'completed'
})

// Delete task
await api.tasks.delete('tsk_abc123')
```

**Bulk Operations:**
```typescript
// Bulk create
const result = await api.bulkCreate('tasks', [
  { title: 'Task 1', status: 'todo' },
  { title: 'Task 2', status: 'in_progress' },
  { title: 'Task 3', status: 'completed' }
], {
  skipInvalid: true,
  returnFailures: true
})

console.log(`Created: ${result.data.created}, Failed: ${result.data.failed}`)
```

**Real-Time Updates:**
```typescript
// Subscribe to task updates
const unsubscribe = api.subscribe<Task>('tasks', {
  onCreated: (task) => {
    console.log('New task:', task)
    // Update UI
  },
  onUpdated: (task) => {
    console.log('Task updated:', task)
    // Update UI
  },
  onDeleted: (id) => {
    console.log('Task deleted:', id)
    // Update UI
  },
  onError: (error) => {
    console.error('SSE error:', error)
  }
})

// Later: cleanup
unsubscribe()
```

**File Upload:**
```typescript
const handleFileUpload = async (file: File) => {
  try {
    const result = await api.uploadFile(file, {
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress}%`)
      }
    })

    console.log('Uploaded:', result.data.url)
  } catch (error) {
    console.error('Upload failed:', error)
  }
}
```

### React Integration

**Custom Hook:**
```typescript
// hooks/use-api.ts
import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'

export function useApiList<T>(
  entity: string,
  options?: {
    page?: number
    limit?: number
    filter?: Record<string, any>
  }
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await api.list<T>(entity, options)
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [entity, JSON.stringify(options)])

  return { data, loading, error }
}

// Usage
function TaskList() {
  const { data: tasks, loading, error } = useApiList<Task>('tasks', {
    page: 1,
    limit: 20
  })

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {tasks.map(task => (
        <div key={task.id}>{task.title}</div>
      ))}
    </div>
  )
}
```

---

## Python SDK

### Installation

```bash
pip install your-company-api-client
```

### Complete Python SDK

```python
# api_client/__init__.py
import requests
import time
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass

@dataclass
class ApiClientConfig:
    api_key: Optional[str] = None
    base_url: str = "https://api.yourdomain.com/v1"
    timeout: int = 30
    retries: int = 3
    retry_delay: int = 1

class ApiError(Exception):
    def __init__(self, message: str, code: str, status: int, details: Optional[Dict] = None):
        self.message = message
        self.code = code
        self.status = status
        self.details = details
        super().__init__(self.message)

class ApiClient:
    def __init__(self, config: ApiClientConfig):
        self.config = config
        self.session = requests.Session()

        if config.api_key:
            self.session.headers.update({
                "Authorization": f"Bearer {config.api_key}"
            })

        self.session.headers.update({
            "Content-Type": "application/json"
        })

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        body: Optional[Dict] = None
    ) -> Dict:
        """Make API request with retry logic"""
        last_error = None

        for attempt in range(self.config.retries):
            try:
                url = f"{self.config.base_url}{path}"

                response = self.session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=body,
                    timeout=self.config.timeout
                )

                data = response.json()

                if not response.ok:
                    error = ApiError(
                        message=data.get("error", "Request failed"),
                        code=data.get("code", "UNKNOWN_ERROR"),
                        status=response.status_code,
                        details=data.get("details")
                    )

                    # Don't retry client errors (4xx)
                    if 400 <= response.status_code < 500:
                        raise error

                    last_error = error
                    raise error

                return data.get("data")

            except ApiError as e:
                last_error = e

                # Last attempt
                if attempt == self.config.retries - 1:
                    raise last_error

                # Wait before retry (exponential backoff)
                delay = self.config.retry_delay * (2 ** attempt)
                time.sleep(delay)

        raise last_error

    # ==================== Generic Entity Methods ====================

    def list(
        self,
        entity: str,
        page: int = 1,
        limit: int = 20,
        filter: Optional[Dict] = None,
        sort: Optional[str] = None,
        fields: Optional[List[str]] = None,
        search: Optional[str] = None
    ) -> Dict:
        """List entities with filtering and pagination"""
        params = {"page": page, "limit": limit}

        if filter:
            import json
            params["filter"] = json.dumps(filter)
        if sort:
            params["sort"] = sort
        if fields:
            params["fields"] = ",".join(fields)
        if search:
            params["search"] = search

        return self._request("GET", f"/{entity}", params=params)

    def get(self, entity: str, id: str) -> Dict:
        """Get single entity by ID"""
        return self._request("GET", f"/{entity}/{id}")

    def create(self, entity: str, data: Dict) -> Dict:
        """Create new entity"""
        return self._request("POST", f"/{entity}", body=data)

    def update(self, entity: str, id: str, data: Dict) -> Dict:
        """Update existing entity"""
        return self._request("PATCH", f"/{entity}/{id}", body=data)

    def delete(self, entity: str, id: str) -> None:
        """Delete entity"""
        self._request("DELETE", f"/{entity}/{id}")

    # ==================== Type-Safe Entity Methods ====================

    class Tasks:
        def __init__(self, client):
            self.client = client

        def list(
            self,
            page: int = 1,
            limit: int = 20,
            status: Optional[List[str]] = None,
            priority: Optional[str] = None,
            search: Optional[str] = None
        ):
            filter = {}
            if status:
                filter["status"] = {"$in": status}
            if priority:
                filter["priority"] = priority

            return self.client.list(
                "tasks",
                page=page,
                limit=limit,
                filter=filter if filter else None,
                search=search
            )

        def get(self, id: str):
            return self.client.get("tasks", id)

        def create(self, data: Dict):
            return self.client.create("tasks", data)

        def update(self, id: str, data: Dict):
            return self.client.update("tasks", id, data)

        def delete(self, id: str):
            return self.client.delete("tasks", id)

        def complete(self, id: str):
            return self.update(id, {"status": "completed"})

        def archive(self, id: str):
            return self.update(id, {"archived": True})

    @property
    def tasks(self):
        if not hasattr(self, "_tasks"):
            self._tasks = self.Tasks(self)
        return self._tasks

    # ==================== Bulk Operations ====================

    def bulk_create(
        self,
        entity: str,
        items: List[Dict],
        skip_invalid: bool = False,
        return_failures: bool = False
    ) -> Dict:
        """Bulk create entities"""
        return self._request(
            "POST",
            f"/import/{entity}",
            body={
                "items": items,
                "options": {
                    "skipInvalid": skip_invalid,
                    "returnFailures": return_failures
                }
            }
        )

    def bulk_update(self, entity: str, updates: List[Dict]) -> Dict:
        """Bulk update entities"""
        return self._request(
            "PATCH",
            f"/bulk/{entity}",
            body={"updates": updates}
        )

    def bulk_delete(self, entity: str, ids: List[str]) -> Dict:
        """Bulk delete entities"""
        return self._request(
            "DELETE",
            f"/bulk/{entity}",
            body={"ids": ids}
        )

    # ==================== File Uploads ====================

    def upload_file(self, file_path: str) -> Dict:
        """Upload file"""
        import os

        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f)}

            response = requests.post(
                f"{self.config.base_url}/upload",
                files=files,
                headers={
                    "Authorization": f"Bearer {self.config.api_key}"
                }
            )

            data = response.json()

            if not response.ok:
                raise ApiError(
                    message=data.get("error", "Upload failed"),
                    code=data.get("code", "UPLOAD_ERROR"),
                    status=response.status_code
                )

            return data.get("data")
```

### Python Usage Examples

```python
from api_client import ApiClient, ApiClientConfig

# Initialize client
client = ApiClient(ApiClientConfig(
    api_key="sk_live_abc123...",
    base_url="https://api.yourdomain.com/v1"
))

# List tasks
tasks = client.tasks.list(
    page=1,
    limit=20,
    status=["todo", "in_progress"]
)

# Get task
task = client.tasks.get("tsk_abc123")

# Create task
new_task = client.tasks.create({
    "title": "New task from Python",
    "status": "todo",
    "priority": "high"
})

# Update task
updated = client.tasks.update("tsk_abc123", {
    "status": "completed"
})

# Delete task
client.tasks.delete("tsk_abc123")

# Bulk operations
result = client.bulk_create("tasks", [
    {"title": "Task 1", "status": "todo"},
    {"title": "Task 2", "status": "in_progress"}
], skip_invalid=True, return_failures=True)

print(f"Created: {result['created']}, Failed: {result['failed']}")
```

---

## SDK Architecture

### Layered Design

```typescript
┌─────────────────────────────────────┐
│   High-Level API (tasks, users)    │  ← Type-safe methods
├─────────────────────────────────────┤
│   Generic Methods (list, get, etc) │  ← CRUD operations
├─────────────────────────────────────┤
│   HTTP Client (fetch, retry)       │  ← Network layer
├─────────────────────────────────────┤
│   Interceptors (request, response) │  ← Middleware
└─────────────────────────────────────┘
```

### Key Principles

1. **Type Safety** - Full TypeScript support with auto-generated types
2. **Error Handling** - Consistent error format across all methods
3. **Retry Logic** - Automatic retry with exponential backoff
4. **Interceptors** - Request/response middleware for customization
5. **Streaming** - SSE support for real-time updates
6. **Pagination** - Built-in pagination helpers
7. **Bulk Operations** - Efficient batch processing

---

## Auto-Generated Types

### From Zod Schemas

```typescript
// scripts/generate-sdk-types.ts
import { z } from 'zod'
import { zodToTs } from 'zod-to-ts'
import { writeFileSync } from 'fs'

// Import entity schemas
import { taskSchema } from '@/core/lib/entities/tasks/schema'

// Generate TypeScript types
const { node } = zodToTs(taskSchema)

// Write to file
writeFileSync(
  'packages/api-client/src/types/task.ts',
  `export ${node.getText()}`
)
```

**Generated Types:**
```typescript
// packages/api-client/src/types/task.ts (auto-generated)
export interface Task {
  id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  assigneeId?: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: 'todo' | 'in_progress' | 'completed'
  priority?: 'low' | 'medium' | 'high'
  assigneeId?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: 'todo' | 'in_progress' | 'completed'
  priority?: 'low' | 'medium' | 'high'
  assigneeId?: string
  archived?: boolean
}
```

---

## SDK Configuration

### Advanced Configuration

```typescript
import { ApiClient } from '@your-company/api-client'

const api = new ApiClient({
  apiKey: process.env.API_KEY,
  baseUrl: 'https://api.yourdomain.com/v1',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,

  // Request interceptor
  onRequest: async (config) => {
    // Add custom headers
    config.headers = {
      ...config.headers,
      'X-Custom-Header': 'value'
    }

    // Log request
    console.log(`[API] ${config.method} ${config.path}`)

    return config
  },

  // Response interceptor
  onResponse: async (response) => {
    // Log response
    console.log(`[API] Response:`, response)

    // Transform data
    if (response.meta?.pagination) {
      console.log(`Page ${response.meta.pagination.page} of ${response.meta.pagination.totalPages}`)
    }

    return response
  },

  // Error handler
  onError: (error) => {
    // Log errors
    console.error(`[API] Error: ${error.code} - ${error.error}`)

    // Send to error tracking service
    trackError(error)
  }
})
```

---

## Best Practices

### 1. Environment Configuration

```typescript
// lib/api-client.ts
export const api = new ApiClient({
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.yourdomain.com/v1',
  timeout: parseInt(process.env.API_TIMEOUT || '30000'),
  retries: parseInt(process.env.API_RETRIES || '3')
})
```

### 2. Error Handling

```typescript
try {
  const task = await api.tasks.get('tsk_abc123')
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    // Handle not found
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Handle rate limit
  } else {
    // Handle other errors
  }
}
```

### 3. Type Safety

```typescript
// ✅ GOOD: Full type safety
const task: Task = await api.tasks.get('tsk_abc123')
task.title // ✅ Autocomplete works

// ❌ BAD: No type safety
const task: any = await api.tasks.get('tsk_abc123')
task.titel // ❌ Typo not caught
```

### 4. Pagination Helpers

```typescript
async function* paginateAll<T>(
  entity: string,
  pageSize = 100
): AsyncGenerator<T[], void, unknown> {
  let page = 1
  let hasNext = true

  while (hasNext) {
    const response = await api.list<T>(entity, {
      page,
      limit: pageSize
    })

    yield response.data
    hasNext = response.meta?.pagination?.hasNext || false
    page++
  }
}

// Usage: Process all tasks
for await (const tasks of paginateAll('tasks')) {
  console.log(`Processing ${tasks.length} tasks...`)
  await processTasks(tasks)
}
```

### 5. Caching Layer

```typescript
const cache = new Map<string, { data: any; expiry: number }>()

async function cachedRequest<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = 60000
): Promise<T> {
  const cached = cache.get(key)

  if (cached && Date.now() < cached.expiry) {
    return cached.data
  }

  const data = await fn()

  cache.set(key, {
    data,
    expiry: Date.now() + ttl
  })

  return data
}

// Usage
const tasks = await cachedRequest(
  'tasks:all',
  () => api.tasks.list(),
  60000 // Cache for 1 minute
)
```

---

## Next Steps

- [Real-World Examples](./15-real-world-examples.md) - Complete application examples
- [Code Recipes](./16-code-recipes.md) - Common patterns and recipes
- [Integration Examples](./09-integration-examples.md) - Framework-specific examples

**Documentation:** `core/docs/05-api/14-client-libraries.md`
