# React Patterns and useEffect Guidelines

> **Source of Truth** for React patterns, useEffect guidelines, and modern React 19 patterns.
> Referenced by: `CLAUDE.md`, `.rules/components.md`

## Core Principle

**Prefer modern React patterns over useEffect whenever possible.**

Reference: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

---

## useEffect Anti-Patterns

### 1. Data Fetching

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

### 2. Derived State

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
  data.map(item => ({ ...item, formatted: true })), [data]
)

// ✅ CORRECT - Direct calculation (simple operations don't need memo)
const isValid = email.includes('@') && password.length > 8
```

### 3. UI State Synchronization

```typescript
// ❌ FORBIDDEN - useEffect for UI state sync
useEffect(() => {
  setSelectedItem(null)
}, [category])

// ✅ CORRECT - Use key prop to reset component state
<ProductList key={category} category={category} />

// ✅ CORRECT - Use URL state for shareable state
const searchParams = useSearchParams()
const category = searchParams.get('category')
```

### 4. Server Mutations

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

---

## Valid useEffect Use Cases

### External System Synchronization

```typescript
// ✅ CORRECT - Subscribing to external stores
useEffect(() => {
  const unsubscribe = externalStore.subscribe((value) => {
    setExternalValue(value)
  })
  return unsubscribe
}, [])

// ✅ CORRECT - WebSocket connections
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = handleMessage
  return () => ws.close()
}, [url])
```

### DOM Event Listeners

```typescript
// ✅ CORRECT - Global event listeners
useEffect(() => {
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeModal()
    }
  }

  document.addEventListener('keydown', handleKeydown)
  return () => document.removeEventListener('keydown', handleKeydown)
}, [closeModal])
```

### Intersection Observer

```typescript
// ✅ CORRECT - DOM observation
useEffect(() => {
  const element = elementRef.current
  if (!element) return

  const observer = new IntersectionObserver(handleIntersection)
  observer.observe(element)

  return () => observer.disconnect()
}, [handleIntersection])
```

---

## Modern React 19 Patterns

### The `use()` API

```typescript
import { use } from 'react'

function TodoList({ todosPromise }: { todosPromise: Promise<Todo[]> }) {
  const todos = use(todosPromise) // Suspends until resolved
  return (
    <div>
      {todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
    </div>
  )
}
```

### useActionState for Forms

```typescript
import { useActionState } from 'react'

function ContactForm() {
  const [state, formAction] = useActionState(async (prevState, formData: FormData) => {
    try {
      await submitContactForm(formData)
      return { success: true, message: 'Form submitted successfully!' }
    } catch (error) {
      return { success: false, message: 'Failed to submit form' }
    }
  }, { success: false, message: '' })

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <button type="submit">Submit</button>
      {state.message && (
        <p className={state.success ? 'text-green-600' : 'text-red-600'}>
          {state.message}
        </p>
      )}
    </form>
  )
}
```

---

## State Management Hierarchy

Use this order of preference:

```typescript
// 1. Server State: TanStack Query
const { data: todos, isLoading } = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos
})

// 2. URL State: For shareable UI state
const searchParams = useSearchParams()
const filter = searchParams.get('filter')

// 3. Component State: For local state
const [isExpanded, setIsExpanded] = useState(false)

// 4. Context API: For cross-component UI state
const { theme, toggleTheme } = useTheme()

// 5. External Stores: For third-party state
const connectionStatus = useSyncExternalStore(
  websocket.subscribe,
  websocket.getStatus
)
```

---

## Performance Optimization

### Simple Calculations

```typescript
// ✅ Calculate during render (no memo needed)
const isValid = email.includes('@') && password.length > 8
const fullName = `${firstName} ${lastName}`.trim()
```

### Expensive Calculations

```typescript
// ✅ Use useMemo for expensive operations
const expensiveValue = useMemo(() => {
  return complexCalculation(largeDataSet)
}, [largeDataSet])
```

### Stable References

```typescript
// ✅ Use useCallback for stable function references
const handleItemClick = useCallback((itemId: string) => {
  onItemSelect(itemId)
}, [onItemSelect])
```

### Component Memoization

```typescript
// ✅ React.memo for frequently re-rendered components
export const ExpensiveListItem = React.memo(({ item, onUpdate }: Props) => {
  const handleUpdate = useCallback(() => {
    onUpdate(item.id)
  }, [item.id, onUpdate])

  return (
    <div className="expensive-calculations">
      <button onClick={handleUpdate}>Update</button>
    </div>
  )
})
```

---

## useEffect Checklist

Before writing `useEffect`, verify all these are "No":

- [ ] Can this be calculated during render?
- [ ] Can this use TanStack Query for data fetching?
- [ ] Can this use URL search params for state?
- [ ] Can this use `useActionState` for form handling?
- [ ] Can this use Context API for cross-component state?
- [ ] Can this use `useSyncExternalStore` for external state?
- [ ] Is this truly synchronizing with an external system?

**Only proceed with `useEffect` if ALL above are "No".**

---

## Related Documentation

- Component Architecture: `core/docs/09-frontend/01-component-architecture.md`
- State Management: `core/docs/09-frontend/05-state-management.md`
- Forms and Validation: `core/docs/09-frontend/06-forms-and-validation.md`
- Performance Optimization: `core/docs/09-frontend/09-performance-optimization.md`
- Component Rules: `.rules/components.md`
