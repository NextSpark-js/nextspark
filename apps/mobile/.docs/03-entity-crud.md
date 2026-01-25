# Entity CRUD Integration

This document explains how the mobile app implements CRUD operations for NextSpark entities using TanStack Query.

## Overview

The app follows a layered pattern for entity operations:

```
┌─────────────────────────────────────────────────────────────────┐
│                         SCREEN                                   │
│  Uses hooks: useTasks(), useCreateTask(), etc.                  │
├─────────────────────────────────────────────────────────────────┤
│                      TANSTACK QUERY HOOKS                        │
│  Manages caching, refetching, mutations                         │
├─────────────────────────────────────────────────────────────────┤
│                        API CLIENT                                │
│  Makes HTTP requests with auth headers                          │
├─────────────────────────────────────────────────────────────────┤
│                     NEXTSPARK API                                │
│  /api/v1/{entity}                                               │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints Pattern

NextSpark entities follow a consistent REST API pattern:

| Operation | Method | Endpoint | Body |
|-----------|--------|----------|------|
| List | GET | `/api/v1/{entity}?page=1&limit=20` | - |
| Get One | GET | `/api/v1/{entity}/{id}` | - |
| Create | POST | `/api/v1/{entity}` | Entity data |
| Update | PATCH | `/api/v1/{entity}/{id}` | Partial data |
| Delete | DELETE | `/api/v1/{entity}/{id}` | - |

## Response Formats

### Paginated List Response

```typescript
interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
```

### Single Entity Response

```typescript
interface SingleResponse<T> {
  data: T
}
```

## API Client Methods

The `apiClient` provides typed methods for each entity:

```typescript
// src/api/client.ts

// List with pagination and filters
async listTasks(params?: {
  page?: number
  limit?: number
  status?: string
  priority?: string
  search?: string
}): Promise<PaginatedResponse<Task>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  // ... other params

  const endpoint = `/api/v1/tasks${queryString ? `?${queryString}` : ''}`
  return this.request<PaginatedResponse<Task>>(endpoint)
}

// Get single entity
async getTask(id: string): Promise<SingleResponse<Task>> {
  return this.request<SingleResponse<Task>>(`/api/v1/tasks/${id}`)
}

// Create entity
async createTask(data: CreateTaskInput): Promise<SingleResponse<Task>> {
  return this.request<SingleResponse<Task>>('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Update entity
async updateTask(id: string, data: UpdateTaskInput): Promise<SingleResponse<Task>> {
  return this.request<SingleResponse<Task>>(`/api/v1/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// Delete entity
async deleteTask(id: string): Promise<void> {
  await this.request<void>(`/api/v1/tasks/${id}`, {
    method: 'DELETE',
  })
}
```

## TanStack Query Hooks

### Query Hooks (Read Operations)

```typescript
// src/hooks/useTasks.ts

const TASKS_QUERY_KEY = ['tasks']

// List hook with filters
export function useTasks(options: UseTasksOptions = {}) {
  const { page = 1, limit = 20, status, priority, search, enabled = true } = options

  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, { page, limit, status, priority, search }],
    queryFn: () => apiClient.listTasks({ page, limit, status, priority, search }),
    enabled,
  })
}

// Single entity hook
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, id],
    queryFn: () => apiClient.getTask(id!),
    enabled: !!id,
  })
}
```

### Mutation Hooks (Write Operations)

```typescript
// Create mutation
export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTaskInput) => apiClient.createTask(data),
    onSuccess: () => {
      // Invalidate list to refetch with new item
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

// Update mutation
export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) =>
      apiClient.updateTask(id, data),
    onSuccess: (response) => {
      // Update specific item in cache
      queryClient.setQueryData([...TASKS_QUERY_KEY, response.data.id], response)
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

// Delete mutation
export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTask(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: [...TASKS_QUERY_KEY, deletedId] })
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}
```

### Optimistic Updates

For better UX, status changes use optimistic updates:

```typescript
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task['status'] }) =>
      apiClient.updateTask(id, { status }),

    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY })

      // Snapshot previous value for rollback
      const previousTasks = queryClient.getQueriesData<PaginatedResponse<Task>>({
        queryKey: TASKS_QUERY_KEY,
      })

      // Optimistically update UI
      queryClient.setQueriesData<PaginatedResponse<Task>>(
        { queryKey: TASKS_QUERY_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            data: old.data.map((task) =>
              task.id === id ? { ...task, status } : task
            ),
          }
        }
      )

      return { previousTasks }
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },

    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}
```

## Screen Implementation

### List Screen

```typescript
// app/(app)/tasks.tsx

export default function TasksScreen() {
  const { data, isLoading, refetch } = useTasks()
  const deleteTask = useDeleteTask()

  const handleDelete = async (id: string) => {
    await deleteTask.mutateAsync(id)
  }

  return (
    <FlatList
      data={data?.data || []}
      renderItem={({ item }) => (
        <TaskCard
          task={item}
          onPress={() => router.push(`/(app)/task/${item.id}`)}
          onDelete={() => handleDelete(item.id)}
        />
      )}
      refreshing={isLoading}
      onRefresh={refetch}
    />
  )
}
```

### Create Screen

```typescript
// app/(app)/task/create.tsx

export default function CreateTaskScreen() {
  const createTask = useCreateTask()

  const handleSubmit = async (data: CreateTaskInput) => {
    await createTask.mutateAsync(data)
    router.back()
  }

  return (
    <TaskForm
      onSubmit={handleSubmit}
      isLoading={createTask.isPending}
    />
  )
}
```

### Edit Screen

```typescript
// app/(app)/task/[id].tsx

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data } = useTask(id)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const handleSubmit = async (formData: UpdateTaskInput) => {
    await updateTask.mutateAsync({ id: id!, data: formData })
    router.back()
  }

  const handleDelete = async () => {
    await deleteTask.mutateAsync(id!)
    router.back()
  }

  return (
    <TaskForm
      initialData={data?.data}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      isLoading={updateTask.isPending}
    />
  )
}
```

## Adding a New Entity

To add CRUD for a new entity (e.g., `projects`):

### 1. Add Types

```typescript
// src/types/index.ts

export interface Project {
  id: string
  name: string
  description?: string
  teamId: string
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  description?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string | null
}
```

### 2. Add API Client Methods

```typescript
// src/api/client.ts

async listProjects(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Project>> {
  // ...
}

async getProject(id: string): Promise<SingleResponse<Project>> {
  // ...
}

async createProject(data: CreateProjectInput): Promise<SingleResponse<Project>> {
  // ...
}

async updateProject(id: string, data: UpdateProjectInput): Promise<SingleResponse<Project>> {
  // ...
}

async deleteProject(id: string): Promise<void> {
  // ...
}
```

### 3. Create Hooks

```typescript
// src/hooks/useProjects.ts

const PROJECTS_QUERY_KEY = ['projects']

export function useProjects(options = {}) { ... }
export function useProject(id: string | undefined) { ... }
export function useCreateProject() { ... }
export function useUpdateProject() { ... }
export function useDeleteProject() { ... }
```

### 4. Create Components

- `src/components/ProjectCard.tsx`
- `src/components/ProjectForm.tsx`

### 5. Create Screens

- `app/(app)/projects.tsx`
- `app/(app)/project/create.tsx`
- `app/(app)/project/[id].tsx`

## Team Context

All entity operations automatically include the `x-team-id` header, ensuring data is scoped to the current team. When the team changes, all queries are invalidated to fetch fresh data.
