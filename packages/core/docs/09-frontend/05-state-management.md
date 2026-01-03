# State Management

State management is one of the most critical aspects of building robust React applications. This guide covers our complete state management strategy, from server state to local UI state, with clear patterns and best practices.

---

## 📋 Table of Contents

1. [State Hierarchy](#state-hierarchy)
2. [Server State with TanStack Query](#server-state-with-tanstack-query)
3. [URL State Management](#url-state-management)
4. [Component State](#component-state)
5. [Context API for UI State](#context-api-for-ui-state)
6. [Modern React 19 Patterns](#modern-react-19-patterns)
7. [useEffect Guidelines](#useeffect-guidelines)
8. [Entity Registry Integration](#entity-registry-integration)
9. [Best Practices](#best-practices)
10. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## State Hierarchy

We follow a clear hierarchy for state management, choosing the right tool for each type of state:

```typescript
// 1. SERVER STATE: TanStack Query + Router loaders
const { data: todos, isLoading } = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos
})

// 2. URL STATE: Search params for shareable UI state
const searchParams = useSearchParams()
const filter = searchParams.get('filter')
const sort = searchParams.get('sort')
const page = searchParams.get('page')

// 3. COMPONENT STATE: useState for local component state
const [isExpanded, setIsExpanded] = useState(false)
const [inputValue, setInputValue] = useState('')

// 4. CONTEXT API: For cross-component UI state
const { theme, toggleTheme } = useTheme()
const { sidebarOpen, toggleSidebar } = useLayout()

// 5. EXTERNAL STORES: useSyncExternalStore for third-party state
const connectionStatus = useSyncExternalStore(
  websocket.subscribe,
  websocket.getStatus
)
```

### Decision Matrix

| State Type | Tool | Use When |
|------------|------|----------|
| **Server Data** | TanStack Query | Data from APIs, databases |
| **URL State** | Search Params | Shareable filters, pagination |
| **Local UI** | useState | Component-specific toggles |
| **Global UI** | Context API | Theme, sidebar, layout |
| **External** | useSyncExternalStore | WebSocket, localStorage |

---

## Server State with TanStack Query

TanStack Query v5.85 is our primary solution for server state management, providing automatic caching, request deduplication, optimistic updates, and background refetching.

### Basic Query Pattern

```typescript
// core/hooks/useEntityQuery.ts
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import type { EntityConfig } from '@/core/lib/entities/types'

export function useEntityQuery(options: UseEntityQueryOptions) {
  const {
    entityConfig,
    pageSize = 10,
    search = '',
    filters = {},
    sort = null,
    staleTime = 1000 * 60 * 5, // 5 minutes default
    gcTime = 1000 * 60 * 60,    // 1 hour default
  } = options

  const { user } = useAuth()

  // Build query key with all params for proper cache invalidation
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

  const query = useQuery({
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

      const response = await fetch(
        `/api/v1/${entityConfig.slug}?${params}`
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch ${entityConfig.names.plural}`)
      }

      return response.json()
    },
    enabled: !!user, // Only fetch when user is authenticated
    staleTime,
    gcTime,
  })

  return {
    ...query,
    items: query.data?.items || [],
    total: query.data?.total || 0,
  }
}
```

### Mutations with Optimistic Updates

```typescript
// core/hooks/useEntityMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useEntityMutations(options: UseEntityMutationsOptions) {
  const { entityConfig, onSuccess, onError } = options
  const queryClient = useQueryClient()

  const baseQueryKey = ['entity', entityConfig.slug]

  // CREATE mutation with optimistic update
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await fetch(`/api/v1/${entityConfig.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create')
      }

      return response.json()
    },
    onMutate: async (newItem) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: baseQueryKey })

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueriesData({
        queryKey: baseQueryKey
      })

      // Optimistically update all matching queries
      queryClient.setQueriesData({ queryKey: baseQueryKey }, (old: any) => {
        if (!old?.items) return old
        return {
          ...old,
          items: [{ ...newItem, id: 'temp-' + Date.now() }, ...old.items],
          total: old.total + 1,
        }
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      onError?.(error as Error, variables)
    },
    onSuccess: (data, variables) => {
      onSuccess?.(data, variables)
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: baseQueryKey })
    },
  })

  // UPDATE mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string
      data: Record<string, unknown>
    }) => {
      const response = await fetch(`/api/v1/${entityConfig.slug}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update')
      }

      return response.json()
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: baseQueryKey })

      const previousData = queryClient.getQueriesData({
        queryKey: baseQueryKey
      })

      // Optimistically update lists
      queryClient.setQueriesData({ queryKey: baseQueryKey }, (old: any) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.map((item: any) =>
            item.id === id ? { ...item, ...data } : item
          ),
        }
      })

      // Optimistically update single entity queries
      queryClient.setQueriesData({
        queryKey: [...baseQueryKey, id]
      }, (old: any) => {
        if (!old) return old
        return { ...old, ...data }
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      onError?.(error as Error, variables)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseQueryKey })
    },
  })

  // DELETE mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/${entityConfig.slug}/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      return { id }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: baseQueryKey })

      const previousData = queryClient.getQueriesData({
        queryKey: baseQueryKey
      })

      // Optimistically remove from lists
      queryClient.setQueriesData({ queryKey: baseQueryKey }, (old: any) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.filter((item: any) => item.id !== id),
          total: old.total - 1,
        }
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      onError?.(error as Error, variables)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseQueryKey })
    },
  })

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
```

### Universal Entity Hook

Our `useEntity` hook combines queries and mutations for complete entity management:

```typescript
// core/hooks/useEntity.ts
export function useEntity(options: UseEntityOptions): EntityHookResult {
  const {
    entityConfig,
    pageSize = 10,
    autoFetch = true,
  } = options

  // Local state for search & filtering
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown>>({})
  const [sort, setSort] = useState<SortConfig | null>(null)

  // Query for fetching data
  const {
    items,
    total,
    totalPages,
    isLoading,
    error: queryError,
    refetch,
  } = useEntityQuery({
    entityConfig,
    pageSize,
    search: searchQuery,
    filters,
    sort,
    enabled: autoFetch,
  })

  // Mutations for CRUD operations
  const {
    create,
    update,
    delete: deleteItem,
    bulkDelete,
    isCreating,
    isUpdating,
    isDeleting,
  } = useEntityMutations({
    entityConfig,
    onError: (error) => {
      // Handle validation errors
      console.error('Entity mutation error:', error)
    },
  })

  // CRUD operation wrappers
  const handleCreate = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        const result = await create(data)
        return result
      } catch (error) {
        throw error
      }
    },
    [create]
  )

  const handleUpdate = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      try {
        const result = await update({ id, data })
        return result
      } catch (error) {
        throw error
      }
    },
    [update]
  )

  return {
    // Data
    items,
    totalItems: total,
    totalPages,

    // Loading states
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,

    // Error states
    error: queryError?.message || null,

    // Search & filtering
    searchQuery,
    filters,
    sort,

    // CRUD operations
    create: handleCreate,
    update: handleUpdate,
    delete: deleteItem,
    bulkDelete,

    // Search & filtering handlers
    setSearchQuery,
    setFilters,
    setSort,

    // Utility
    refresh: refetch,
  }
}
```

### Usage Example

```typescript
// In a component
function ProductList() {
  const { data: productConfig } = useEntityConfig('products')

  const {
    items,
    isLoading,
    isCreating,
    create,
    update,
    delete: deleteProduct,
    searchQuery,
    setSearchQuery,
  } = useEntity({
    entityConfig: productConfig,
    pageSize: 20,
    autoFetch: true,
  })

  const handleCreateProduct = async () => {
    try {
      await create({
        name: 'New Product',
        price: 99.99,
        category: 'electronics',
      })
      toast.success('Product created successfully')
    } catch (error) {
      toast.error(error.message)
    }
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
      />

      <Button
        onClick={handleCreateProduct}
        disabled={isCreating}
      >
        {isCreating ? 'Creating...' : 'Create Product'}
      </Button>

      <div className="grid gap-4">
        {items.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
```

---

## URL State Management

Use URL search params for shareable UI state like filters, sorting, and pagination.

### Next.js 15 Search Params

```typescript
'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'

export function ProductFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Read from URL
  const category = searchParams.get('category') || 'all'
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const sort = searchParams.get('sort') || 'newest'

  // Update URL
  const updateFilters = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, pathname, router])

  return (
    <div className="space-y-4">
      <Select
        value={category}
        onValueChange={(value) => updateFilters({ category: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="electronics">Electronics</SelectItem>
          <SelectItem value="clothing">Clothing</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Min price"
          value={minPrice}
          onChange={(e) => updateFilters({ minPrice: e.target.value })}
        />
        <Input
          type="number"
          placeholder="Max price"
          value={maxPrice}
          onChange={(e) => updateFilters({ maxPrice: e.target.value })}
        />
      </div>

      <Select
        value={sort}
        onValueChange={(value) => updateFilters({ sort: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest First</SelectItem>
          <SelectItem value="oldest">Oldest First</SelectItem>
          <SelectItem value="price-asc">Price: Low to High</SelectItem>
          <SelectItem value="price-desc">Price: High to Low</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
```

### Benefits of URL State

✅ **CORRECT** - URL state for filters:
```typescript
// Shareable URLs
https://example.com/products?category=electronics&sort=price-asc&page=2

// Users can bookmark, share, or refresh
// State persists across page reloads
```

❌ **WRONG** - Component state for filters:
```typescript
const [category, setCategory] = useState('all')
const [sort, setSort] = useState('newest')

// Lost on refresh
// Can't share with others
// No browser history
```

---

## Component State

Use `useState` and `useReducer` for local component state that doesn't need to be shared.

### Simple State with useState

```typescript
'use client'

import { useState } from 'react'

export function ProductCard({ product }: { product: Product }) {
  // Simple toggle state
  const [isExpanded, setIsExpanded] = useState(false)

  // Simple input state
  const [quantity, setQuantity] = useState(1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>${product.price}</CardDescription>
      </CardHeader>

      <CardContent>
        {isExpanded && (
          <p className="text-sm text-muted-foreground">
            {product.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value))}
            className="w-20"
          />
          <Button>Add to Cart</Button>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </Button>
      </CardFooter>
    </Card>
  )
}
```

### Complex State with useReducer

```typescript
'use client'

import { useReducer } from 'react'

interface CartState {
  items: CartItem[]
  total: number
  discount: number
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'APPLY_DISCOUNT'; payload: number }
  | { type: 'CLEAR_CART' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM':
      const existingItem = state.items.find(
        item => item.id === action.payload.id
      )

      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item
          ),
          total: calculateTotal(state.items, state.discount),
        }
      }

      return {
        ...state,
        items: [...state.items, action.payload],
        total: calculateTotal([...state.items, action.payload], state.discount),
      }

    case 'REMOVE_ITEM':
      const filteredItems = state.items.filter(
        item => item.id !== action.payload
      )
      return {
        ...state,
        items: filteredItems,
        total: calculateTotal(filteredItems, state.discount),
      }

    case 'UPDATE_QUANTITY':
      const updatedItems = state.items.map(item =>
        item.id === action.payload.id
          ? { ...item, quantity: action.payload.quantity }
          : item
      )
      return {
        ...state,
        items: updatedItems,
        total: calculateTotal(updatedItems, state.discount),
      }

    case 'APPLY_DISCOUNT':
      return {
        ...state,
        discount: action.payload,
        total: calculateTotal(state.items, action.payload),
      }

    case 'CLEAR_CART':
      return {
        items: [],
        total: 0,
        discount: 0,
      }

    default:
      return state
  }
}

export function ShoppingCart() {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    total: 0,
    discount: 0,
  })

  const addItem = (product: Product, quantity: number) => {
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity,
      },
    })
  }

  const removeItem = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id })
  }

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } })
  }

  return (
    <div>
      {state.items.map(item => (
        <CartItem
          key={item.id}
          item={item}
          onRemove={removeItem}
          onUpdateQuantity={updateQuantity}
        />
      ))}

      <div className="mt-4">
        <p>Subtotal: ${state.total.toFixed(2)}</p>
        {state.discount > 0 && (
          <p>Discount: -${state.discount.toFixed(2)}</p>
        )}
        <p className="font-bold">
          Total: ${(state.total - state.discount).toFixed(2)}
        </p>
      </div>
    </div>
  )
}
```

---

## Context API for UI State

Use Context API for global UI state that needs to be shared across multiple components (theme, layout, sidebar, etc.).

### Basic Context Pattern

```typescript
// core/contexts/sidebar-context.tsx
'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useSidebarState } from '@/core/hooks/useSidebarState'

interface SidebarContextType {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  isLoading: boolean
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const {
    isCollapsed,
    setIsCollapsed,
    toggleSidebar,
    isLoading
  } = useSidebarState()

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed,
        toggleSidebar,
        isLoading
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
```

### Context with Persisted State

```typescript
// core/hooks/useSidebarState.ts
'use client'

import { useState, useCallback, useEffect } from 'react'

export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    }
    setIsLoading(false)
  }, [])

  // Save to localStorage on change
  const handleSetCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed)
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [])

  const toggleSidebar = useCallback(() => {
    handleSetCollapsed(!isCollapsed)
  }, [isCollapsed, handleSetCollapsed])

  return {
    isCollapsed,
    setIsCollapsed: handleSetCollapsed,
    toggleSidebar,
    isLoading,
  }
}
```

### Usage in Components

```typescript
// In layout
export default function DashboardLayout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1">{children}</main>
      </div>
    </SidebarProvider>
  )
}

// In Sidebar component
function Sidebar() {
  const { isCollapsed, toggleSidebar } = useSidebar()

  return (
    <aside className={cn(
      "border-r transition-all",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <Button onClick={toggleSidebar}>
        {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
      </Button>
      {/* Sidebar content */}
    </aside>
  )
}

// In any child component
function Header() {
  const { toggleSidebar } = useSidebar()

  return (
    <header>
      <Button onClick={toggleSidebar}>
        Toggle Sidebar
      </Button>
    </header>
  )
}
```

---

## Modern React 19 Patterns

React 19 introduces new patterns that simplify state management.

### The `use` Hook for Suspending on Promises

```typescript
import { use, Suspense } from 'react'

// ✅ CORRECT - React 19 'use' for suspending on promises
function TodoList({ todosPromise }: { todosPromise: Promise<Todo[]> }) {
  const todos = use(todosPromise) // Suspends until resolved

  return (
    <div>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  )
}

// Wrap in Suspense boundary
function TodosPage() {
  const todosPromise = fetch('/api/todos').then(res => res.json())

  return (
    <Suspense fallback={<TodosSkeleton />}>
      <TodoList todosPromise={todosPromise} />
    </Suspense>
  )
}
```

### `useActionState` for Forms

```typescript
import { useActionState } from 'react'

// ✅ CORRECT - React 19 useActionState for forms
function ContactForm() {
  const [state, formAction] = useActionState(
    async (prevState: any, formData: FormData) => {
      try {
        await submitContactForm(formData)
        return {
          success: true,
          message: 'Form submitted successfully!'
        }
      } catch (error) {
        return {
          success: false,
          message: 'Failed to submit form'
        }
      }
    },
    { success: false, message: '' }
  )

  return (
    <form action={formAction}>
      <Input name="email" type="email" required />
      <Input name="message" required />

      <Button type="submit">Submit</Button>

      {state.message && (
        <p className={cn(
          state.success ? 'text-green-600' : 'text-red-600'
        )}>
          {state.message}
        </p>
      )}
    </form>
  )
}
```

---

## useEffect Guidelines

**CRITICAL: Follow these guidelines for ALL React component development.**

Reference: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

### ❌ NEVER use useEffect for:

#### 1. Data Fetching (Use TanStack Query)

```typescript
// ❌ FORBIDDEN - useEffect for data fetching
useEffect(() => {
  fetch('/api/todos')
    .then(res => res.json())
    .then(setTodos)
}, [])

// ✅ CORRECT - TanStack Query
function TodosPage() {
  const { data: todos } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then(res => res.json())
  })
  return <TodoList todos={todos} />
}
```

#### 2. Deriving State (Calculate During Render)

```typescript
// ❌ FORBIDDEN - useEffect for derived state
useEffect(() => {
  setFormattedData(data.map(item => ({ ...item, formatted: true })))
}, [data])

useEffect(() => {
  setIsValid(email.includes('@') && password.length > 8)
}, [email, password])

// ✅ CORRECT - Calculate during render
const formattedData = useMemo(() =>
  data.map(item => ({ ...item, formatted: true })),
  [data]
)

// ✅ CORRECT - Direct calculation (no memo needed for simple operations)
const isValid = email.includes('@') && password.length > 8
```

#### 3. Syncing UI State (Use URL State or Key Prop)

```typescript
// ❌ FORBIDDEN - useEffect for UI state synchronization
useEffect(() => {
  setSelectedItem(null)
}, [category])

// ✅ CORRECT - Use key prop to reset component state
<ProductList key={category} category={category} />
```

#### 4. Server Mutations (Use TanStack Query Mutations)

```typescript
// ❌ FORBIDDEN - useEffect for mutations
useEffect(() => {
  if (shouldUpdateUser) {
    updateUser(userData)
  }
}, [shouldUpdateUser, userData])

// ✅ CORRECT - TanStack Query mutations
const updateUserMutation = useMutation({
  mutationFn: updateUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['user'] })
  }
})

const handleUpdateUser = () => {
  updateUserMutation.mutate(userData)
}
```

### ✅ ONLY use useEffect for:

#### External System Synchronization

```typescript
// ✅ CORRECT - External store synchronization
useEffect(() => {
  const unsubscribe = externalStore.subscribe((value) => {
    setExternalValue(value)
  })
  return unsubscribe
}, [])
```

#### DOM/Event Listeners (Minimal Use)

```typescript
// ✅ CORRECT - DOM manipulation when necessary
useEffect(() => {
  const element = elementRef.current
  if (!element) return

  const observer = new IntersectionObserver(handleIntersection)
  observer.observe(element)

  return () => observer.disconnect()
}, [])

// ✅ CORRECT - Global event listeners
useEffect(() => {
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeModal()
    }
  }

  document.addEventListener('keydown', handleKeydown)
  return () => document.removeEventListener('keydown', handleKeydown)
}, [])
```

### useEffect Checklist

Before writing `useEffect`, ask yourself:

- [ ] Can this be calculated during render?
- [ ] Can this use TanStack Query for data fetching?
- [ ] Can this use search params for URL state?
- [ ] Can this use `useActionState` for form handling?
- [ ] Can this use Context API for cross-component state?
- [ ] Can this use `useSyncExternalStore` for external state?
- [ ] Is this truly synchronizing with an external system?

**Only proceed with `useEffect` if ALL above are "No".**

---

## Entity Registry Integration

Our state management integrates seamlessly with the entity registry system.

### Accessing Entity Configs

```typescript
// core/hooks/useEntityConfig.ts
'use client'

import { useEffect, useState } from 'react'
import type { EntityConfig } from '@/core/lib/entities/types'

export function useEntityConfig(slug: string) {
  const [config, setConfig] = useState<EntityConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Dynamically import entity registry
    import('@/core/lib/registries/entity-registry')
      .then(({ ENTITY_REGISTRY }) => {
        const entityConfig = ENTITY_REGISTRY[slug]
        setConfig(entityConfig || null)
        setIsLoading(false)
      })
      .catch(() => {
        setConfig(null)
        setIsLoading(false)
      })
  }, [slug])

  return { data: config, isLoading }
}
```

### Using Entity Config with TanStack Query

```typescript
function EntityPage({ slug }: { slug: string }) {
  const { data: entityConfig, isLoading: configLoading } = useEntityConfig(slug)

  const {
    items,
    isLoading: dataLoading,
    create,
    update,
    delete: deleteItem,
  } = useEntity({
    entityConfig: entityConfig!,
    pageSize: 20,
    autoFetch: !!entityConfig,
  })

  if (configLoading) return <Spinner />
  if (!entityConfig) return <NotFound />
  if (dataLoading) return <Skeleton />

  return (
    <div>
      <h1>{entityConfig.names.plural}</h1>
      <EntityList
        items={items}
        onCreate={create}
        onUpdate={update}
        onDelete={deleteItem}
      />
    </div>
  )
}
```

---

## Best Practices

### 1. Prefer TanStack Query for Server State

✅ **CORRECT**:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['products', category],
  queryFn: () => fetchProducts(category),
  staleTime: 5 * 60 * 1000, // 5 minutes
})
```

❌ **WRONG**:
```typescript
const [data, setData] = useState([])
const [isLoading, setIsLoading] = useState(true)

useEffect(() => {
  setIsLoading(true)
  fetchProducts(category)
    .then(setData)
    .finally(() => setIsLoading(false))
}, [category])
```

### 2. Use URL State for Shareable UI

✅ **CORRECT**:
```typescript
const searchParams = useSearchParams()
const filter = searchParams.get('filter') || 'all'
```

❌ **WRONG**:
```typescript
const [filter, setFilter] = useState('all')
// Lost on refresh, can't share
```

### 3. Optimize with React.memo and useCallback

✅ **CORRECT**:
```typescript
const ExpensiveListItem = React.memo(({ item, onUpdate }: {
  item: ListItem
  onUpdate: (id: string) => void
}) => {
  const handleUpdate = useCallback(() => {
    onUpdate(item.id)
  }, [item.id, onUpdate])

  return (
    <div>
      <button onClick={handleUpdate}>Update</button>
    </div>
  )
})
```

### 4. Avoid Unnecessary useMemo

✅ **CORRECT** - Simple operations don't need memo:
```typescript
const isValid = email.includes('@') && password.length > 8
const fullName = `${firstName} ${lastName}`.trim()
```

❌ **WRONG** - Over-optimization:
```typescript
const isValid = useMemo(() =>
  email.includes('@') && password.length > 8,
  [email, password]
)
```

### 5. Use Optimistic Updates for Better UX

```typescript
const updateMutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    // Cancel refetch
    await queryClient.cancelQueries({ queryKey: ['todos'] })

    // Snapshot previous
    const previous = queryClient.getQueryData(['todos'])

    // Optimistically update
    queryClient.setQueryData(['todos'], (old: any) =>
      old.map((todo: any) =>
        todo.id === newTodo.id ? newTodo : todo
      )
    )

    return { previous }
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['todos'], context?.previous)
  },
})
```

---

## Anti-Patterns to Avoid

### ❌ Don't Fetch in useEffect

```typescript
// ❌ WRONG
useEffect(() => {
  fetch('/api/data').then(setData)
}, [])

// ✅ CORRECT
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData
})
```

### ❌ Don't Sync Props to State

```typescript
// ❌ WRONG
function UserProfile({ user }: { user: User }) {
  const [name, setName] = useState(user.name)

  useEffect(() => {
    setName(user.name)
  }, [user.name])

  // ...
}

// ✅ CORRECT - Use key prop
function UserProfile({ user }: { user: User }) {
  const [name, setName] = useState(user.name)
  // ...
}

<UserProfile key={user.id} user={user} />
```

### ❌ Don't Create Unnecessary Context

```typescript
// ❌ WRONG - Context for data that doesn't change often
const DataContext = createContext<Data | null>(null)

// ✅ CORRECT - Pass as props if only 1-2 levels deep
function Parent() {
  const { data } = useQuery({ queryKey: ['data'], queryFn: fetchData })
  return <Child data={data} />
}
```

### ❌ Don't Put Everything in Context

```typescript
// ❌ WRONG - Too much in one context
const AppContext = createContext({
  user, theme, sidebar, modal, toast, ...
})

// ✅ CORRECT - Split into focused contexts
const UserContext = createContext({ user })
const ThemeContext = createContext({ theme })
const LayoutContext = createContext({ sidebar })
```

---

## Related Documentation

- **[Forms and Validation](./06-forms-and-validation.md)** - Form state management with React Hook Form
- **[Performance Optimization](./09-performance-optimization.md)** - Performance patterns for state
- **[Component Architecture](./01-component-architecture.md)** - Component composition patterns

---

## Resources

- [TanStack Query Documentation](https://tanstack.com/query/latest/docs/framework/react/overview)
- [React Documentation - Managing State](https://react.dev/learn/managing-state)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Next.js 15 - useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
