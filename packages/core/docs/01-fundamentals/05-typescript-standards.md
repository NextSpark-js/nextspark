# TypeScript Standards

## Introduction

This document defines the TypeScript standards and conventions used throughout the project. These standards ensure type safety, maintainability, and a consistent developer experience.

**Core Principles:**
- **Strict Mode** - Full TypeScript strict mode enabled
- **Zero Tolerance** - No `any` types, no type errors
- **Type Safety** - Explicit types over inference when clarity needed
- **Consistency** - Standard patterns across codebase
- **Documentation** - Types serve as inline documentation

---

## 1. TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    // Strict type checking
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Module resolution
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true,

    // Type checking
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    // Emit
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // Interop
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,

    // JSX
    "jsx": "preserve",
    "lib": ["dom", "dom.iterable", "esnext"],

    // Path aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/core/*": ["./core/*"],
      "@/contents/*": ["./contents/*"]
    },

    // Next.js specific
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    ".next",
    "dist"
  ]
}
```

### Key Settings Explained

**Strict Mode:**
- `strict: true` - Enables all strict type checks
- `noImplicitAny: true` - No implicit `any` types allowed
- `strictNullChecks: true` - `null` and `undefined` must be explicit

**Module Resolution:**
- `moduleResolution: "bundler"` - Modern bundler resolution
- `allowImportingTsExtensions: true` - Import `.ts` files directly

**Type Safety:**
- `noUncheckedIndexedAccess: true` - Array/object access returns `T | undefined`
- `noUnusedLocals: true` - Detect unused variables
- `noUnusedParameters: true` - Detect unused function parameters

---

## 2. Type Definitions Organization

### Directory Structure

```text
core/types/
├── index.ts                    # Re-exports all types
├── entities/                   # Entity type definitions
│   ├── task.ts
│   ├── user.ts
│   └── index.ts
├── api/                        # API request/response types
│   ├── requests.ts
│   ├── responses.ts
│   └── index.ts
├── database/                   # Database types
│   ├── tables.ts
│   └── index.ts
├── ui/                         # UI component prop types
│   ├── components.ts
│   └── index.ts
└── utils/                      # Utility types
    ├── helpers.ts
    └── index.ts
```

### Entity Types

**Location:** `core/types/entities/[entity].ts`

```typescript
// core/types/entities/task.ts

// Base entity type (from database)
export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  userId: string
  createdAt: Date
  updatedAt: Date
}

// Enum types
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

// Input types (for mutations)
export interface CreateTaskInput {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
}

// Filter types (for queries)
export interface TaskFilters {
  status?: TaskStatus
  priority?: TaskPriority
  userId?: string
  search?: string
}

// View types (for UI)
export interface TaskListItem extends Pick<Task, 'id' | 'title' | 'status' | 'priority'> {
  // Additional computed properties
  isOverdue?: boolean
}
```

### API Types

**Location:** `core/types/api/`

```typescript
// core/types/api/requests.ts
export interface PaginationParams {
  page: number
  limit: number
}

export interface SortParams {
  field: string
  direction: 'asc' | 'desc'
}

export interface ListRequest<TFilters = Record<string, any>> {
  filters?: TFilters
  pagination?: PaginationParams
  sort?: SortParams
}

// core/types/api/responses.ts
export interface ApiResponse<TData = any> {
  data: TData
  meta?: ResponseMeta
  error?: ApiError
}

export interface PaginatedResponse<TData = any> {
  data: TData[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
}

export interface ResponseMeta {
  requestId: string
  timestamp: string
  version: string
}
```

### Component Prop Types

**Location:** `core/types/ui/components.ts`

```typescript
// Base component props
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

// Button props
export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
}

// Form field props
export interface FormFieldProps<TValue = string> {
  name: string
  label: string
  value: TValue
  onChange: (value: TValue) => void
  error?: string
  required?: boolean
  disabled?: boolean
}
```

---

## 3. Interface vs Type

### When to Use Interface

**✅ Use `interface` for:**

1. **Object shapes (especially public APIs):**
```typescript
// ✅ CORRECT
export interface UserConfig {
  id: string
  name: string
  email: string
}
```

2. **Extension/inheritance:**
```typescript
// ✅ CORRECT
export interface AdminUser extends User {
  permissions: string[]
}
```

3. **Declaration merging:**
```typescript
// ✅ CORRECT
export interface WindowGlobal {
  gtag: Function
}

// Later in another file
export interface WindowGlobal {
  analytics: Function
}
```

### When to Use Type

**✅ Use `type` for:**

1. **Union types:**
```typescript
// ✅ CORRECT
export type Status = 'pending' | 'approved' | 'rejected'
export type ID = string | number
```

2. **Mapped types:**
```typescript
// ✅ CORRECT
export type ReadonlyEntity<T> = {
  readonly [K in keyof T]: T[K]
}
```

3. **Conditional types:**
```typescript
// ✅ CORRECT
export type ApiResponse<T> = T extends Error
  ? { error: T }
  : { data: T }
```

4. **Intersection types:**
```typescript
// ✅ CORRECT
export type UserWithMeta = User & { metadata: Record<string, any> }
```

5. **Primitive aliases:**
```typescript
// ✅ CORRECT
export type UserId = string
export type Timestamp = number
```

### General Rule

> **"Interface for objects, Type for everything else."**

---

## 4. React Component Typing

### Functional Components

**✅ CORRECT - Explicit return type:**
```typescript
import type { FC } from 'react'

interface TaskCardProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (id: string) => void
}

export const TaskCard: FC<TaskCardProps> = ({ task, onUpdate, onDelete }) => {
  return (
    <div>
      <h3>{task.title}</h3>
      <button onClick={() => onUpdate(task)}>Edit</button>
      <button onClick={() => onDelete(task.id)}>Delete</button>
    </div>
  )
}
```

**✅ CORRECT - Function declaration (preferred):**
```typescript
export function TaskCard({ task, onUpdate, onDelete }: TaskCardProps) {
  return (
    <div>
      <h3>{task.title}</h3>
      <button onClick={() => onUpdate(task)}>Edit</button>
      <button onClick={() => onDelete(task.id)}>Delete</button>
    </div>
  )
}
```

**❌ WRONG - No prop types:**
```typescript
// Missing type annotations
export function TaskCard({ task, onUpdate, onDelete }) {
  // TypeScript can't validate props
}
```

### Props with Children

```typescript
interface CardProps {
  title: string
  children: React.ReactNode
}

export function Card({ title, children }: CardProps) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  )
}
```

### Event Handlers

```typescript
import type { ChangeEvent, FormEvent, MouseEvent } from 'react'

interface FormProps {
  onSubmit: (data: FormData) => void
}

export function Form({ onSubmit }: FormProps) {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    console.log(event.target.value)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    onSubmit(formData)
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    console.log('Button clicked')
  }

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleInputChange} />
      <button onClick={handleClick}>Submit</button>
    </form>
  )
}
```

### Generic Components

```typescript
interface ListProps<TItem> {
  items: TItem[]
  renderItem: (item: TItem) => React.ReactNode
  keyExtractor: (item: TItem) => string
}

export function List<TItem>({ items, renderItem, keyExtractor }: ListProps<TItem>) {
  return (
    <div>
      {items.map((item) => (
        <div key={keyExtractor(item)}>{renderItem(item)}</div>
      ))}
    </div>
  )
}

// Usage
<List<Task>
  items={tasks}
  renderItem={(task) => <TaskCard task={task} />}
  keyExtractor={(task) => task.id}
/>
```

### Hooks Typing

```typescript
import { useState, useEffect, useCallback, useMemo } from 'react'

export function TaskList() {
  // ✅ Type inferred from initial value
  const [tasks, setTasks] = useState<Task[]>([])

  // ✅ Explicit type when initial value is null/undefined
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // ✅ useEffect with cleanup
  useEffect(() => {
    const subscription = subscribeToTasks((newTasks: Task[]) => {
      setTasks(newTasks)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // ✅ useCallback with typed parameters
  const handleTaskUpdate = useCallback((task: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
  }, [])

  // ✅ useMemo with typed return value
  const completedTasks = useMemo<Task[]>(
    () => tasks.filter((task) => task.status === 'done'),
    [tasks]
  )

  return <div>{/* ... */}</div>
}
```

---

## 5. API Route Typing

### Next.js 15 App Router

**Route Handler Types:**
```typescript
import type { NextRequest } from 'next/server'
import type { ApiResponse, PaginatedResponse } from '@/core/types/api'
import type { Task, TaskFilters } from '@/core/types/entities'

// GET /api/v1/tasks
export async function GET(
  request: NextRequest
): Promise<Response> {
  const { searchParams } = new URL(request.url)

  const filters: TaskFilters = {
    status: searchParams.get('status') as TaskStatus | undefined,
    priority: searchParams.get('priority') as TaskPriority | undefined
  }

  const tasks = await TaskService.list(userId, filters)

  const response: PaginatedResponse<Task> = {
    data: tasks,
    pagination: {
      page: 1,
      limit: 20,
      total: tasks.length,
      totalPages: 1
    }
  }

  return Response.json(response)
}

// POST /api/v1/tasks
export async function POST(
  request: NextRequest
): Promise<Response> {
  const body = await request.json() as CreateTaskInput

  const task = await TaskService.create(body, userId)

  const response: ApiResponse<Task> = {
    data: task
  }

  return Response.json(response, { status: 201 })
}

// PATCH /api/v1/tasks/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const body = await request.json() as UpdateTaskInput

  const task = await TaskService.update(params.id, body, userId)

  const response: ApiResponse<Task> = {
    data: task
  }

  return Response.json(response)
}

// DELETE /api/v1/tasks/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  await TaskService.delete(params.id, userId)

  return new Response(null, { status: 204 })
}
```

### Type-Safe Request Bodies

```typescript
// ✅ CORRECT - Validate request body
import { z } from 'zod'

const createTaskSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high'])
})

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.json()

  // Validate and parse
  const validatedData = createTaskSchema.parse(body)
  // Type is now: { title: string, description?: string, ... }

  const task = await TaskService.create(validatedData, userId)

  return Response.json({ data: task }, { status: 201 })
}
```

---

## 6. Service Layer Typing

### Service Class Pattern

```typescript
// core/lib/services/task.service.ts
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from '@/core/types/entities'

export class TaskService {
  static async list(
    userId: string,
    filters?: TaskFilters
  ): Promise<Task[]> {
    return queryWithRLS<Task>(
      'SELECT * FROM tasks WHERE user_id = $1',
      [userId],
      userId
    )
  }

  static async get(
    id: string,
    userId: string
  ): Promise<Task | null> {
    const tasks = await queryWithRLS<Task>(
      'SELECT * FROM tasks WHERE id = $1',
      [id],
      userId
    )

    return tasks[0] ?? null
  }

  static async create(
    data: CreateTaskInput,
    userId: string
  ): Promise<Task> {
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
    // Implementation
  }

  static async delete(
    id: string,
    userId: string
  ): Promise<void> {
    await queryWithRLS(
      'DELETE FROM tasks WHERE id = $1',
      [id],
      userId
    )
  }
}
```

---

## 7. Utility Types

### Built-in Utility Types

**✅ Use TypeScript's built-in utility types:**

```typescript
// Partial - Make all properties optional
type PartialTask = Partial<Task>
// { id?: string, title?: string, ... }

// Required - Make all properties required
type RequiredTask = Required<Task>

// Pick - Select specific properties
type TaskPreview = Pick<Task, 'id' | 'title' | 'status'>
// { id: string, title: string, status: TaskStatus }

// Omit - Exclude specific properties
type TaskWithoutTimestamps = Omit<Task, 'createdAt' | 'updatedAt'>

// Record - Create object type with specific keys
type TaskStatusCounts = Record<TaskStatus, number>
// { todo: number, in_progress: number, done: number }

// Readonly - Make all properties readonly
type ImmutableTask = Readonly<Task>

// ReturnType - Extract function return type
type TaskListResult = ReturnType<typeof TaskService.list>
// Promise<Task[]>

// Parameters - Extract function parameters
type ListParams = Parameters<typeof TaskService.list>
// [userId: string, filters?: TaskFilters]
```

### Custom Utility Types

```typescript
// core/types/utils/helpers.ts

// Make specific properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Usage
type TaskWithOptionalDescription = PartialBy<Task, 'description'>

// Make specific properties required
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

// Usage
type TaskWithRequiredDescription = RequiredBy<Task, 'description'>

// Extract non-nullable type
export type NonNullableFields<T> = {
  [K in keyof T]: NonNullable<T[K]>
}

// Deep partial
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

// Awaited type (TypeScript 4.5+)
export type AsyncReturnType<T extends (...args: any) => Promise<any>> = Awaited<ReturnType<T>>
```

---

## 8. Generics Best Practices

### Generic Functions

```typescript
// ✅ CORRECT - Generic array operations
function first<T>(arr: T[]): T | undefined {
  return arr[0]
}

function map<T, U>(arr: T[], fn: (item: T) => U): U[] {
  return arr.map(fn)
}

// Usage
const firstTask = first<Task>(tasks)
const taskIds = map(tasks, (task) => task.id)
```

### Generic Constraints

```typescript
// ✅ CORRECT - Constrain generic parameter
interface WithId {
  id: string
}

function findById<T extends WithId>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id)
}

// Works with any type that has an id
const task = findById(tasks, 'task-123')
const user = findById(users, 'user-456')
```

### Default Generic Types

```typescript
// ✅ CORRECT - Provide default type
interface ApiResponse<TData = any, TError = ApiError> {
  data?: TData
  error?: TError
}

// Usage
const response1: ApiResponse<Task> = { data: task }
const response2: ApiResponse = { data: 'anything' } // TData defaults to any
```

---

## 9. Enum vs Union Types

### When to Use Union Types (Preferred)

**✅ CORRECT - String literal union:**
```typescript
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

// Benefits:
// - No runtime overhead
// - Better autocomplete
// - Can be used in type guards
```

### When to Use Enums (Rarely)

**⚠️ USE SPARINGLY - Const enum:**
```typescript
// Only use when you need reverse mapping or namespacing
export const enum Permission {
  Read = 'READ',
  Write = 'WRITE',
  Delete = 'DELETE'
}

// Usage
const permission: Permission = Permission.Read
```

**❌ AVOID - Regular enum:**
```typescript
// Generates runtime code and can cause bundling issues
export enum TaskStatus {
  Todo = 'todo',
  InProgress = 'in_progress',
  Done = 'done'
}
```

---

## 10. Type Guards

### User-Defined Type Guards

```typescript
// ✅ CORRECT - Type guard function
export function isTask(value: unknown): value is Task {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'status' in value
  )
}

// Usage
if (isTask(data)) {
  // TypeScript knows data is Task
  console.log(data.title)
}
```

### Discriminated Unions

```typescript
// ✅ CORRECT - Discriminated union
interface SuccessResponse {
  type: 'success'
  data: Task
}

interface ErrorResponse {
  type: 'error'
  error: string
}

type ApiResult = SuccessResponse | ErrorResponse

function handleResponse(response: ApiResult) {
  if (response.type === 'success') {
    // TypeScript knows response.data exists
    console.log(response.data.title)
  } else {
    // TypeScript knows response.error exists
    console.error(response.error)
  }
}
```

---

## 11. Zero Tolerance Rules

### Prohibited Patterns

**❌ NEVER use `any`:**
```typescript
// ❌ WRONG
function processData(data: any) {
  return data.something
}

// ✅ CORRECT
function processData(data: unknown) {
  if (isValidData(data)) {
    return data.something
  }
  throw new Error('Invalid data')
}
```

**❌ NEVER use `@ts-ignore`:**
```typescript
// ❌ WRONG
// @ts-ignore
const value = dangerousOperation()

// ✅ CORRECT - Fix the type error or use proper type assertion
const value = dangerousOperation() as ExpectedType
```

**❌ NEVER use `as any`:**
```typescript
// ❌ WRONG
const task = data as any

// ✅ CORRECT - Use proper type guard
if (isTask(data)) {
  const task = data
}
```

### Type Assertions (Use Sparingly)

**⚠️ USE ONLY WHEN CERTAIN:**
```typescript
// ✅ ACCEPTABLE - You know the type from external source
const element = document.getElementById('root') as HTMLDivElement

// ✅ ACCEPTABLE - API response with known shape
const task = await response.json() as Task

// ❌ AVOID - Circumventing type safety
const anything = value as any as SomeType
```

---

## 12. Common Patterns

### Async/Await Typing

```typescript
// ✅ CORRECT - Explicit Promise return type
async function fetchTask(id: string): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`)
  const data = await response.json()
  return data as Task
}

// ✅ CORRECT - Error handling
async function fetchTaskSafe(id: string): Promise<Task | null> {
  try {
    const response = await fetch(`/api/tasks/${id}`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error(error)
    return null
  }
}
```

### Object Spreading with Types

```typescript
// ✅ CORRECT - Type-safe object spreading
function updateTask(task: Task, updates: UpdateTaskInput): Task {
  return {
    ...task,
    ...updates,
    updatedAt: new Date()
  }
}
```

### Array Methods with Types

```typescript
// ✅ CORRECT - Type inference with array methods
const tasks: Task[] = []

const completedTasks = tasks.filter((task): task is Task => task.status === 'done')

const taskIds = tasks.map((task) => task.id) // string[]

const hasHighPriority = tasks.some((task) => task.priority === 'high') // boolean
```

---

## Summary

**Configuration:**
- Strict mode enabled in `tsconfig.json`
- Zero tolerance for type errors
- Path aliases configured

**Type Organization:**
- Entity types in `core/types/entities/`
- API types in `core/types/api/`
- Component types in `core/types/ui/`
- Utility types in `core/types/utils/`

**Conventions:**
- Interface for object shapes
- Type for unions, intersections, primitives
- Explicit return types for exported functions
- Type guards for runtime validation

**React Patterns:**
- Typed props interfaces
- Explicit event handler types
- Generic components when needed
- Typed hooks

**API Patterns:**
- Typed route handlers
- Request/response interfaces
- Zod validation for runtime safety

**Zero Tolerance:**
- No `any` types
- No `@ts-ignore`
- No `as any`
- Fix type errors, don't suppress them

**Next:** [Development Workflow](./06-development-workflow.md)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
