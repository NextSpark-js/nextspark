# Mocking Strategies

## Introduction

Mocking replaces real dependencies with controlled test doubles, enabling **isolated, fast, and reliable tests**. Use mocks to test units in isolation without external dependencies.

---

## Jest Mocking

### Mock Functions

```typescript
// Create mock function
const mockFn = jest.fn()

// Mock with return value
const mockFn = jest.fn(() => 'return value')

// Mock with resolved promise
const mockFn = jest.fn().mockResolvedValue({ data: 'success' })

// Mock with rejected promise
const mockFn = jest.fn().mockRejectedValue(new Error('Failed'))

// Test mock calls
expect(mockFn).toHaveBeenCalled()
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
expect(mockFn).toHaveBeenCalledTimes(3)
```

### Mock Modules

```typescript
// Mock entire module
jest.mock('@/core/lib/db', () => ({
  query: jest.fn(),
  queryWithRLS: jest.fn(),
}))

// Import mocked module
import { query } from '@/core/lib/db'

// Use in test
describe('getUserData', () => {
  it('should fetch user from database', async () => {
    (query as jest.Mock).mockResolvedValue([{ id: '1', name: 'John' }])
    
    const user = await getUserData('1')
    
    expect(query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE id = $1',
      ['1']
    )
    expect(user.name).toBe('John')
  })
})
```

### Partial Mocks

```typescript
// Mock only specific functions
jest.mock('@/core/lib/utils', () => ({
  ...jest.requireActual('@/core/lib/utils'),
  dangerousFunction: jest.fn().mockReturnValue('safe')
}))
```

---

## Mocking Next.js

### Mock useRouter

```typescript
// core/tests/jest/__mocks__/next-router.ts
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))
```

### Mock Server Actions

```typescript
jest.mock('@/app/actions/tasks', () => ({
  createTask: jest.fn().mockResolvedValue({ id: '1', title: 'Task' }),
  updateTask: jest.fn().mockResolvedValue({ success: true }),
  deleteTask: jest.fn().mockResolvedValue({ success: true }),
}))
```

---

## Mocking API Calls

### Mock fetch

```typescript
global.fetch = jest.fn()

describe('API calls', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear()
  })

  it('should fetch data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'test' })
    })

    const result = await fetchData()
    
    expect(global.fetch).toHaveBeenCalledWith('/api/endpoint')
    expect(result.data).toBe('test')
  })

  it('should handle errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    await expect(fetchData()).rejects.toThrow('Network error')
  })
})
```

---

## Mocking Database

### Mock Query Functions

```typescript
// core/tests/jest/__mocks__/db.ts
export const query = jest.fn()
export const queryWithRLS = jest.fn()

// In test
import { queryWithRLS } from '@/core/lib/db'

describe('Task operations', () => {
  it('should fetch user tasks', async () => {
    (queryWithRLS as jest.Mock).mockResolvedValue([
      { id: '1', title: 'Task 1' },
      { id: '2', title: 'Task 2' },
    ])

    const tasks = await getUserTasks('user-123')

    expect(queryWithRLS).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      expect.any(Array),
      'user-123'
    )
    expect(tasks).toHaveLength(2)
  })
})
```

---

## Spying vs Mocking

### Spy on Real Implementation

```typescript
// Spy calls real function but tracks calls
const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

// Use function
someFunction()

// Verify spy was called
expect(consoleSpy).toHaveBeenCalled()

// Restore original
consoleSpy.mockRestore()
```

### Mock Replaces Implementation

```typescript
// Mock completely replaces function
jest.mock('./module', () => ({
  myFunction: jest.fn(() => 'mocked')
}))

// Original function never called
```

---

## Cypress Mocking

### Intercept API Calls

```typescript
describe('Tasks Page', () => {
  beforeEach(() => {
    // Mock API response
    cy.intercept('GET', '/api/v1/tasks', {
      statusCode: 200,
      body: {
        data: [
          { id: '1', title: 'Mocked Task 1' },
          { id: '2', title: 'Mocked Task 2' },
        ]
      }
    }).as('getTasks')
  })

  it('should display mocked tasks', () => {
    cy.visit('/dashboard/tasks')
    cy.wait('@getTasks')
    
    cy.contains('Mocked Task 1')
    cy.contains('Mocked Task 2')
  })
})
```

### Stub Responses

```typescript
// Stub with fixture data
cy.intercept('GET', '/api/v1/tasks', {
  fixture: 'tasks.json'
}).as('getTasks')

// Stub with delay
cy.intercept('GET', '/api/v1/tasks', (req) => {
  req.reply({
    delay: 2000,
    body: { data: [] }
  })
})
```

---

## Best Practices

### ✅ DO

```typescript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
})

// Mock external dependencies only
// Test real code when possible

// Use descriptive mock data
const mockUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com'
}

// Verify mock interactions
expect(mockFn).toHaveBeenCalledWith(expectedArgs)
```

### ❌ DON'T

```typescript
// Don't mock everything
// Mock only what's necessary

// Don't forget to restore
// Use afterEach to restore spies

// Don't make mocks complex
// Simple mocks are more maintainable

// Don't rely on mock implementation details
// Test behavior, not implementation
```

---

## Quick Reference

```typescript
// Mock function
jest.fn()
jest.fn(() => 'return')
jest.fn().mockReturnValue('value')
jest.fn().mockResolvedValue('async value')

// Mock module
jest.mock('./module')
jest.mock('./module', () => ({ fn: jest.fn() }))

// Spy
jest.spyOn(object, 'method')

// Assertions
expect(mock).toHaveBeenCalled()
expect(mock).toHaveBeenCalledWith(args)
expect(mock).toHaveBeenCalledTimes(n)

// Clear/Reset
mock.mockClear()        // Clear call history
mock.mockReset()        // Clear + remove implementation
mock.mockRestore()      // Restore original (spies only)
```

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** In Development
