# Runtime Performance

## Introduction

Runtime performance determines how **responsive and smooth** your application feels after the initial load. This guide covers React 19 optimization patterns, component memoization, and strategies to keep the main thread responsive.

**Core Principle:** Minimize unnecessary work and keep the UI responsive to user interactions.

---

## React 19 Performance Features

### New Performance Primitives

React 19 introduces significant performance improvements:

```typescript
// 1. Automatic Batching (Even in Async)
// ✅ React 19 automatically batches these updates
async function handleClick() {
  await fetch('/api/data')
  setLoading(false)      // Batched
  setData(response)      // Batched
  setError(null)         // Batched
  // Result: Single re-render instead of three
}

// 2. Improved useMemo/useCallback
// React 19 optimizes these hooks internally
// Memoization is more efficient with better cache hit rates

// 3. Server Components (Zero Client JS)
// Runs on server, ships only HTML
async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUser(userId)  // Server-side
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  )
  // Zero JavaScript sent to client for this component
}
```

### Suspense for Data Fetching

```typescript
// ✅ CORRECT - Use Suspense with React 19
import { Suspense } from 'react'
import { use } from 'react'

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise)  // Suspends until resolved
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}

export default function ProfilePage({ userId }: { userId: string }) {
  const userPromise = fetchUser(userId)
  
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  )
}
```

---

## React.memo - Prevent Unnecessary Re-renders

### When to Use React.memo

Use `React.memo` for **components that re-render frequently with the same props**:

```typescript
// ❌ WITHOUT memo - Re-renders on every parent update
function ProductCard({ product }: { product: Product }) {
  console.log('ProductCard rendered')  // Logs on every parent re-render
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>${product.price}</CardDescription>
      </CardHeader>
    </Card>
  )
}

// ✅ WITH memo - Only re-renders when product changes
import { memo } from 'react'

export const ProductCard = memo(function ProductCard({ 
  product 
}: { 
  product: Product 
}) {
  console.log('ProductCard rendered')  // Only logs when product changes
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>${product.price}</CardDescription>
      </CardHeader>
    </Card>
  )
})
```

### Custom Comparison Function

For complex props, provide a custom comparison:

```typescript
import { memo } from 'react'

interface TaskCardProps {
  task: Task
  user: User
  settings: Settings
}

export const TaskCard = memo(
  function TaskCard({ task, user, settings }: TaskCardProps) {
    return <div>{/* Task card content */}</div>
  },
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    // Return false if props changed (re-render)
    return (
      prevProps.task.id === nextProps.task.id &&
      prevProps.task.updatedAt === nextProps.task.updatedAt &&
      prevProps.user.id === nextProps.user.id
      // Ignore settings changes for performance
    )
  }
)
```

### When NOT to Use React.memo

```typescript
// ❌ DON'T memo simple components
// Overhead > benefit
const SimpleText = memo(({ text }: { text: string }) => {
  return <p>{text}</p>
})

// ✅ CORRECT - Just render directly
function SimpleText({ text }: { text: string }) {
  return <p>{text}</p>
}

// ❌ DON'T memo components that always get new props
function ParentComponent() {
  const [count, setCount] = useState(0)
  
  return (
    <ExpensiveChild
      data={{ count }}  // New object every render - memo useless
    />
  )
}
```

---

## useCallback - Memoize Functions

### Stable Function References

Use `useCallback` to **prevent child re-renders** when passing callbacks:

```typescript
'use client'

import { useCallback, useState } from 'react'

function ProductList({ products }: { products: Product[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ❌ WRONG - New function every render
  const handleToggle = (productId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(productId) ? next.delete(productId) : next.add(productId)
      return next
    })
  }

  // ✅ CORRECT - Stable function reference
  const handleToggle = useCallback((productId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(productId) ? next.delete(productId) : next.add(productId)
      return next
    })
  }, [])  // No dependencies - function never changes

  return (
    <div>
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onToggle={handleToggle}  // Same reference every render
        />
      ))}
    </div>
  )
}
```

### With Dependencies

```typescript
function TaskManager({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState('all')

  // ✅ CORRECT - Include dependencies
  const handleDeleteTask = useCallback(async (taskId: string) => {
    await deleteTask(taskId, userId)  // Uses userId
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }, [userId])  // Re-create when userId changes

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks
    return tasks.filter(t => t.status === filter)
  }, [tasks, filter])  // Re-calculate when these change

  return (
    <div>
      <FilterButtons onFilterChange={setFilter} />
      <TaskList 
        tasks={filteredTasks} 
        onDelete={handleDeleteTask} 
      />
    </div>
  )
}
```

---

## useMemo - Memoize Expensive Calculations

### When to Use useMemo

Use `useMemo` for **computationally expensive operations**:

```typescript
import { useMemo } from 'react'

function AnalyticsDashboard({ transactions }: { transactions: Transaction[] }) {
  // ✅ CORRECT - Expensive calculation, memoize it
  const statistics = useMemo(() => {
    console.log('Calculating statistics...')
    
    const total = transactions.reduce((sum, t) => sum + t.amount, 0)
    const average = total / transactions.length
    const byCategory = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)
    
    return { total, average, byCategory }
  }, [transactions])  // Only recalculate when transactions change

  // ✅ CORRECT - Filtered/sorted arrays
  const recentTransactions = useMemo(() => 
    transactions
      .filter(t => t.date > Date.now() - 7 * 24 * 60 * 60 * 1000)
      .sort((a, b) => b.date - a.date)
      .slice(0, 10),
    [transactions]
  )

  return (
    <div>
      <StatsCard stats={statistics} />
      <RecentList transactions={recentTransactions} />
    </div>
  )
}
```

### When NOT to Use useMemo

```typescript
// ❌ DON'T memo simple operations
function UserGreeting({ firstName, lastName }: UserProps) {
  // ❌ WRONG - Overhead > benefit
  const fullName = useMemo(
    () => `${firstName} ${lastName}`,
    [firstName, lastName]
  )

  // ✅ CORRECT - Just calculate directly
  const fullName = `${firstName} ${lastName}`

  return <h1>Hello, {fullName}!</h1>
}

// ❌ DON'T memo if dependencies change frequently
function SearchResults({ query, filters, sort }: Props) {
  // ❌ WRONG - All deps change on every keystroke
  const processedResults = useMemo(
    () => processResults(query, filters, sort),
    [query, filters, sort]
  )
  
  // ✅ BETTER - Use debounced query
  const debouncedQuery = useDebounce(query, 300)
  const processedResults = useMemo(
    () => processResults(debouncedQuery, filters, sort),
    [debouncedQuery, filters, sort]
  )
}
```

---

## Optimization Decision Tree

### When to Use What

```typescript
// Decision flowchart
const optimizationGuide = {
  question: 'What are you optimizing?',
  
  component: {
    ask: 'Does it re-render with same props?',
    yes: 'Use React.memo',
    no: 'No optimization needed',
  },
  
  function: {
    ask: 'Passed to memoized child?',
    yes: 'Use useCallback',
    no: 'No optimization needed',
  },
  
  calculation: {
    ask: 'Is it expensive (>10ms)?',
    yes: {
      ask: 'Do inputs change frequently?',
      yes: 'Consider debouncing first',
      no: 'Use useMemo',
    },
    no: 'No optimization needed',
  },
}
```

**Quick Reference Table:**

| Optimization | Use When | Example |
|--------------|----------|---------|
| **React.memo** | Component re-renders unnecessarily | List items, cards |
| **useCallback** | Passing callbacks to memoized children | Event handlers |
| **useMemo** | Expensive calculations (>10ms) | Filtering, sorting |
| **Debounce** | High-frequency events | Search input |
| **Throttle** | Rate-limit events | Scroll, resize |

---

## Avoiding Unnecessary Re-renders

### Component Composition Patterns

```typescript
// ❌ WRONG - Entire list re-renders when count changes
function Dashboard() {
  const [count, setCount] = useState(0)
  const [products] = useState(expensiveProductList)

  return (
    <div>
      <Header count={count} />
      <ProductList products={products} />  {/* Re-renders unnecessarily */}
    </div>
  )
}

// ✅ CORRECT - Separate state concerns
function Dashboard() {
  return (
    <div>
      <DashboardHeader />  {/* Has its own count state */}
      <ProductList />      {/* Independent of count */}
    </div>
  )
}

function DashboardHeader() {
  const [count, setCount] = useState(0)
  return <Header count={count} />
}
```

### State Colocation

```typescript
// ❌ WRONG - Global state for local concern
function App() {
  const [modalOpen, setModalOpen] = useState(false)  // Used only in one place
  
  return (
    <div>
      <Header />
      <Content />
      <CreateProductModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </div>
  )
}

// ✅ CORRECT - State lives where it's used
function App() {
  return (
    <div>
      <Header />
      <Content />
      <CreateProductButton />  {/* Modal state inside this component */}
    </div>
  )
}

function CreateProductButton() {
  const [modalOpen, setModalOpen] = useState(false)
  
  return (
    <>
      <Button onClick={() => setModalOpen(true)}>Create Product</Button>
      <CreateProductModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </>
  )
}
```

---

## Event Handler Optimization

### Debouncing High-Frequency Events

```typescript
// Custom debounce hook
import { useCallback, useRef } from 'react'

function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback(
    ((...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    }) as T,
    [callback, delay]
  )
}

// Usage
function SearchComponent() {
  const [query, setQuery] = useState('')

  // ❌ WRONG - API call on every keystroke
  const handleSearch = async (value: string) => {
    await fetch(`/api/search?q=${value}`)
  }

  // ✅ CORRECT - Debounced search
  const debouncedSearch = useDebounce(async (value: string) => {
    await fetch(`/api/search?q=${value}`)
  }, 300)

  return (
    <input
      value={query}
      onChange={(e) => {
        setQuery(e.target.value)
        debouncedSearch(e.target.value)  // Waits 300ms after typing stops
      }}
    />
  )
}
```

### Throttling Scroll Events

```typescript
import { useEffect, useRef } from 'react'

function useThrottle<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now())

  return useCallback(
    ((...args) => {
      const now = Date.now()
      
      if (now - lastRun.current >= delay) {
        callback(...args)
        lastRun.current = now
      }
    }) as T,
    [callback, delay]
  )
}

// Usage
function InfiniteScrollList() {
  const throttledScroll = useThrottle(() => {
    // Load more items
    loadMoreItems()
  }, 200)

  useEffect(() => {
    window.addEventListener('scroll', throttledScroll)
    return () => window.removeEventListener('scroll', throttledScroll)
  }, [throttledScroll])

  return <div>{/* List items */}</div>
}
```

---

## Preventing Layout Thrashing

### Batch DOM Reads and Writes

```typescript
// ❌ WRONG - Interleaved reads and writes (layout thrashing)
function updateElements(elements: HTMLElement[]) {
  elements.forEach(el => {
    const height = el.offsetHeight  // Read (forces layout)
    el.style.width = `${height}px`  // Write (invalidates layout)
    // Browser recalculates layout on every iteration
  })
}

// ✅ CORRECT - Batch reads, then batch writes
function updateElements(elements: HTMLElement[]) {
  // Phase 1: Read all (single layout calculation)
  const heights = elements.map(el => el.offsetHeight)
  
  // Phase 2: Write all (single layout invalidation)
  elements.forEach((el, i) => {
    el.style.width = `${heights[i]}px`
  })
}
```

### Use CSS Transforms Instead of Layout Properties

```typescript
// ❌ WRONG - Triggers layout on every frame
function animatePosition(element: HTMLElement) {
  let position = 0
  
  function animate() {
    position += 1
    element.style.left = `${position}px`  // Triggers layout
    requestAnimationFrame(animate)
  }
  
  animate()
}

// ✅ CORRECT - Uses compositor-only property
function animatePosition(element: HTMLElement) {
  let position = 0
  
  function animate() {
    position += 1
    element.style.transform = `translateX(${position}px)`  // GPU-accelerated
    requestAnimationFrame(animate)
  }
  
  animate()
}
```

---

## React DevTools Profiler

### Measuring Component Performance

```typescript
// 1. Open React DevTools
// 2. Go to "Profiler" tab
// 3. Click "Record" button
// 4. Interact with your app
// 5. Click "Stop" to analyze

// Reading the results:
const profilerInsights = {
  flamegraph: 'Shows which components rendered and how long',
  rankedChart: 'Lists components by render time (slowest first)',
  commitTimeline: 'Shows all re-renders over time',
  
  // What to look for:
  warnings: [
    'Components rendering >16ms (visible lag)',
    'Frequent re-renders (every interaction)',
    'Large component trees rendering together',
  ],
}
```

### Programmatic Profiling

```typescript
import { Profiler, ProfilerOnRenderCallback } from 'react'

const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  console.log(`${id} (${phase}) took ${actualDuration}ms`)
  
  // Send to analytics
  if (actualDuration > 16) {  // Frame budget exceeded
    analytics.track('Slow Render', {
      component: id,
      duration: actualDuration,
      phase,
    })
  }
}

function App() {
  return (
    <Profiler id="Dashboard" onRender={onRender}>
      <Dashboard />
    </Profiler>
  )
}
```

---

## Real-world Entity Component Example

### Optimized EntityList Component

```typescript
// core/components/entities/EntityList.tsx
import { memo, useCallback, useMemo } from 'react'
import type { EntityConfig } from '@/core/lib/entities/types'

interface EntityListProps {
  entityConfig: EntityConfig
  items: any[]
  onItemClick?: (item: any) => void
}

export const EntityList = memo(function EntityList({
  entityConfig,
  items,
  onItemClick,
}: EntityListProps) {
  // ✅ Memoize expensive calculations
  const visibleFields = useMemo(
    () => entityConfig.fields.filter(f => f.display.showInList),
    [entityConfig.fields]
  )

  // ✅ Stable callback reference
  const handleRowClick = useCallback(
    (item: any) => {
      onItemClick?.(item)
    },
    [onItemClick]
  )

  return (
    <div className="space-y-2">
      {items.map(item => (
        <EntityListItem
          key={item.id}
          item={item}
          fields={visibleFields}
          onClick={handleRowClick}
        />
      ))}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.entityConfig.slug === nextProps.entityConfig.slug &&
    prevProps.items.length === nextProps.items.length &&
    prevProps.items[0]?.updatedAt === nextProps.items[0]?.updatedAt
  )
})

const EntityListItem = memo(function EntityListItem({
  item,
  fields,
  onClick,
}: {
  item: any
  fields: Field[]
  onClick: (item: any) => void
}) {
  const handleClick = useCallback(() => {
    onClick(item)
  }, [item, onClick])

  return (
    <div onClick={handleClick} className="cursor-pointer hover:bg-accent">
      {fields.map(field => (
        <span key={field.name}>{item[field.name]}</span>
      ))}
    </div>
  )
})
```

---

## Best Practices Summary

### ✅ DO

```typescript
// Prefer calculation during render for simple operations
const fullName = `${firstName} ${lastName}`

// Use useMemo for expensive calculations
const stats = useMemo(() => calculateStats(data), [data])

// Use useCallback for stable callback references
const handleClick = useCallback(() => onClick(id), [id, onClick])

// Use React.memo for frequently re-rendering components
export const ProductCard = memo(ProductCard)

// Debounce high-frequency events
const debouncedSearch = useDebounce(handleSearch, 300)
```

### ❌ DON'T

```typescript
// Over-optimize simple operations
const isValid = useMemo(() => email.includes('@'), [email])  // Unnecessary

// Forget dependencies in hooks
useCallback(() => doSomething(value), [])  // Missing 'value'

// Memo everything blindly
const SimpleDiv = memo(({ children }) => <div>{children}</div>)

// Create inline objects/functions in memo'd component props
<MemoedComponent config={{ value }} />  // New object every render
```

---

## Next Steps

- **Profile your app:** Use React DevTools Profiler to find bottlenecks
- **Optimize strategically:** Focus on components that render frequently
- **Measure impact:** Verify optimizations actually improve performance
- **Learn more:** See [Core Web Vitals](./07-core-web-vitals.md) for user-facing metrics

**Related Documentation:**
- [Performance Overview](./01-performance-overview.md) - Overall strategy
- [Code Splitting](./06-code-splitting.md) - Lazy loading patterns
- [Monitoring and Profiling](./08-monitoring-and-profiling.md) - Measuring performance

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** Complete  
**React Version:** 19.1.0  
**Key Optimizations:** memo, useCallback, useMemo, composition
