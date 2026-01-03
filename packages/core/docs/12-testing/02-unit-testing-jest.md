# Unit Testing with Jest

## Introduction

Jest is our unit testing framework for testing **individual functions, utilities, and components** in isolation. Fast execution and comprehensive mocking make Jest ideal for testing business logic without external dependencies.

**Focus:** Pure functions, hooks, utilities, and isolated component logic.

---

## Jest Configuration

### Setup

```javascript
// jest.config.cjs
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  
  // Test locations
  testMatch: [
    '<rootDir>/core/tests/jest/**/*.{test,spec}.{js,ts,tsx}',
  ],
  
  // Module aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/core/(.*)$': '<rootDir>/core/$1',
  },
  
  // Coverage
  collectCoverageFrom: [
    'core/**/*.{js,ts}',
    '!core/**/*.d.ts',
    '!core/**/__tests__/**',
  ],
  
  coverageDirectory: '<rootDir>/test/coverage',
  setupFilesAfterEnv: ['<rootDir>/core/tests/setup.ts'],
}
```

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test -- --watch

# Coverage report
pnpm test -- --coverage

# Specific file
pnpm test -- utils.test.ts

# Update snapshots
pnpm test -- -u
```

---

## Test Structure

### Basic Test Pattern

```typescript
// core/tests/jest/lib/utils.test.ts
import { sanitizeInput } from '@/core/lib/utils'

describe('sanitizeInput', () => {
  it('should remove HTML tags', () => {
    const input = '<script>alert("xss")</script>Hello'
    const result = sanitizeInput(input)
    expect(result).toBe('alert("xss")Hello')
  })

  it('should handle empty strings', () => {
    expect(sanitizeInput('')).toBe('')
  })

  it('should preserve safe text', () => {
    expect(sanitizeInput('Hello World')).toBe('Hello World')
  })
})
```

### Testing Async Functions

```typescript
describe('fetchUserData', () => {
  it('should fetch user successfully', async () => {
    const user = await fetchUserData('user-123')
    
    expect(user).toMatchObject({
      id: 'user-123',
      name: expect.any(String),
      email: expect.any(String),
    })
  })

  it('should throw on invalid ID', async () => {
    await expect(fetchUserData('')).rejects.toThrow('Invalid ID')
  })
})
```

---

## Testing React Components

### Component Test Example

```typescript
// core/tests/jest/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/core/components/ui/button'

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    
    fireEvent.click(screen.getByText('Click'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

---

## Testing Custom Hooks

### Hook Test Example

```typescript
// core/tests/jest/hooks/useDebounce.test.ts
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/core/hooks/useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    )

    expect(result.current).toBe('initial')

    // Change value
    rerender({ value: 'updated' })
    expect(result.current).toBe('initial') // Still old value

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current).toBe('updated') // Now updated
  })
})
```

---

## Mocking

### Mock Functions

```typescript
describe('processData', () => {
  it('should call callback with result', () => {
    const mockCallback = jest.fn()
    
    processData('input', mockCallback)
    
    expect(mockCallback).toHaveBeenCalledWith('processed')
    expect(mockCallback).toHaveBeenCalledTimes(1)
  })
})
```

### Mock Modules

```typescript
// Mock external dependency
jest.mock('@/core/lib/db', () => ({
  query: jest.fn(),
}))

import { query } from '@/core/lib/db'

describe('getUserById', () => {
  it('should query database', async () => {
    (query as jest.Mock).mockResolvedValue([{ id: '1', name: 'John' }])
    
    const user = await getUserById('1')
    
    expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', ['1'])
    expect(user).toEqual({ id: '1', name: 'John' })
  })
})
```

---

## Snapshot Testing

### When to Use Snapshots

```typescript
// Good for: UI components that rarely change
describe('Header', () => {
  it('should match snapshot', () => {
    const { container } = render(<Header title="Test" />)
    expect(container).toMatchSnapshot()
  })
})

// ⚠️ Avoid for: Dynamic data, timestamps, random IDs
```

---

## Coverage Analysis

### Viewing Coverage

```bash
# Generate coverage report
pnpm test -- --coverage

# Open HTML report
open test/coverage/lcov-report/index.html
```

### Coverage Targets

```typescript
const COVERAGE_GOALS = {
  statements: 75,   // % of statements executed
  branches: 70,     // % of if/else branches covered
  functions: 80,    // % of functions called
  lines: 75,        // % of lines executed
}
```

---

## Best Practices

### ✅ DO

```typescript
// Descriptive test names
it('should throw error when email is invalid', () => {})

// Arrange, Act, Assert pattern
it('should calculate total', () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }]
  
  // Act
  const total = calculateTotal(items)
  
  // Assert
  expect(total).toBe(30)
})

// Test edge cases
it('should handle empty array', () => {})
it('should handle null', () => {})
it('should handle undefined', () => {})
```

### ❌ DON'T

```typescript
// Vague names
it('works', () => {})

// Multiple assertions for different things
it('should do everything', () => {
  expect(fn()).toBe(1)
  expect(fn2()).toBe(2)  // Separate test
})

// Testing implementation details
expect(component.state.value).toBe('x')  // Test behavior, not internals
```

---

## Common Patterns

### Testing Error Handling

```typescript
it('should handle errors gracefully', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
  
  await expect(failingFunction()).rejects.toThrow('Expected error')
  
  consoleSpy.mockRestore()
})
```

### Testing Timers

```typescript
it('should call function after delay', () => {
  jest.useFakeTimers()
  const callback = jest.fn()
  
  delayedFunction(callback, 1000)
  
  jest.advanceTimersByTime(1000)
  expect(callback).toHaveBeenCalled()
  
  jest.useRealTimers()
})
```

---

## Quick Reference

```typescript
// Matchers
expect(value).toBe(expected)           // Strict equality
expect(value).toEqual(expected)        // Deep equality
expect(value).toBeNull()
expect(value).toBeDefined()
expect(value).toBeTruthy()
expect(value).toContain(item)
expect(fn).toHaveBeenCalled()
expect(fn).toHaveBeenCalledWith(args)

// Async
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow(error)

// Mocks
jest.fn()                              // Mock function
jest.spyOn(obj, 'method')             // Spy on method
jest.mock('module')                    // Mock module
```

---

## Next Steps

- Run existing tests: `pnpm test`
- Add tests for new features
- Increase coverage gradually
- See [Test Coverage](./08-test-coverage.md) for coverage goals

---

**Last Updated:** 2025-11-20  
**Version:** 1.0.0  
**Status:** In Development
