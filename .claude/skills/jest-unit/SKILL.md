---
name: jest-unit
description: |
  Jest unit testing patterns for this Next.js application.
  Covers test structure, mocking strategies, React component testing, hook testing, and coverage targets.
  Use this skill when writing unit tests for services, hooks, utilities, or components.
allowed-tools: Read, Glob, Grep
version: 1.0.0
---

# Jest Unit Testing Skill

Patterns for writing effective unit tests with Jest, React Testing Library, and project-specific mocking strategies.

## Architecture Overview

```
TEST FILE STRUCTURE:

core/tests/jest/
├── api/                 # API route tests
│   ├── tasks-basic.test.ts
│   └── api-keys.test.ts
├── hooks/               # React hooks tests
│   ├── useAuthMethodDetector.test.ts
│   └── useEntitySearch.test.ts
├── lib/                 # Utility tests
│   ├── ai-sanitize.test.ts
│   └── entity-meta.helpers.test.ts
├── components/          # Component tests
│   ├── auth/forms/LoginForm.test.tsx
│   └── ui/last-used-badge.test.tsx
├── services/            # Service tests
│   └── base-entity.service.test.ts
├── __mocks__/           # Mock utilities
│   ├── db-mocks.ts
│   ├── better-auth.js
│   └── next-server.js
└── setup.ts             # Global configuration

contents/themes/default/tests/jest/
└── ...                  # Theme-specific tests

contents/plugins/*/‌__tests__/
└── ...                  # Plugin-specific tests
```

## When to Use This Skill

- Writing unit tests for services
- Testing React hooks
- Testing React components
- Mocking database operations
- Mocking external dependencies
- Setting up test coverage

## Test File Structure

### Naming Conventions

```
*.test.ts   - TypeScript unit tests
*.test.tsx  - React component tests
*.spec.ts   - Alternative naming (same purpose)
```

### Standard Test Structure

```typescript
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { functionToTest } from '@/core/lib/module'

describe('ModuleName', () => {
  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Cleanup after each test (MANDATORY)
  afterEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  describe('Feature Group', () => {
    test('should do expected behavior when condition met', () => {
      // Arrange - set up test data
      const input = 'test-data'

      // Act - execute function
      const result = functionToTest(input)

      // Assert - verify output
      expect(result).toBe('expected-output')
    })

    test('should handle edge case correctly', () => {
      // Test edge cases, null values, errors
    })
  })
})
```

## Jest Configuration

### Root Config (`jest.config.ts`)

```typescript
import type { Config } from 'jest'

export const baseConfig: Partial<Config> = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',  // Browser environment for React

  // Path aliases (match tsconfig.json)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/core/(.*)$': '<rootDir>/core/$1',
    '^@/contents/(.*)$': '<rootDir>/contents/$1',
    // Mock external libraries
    'next/server': '<rootDir>/core/tests/jest/__mocks__/next-server.js',
    '^jose$': '<rootDir>/core/tests/jest/__mocks__/jose.js',
  },

  setupFilesAfterEnv: ['<rootDir>/core/tests/setup.ts'],
  testTimeout: 10000,
  forceExit: true,
}

const config: Config = {
  projects: [
    {
      displayName: 'core',
      testMatch: ['<rootDir>/core/tests/jest/**/*.{test,spec}.{js,ts,tsx}'],
    },
    {
      displayName: 'theme',
      testMatch: ['<rootDir>/contents/themes/*/tests/jest/**/*.{test,spec}.{js,ts,tsx}'],
    },
  ],
}

export default config
```

### Test Scripts (`package.json`)

```bash
pnpm test              # Run all core tests
pnpm test:theme        # Run theme-specific tests
pnpm test:coverage     # Generate coverage reports
pnpm test:watch        # Watch mode
```

## Mocking Strategies

### Database Mocking (MANDATORY)

```typescript
// Always mock database functions
jest.mock('@/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  queryOneWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

import { queryWithRLS, queryOneWithRLS, mutateWithRLS } from '@/core/lib/db'

// Type the mocks
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>

// Usage in tests
beforeEach(() => {
  jest.clearAllMocks()
})

test('returns entity when found', async () => {
  mockQueryOneWithRLS.mockResolvedValue({
    id: 'entity-123',
    title: 'Test Entity',
    createdAt: '2024-01-01T00:00:00Z'
  })

  const result = await service.getById('entity-123', 'user-456')

  expect(result).toEqual(expectedEntity)
  expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
    expect.stringContaining('FROM test_entities'),
    ['entity-123'],
    'user-456'
  )
})
```

### Next.js Mocking

```typescript
// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock next/server
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url, options) => ({
    url,
    method: options?.method || 'GET',
    headers: new Map(Object.entries(options?.headers || {})),
    json: jest.fn().mockResolvedValue(options?.body || {}),
  })),
  NextResponse: {
    json: jest.fn((body, init) => ({
      body,
      status: init?.status || 200,
    })),
  },
}))
```

### Translation Mocking (next-intl)

```typescript
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, options?: any) => {
    const translations: Record<string, string> = {
      'login.title': 'Sign In',
      'login.form.email': 'Email',
      'login.form.password': 'Password',
      'login.form.submit': 'Sign In',
      'errors.invalidCredentials': 'Invalid credentials',
    }
    return translations[key] || key
  },
  useLocale: () => 'en',
}))
```

### Auth Mocking

```typescript
const mockSignIn = jest.fn()
const mockSignOut = jest.fn()
const mockGoogleSignIn = jest.fn()

const mockUseAuth = {
  signIn: mockSignIn,
  signOut: mockSignOut,
  googleSignIn: mockGoogleSignIn,
  user: null,
  session: null,
  isLoading: false,
}

jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth
}))

// Override for specific tests
beforeEach(() => {
  mockUseAuth.user = { id: 'user-123', email: 'test@example.com' }
})
```

### Fetch Mocking

```typescript
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

// Mock successful response
mockFetch.mockResolvedValueOnce(
  new Response(JSON.stringify({ data: 'test' }), { status: 200 })
)

// Mock error response
mockFetch.mockResolvedValueOnce(
  new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
)

// Mock network error
mockFetch.mockRejectedValueOnce(new Error('Network error'))
```

## React Component Testing

### Basic Component Test

```typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/core/components/auth/forms/LoginForm'

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('should render login form with all essential elements', () => {
      render(<LoginForm />)

      expect(screen.getByText('Sign In')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    test('should call signIn with correct credentials', async () => {
      const user = userEvent.setup()

      render(<LoginForm />)

      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'password123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        })
      })
    })
  })

  describe('Error Handling', () => {
    test('should display error message on failed login', async () => {
      const user = userEvent.setup()
      mockSignIn.mockRejectedValue(new Error('Invalid credentials'))

      render(<LoginForm />)

      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'wrong')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    test('should have proper accessibility attributes', () => {
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('aria-required', 'true')
    })
  })
})
```

### Testing with userEvent (Preferred)

```typescript
import userEvent from '@testing-library/user-event'

// ✅ CORRECT - Use userEvent for realistic interactions
test('user types in input field', async () => {
  const user = userEvent.setup()

  render(<MyComponent />)

  await user.type(screen.getByRole('textbox'), 'Hello')
  await user.click(screen.getByRole('button'))

  expect(screen.getByText('Hello')).toBeInTheDocument()
})

// ❌ WRONG - fireEvent for user interactions
test('user types in input field', () => {
  render(<MyComponent />)

  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } })
  fireEvent.click(screen.getByRole('button'))
})
```

## React Hook Testing

### Using renderHook

```typescript
import { renderHook, act } from '@testing-library/react'
import { useAuthMethodDetector } from '@/core/hooks/useAuthMethodDetector'

const mockSearchParams = { get: jest.fn() }
const mockSaveAuthMethod = jest.fn()

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams
}))

jest.mock('@/core/hooks/useLastAuthMethod', () => ({
  useLastAuthMethod: () => ({ saveAuthMethod: mockSaveAuthMethod })
}))

describe('useAuthMethodDetector Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.get.mockReturnValue(null)
  })

  test('should detect Google OAuth parameter', () => {
    mockSearchParams.get.mockReturnValue('google')

    renderHook(() => useAuthMethodDetector())

    expect(mockSearchParams.get).toHaveBeenCalledWith('auth_method')
    expect(mockSaveAuthMethod).toHaveBeenCalledWith('google')
  })

  test('should not save when parameter is missing', () => {
    mockSearchParams.get.mockReturnValue(null)

    renderHook(() => useAuthMethodDetector())

    expect(mockSaveAuthMethod).not.toHaveBeenCalled()
  })
})
```

### Testing Hooks with State

```typescript
test('should update state correctly', async () => {
  const { result } = renderHook(() => useCounter())

  expect(result.current.count).toBe(0)

  act(() => {
    result.current.increment()
  })

  expect(result.current.count).toBe(1)
})
```

## Service Testing

### BaseEntityService Pattern

```typescript
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

describe('BaseEntityService', () => {
  let service: TestEntityService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new TestEntityService()
  })

  describe('getById', () => {
    test('returns entity when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockEntityRow)

      const result = await service.getById('entity-123', 'user-456')

      expect(result).toEqual(mockEntity)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('FROM test_entities'),
        ['entity-123'],
        'user-456'
      )
    })

    test('returns null when not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await service.getById('non-existent', 'user-456')

      expect(result).toBeNull()
    })

    test('throws error for empty id', async () => {
      await expect(service.getById('', 'user-456'))
        .rejects.toThrow('Entity ID is required')
    })
  })

  describe('list', () => {
    test('returns paginated results', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '2' }])  // Count query
        .mockResolvedValueOnce([mockEntityRow, mockEntityRow])  // Data query

      const result = await service.list('user-456')

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.limit).toBe(20)
    })
  })
})
```

## Async Testing Patterns

### Using waitFor

```typescript
test('should show loading then data', async () => {
  render(<DataComponent />)

  // Initially loading
  expect(screen.getByText('Loading...')).toBeInTheDocument()

  // Wait for data
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument()
  }, { timeout: 3000 })
})
```

### Testing Promises

```typescript
test('should resolve with correct data', async () => {
  const result = await fetchData()
  expect(result).toEqual({ id: '123' })
})

test('should reject with error', async () => {
  await expect(fetchData('invalid')).rejects.toThrow('Invalid input')
})
```

### Fake Timers

```typescript
test('should reset after delay', () => {
  jest.useFakeTimers()

  try {
    startTimer()
    expect(isActive()).toBe(true)

    jest.advanceTimersByTime(1000)

    expect(isActive()).toBe(false)
  } finally {
    jest.useRealTimers()
  }
})
```

## Global Test Setup

### Setup File (`core/tests/setup.ts`)

```typescript
import '@testing-library/jest-dom'

// Environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'

// Global mocks
global.fetch = jest.fn()

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

global.crypto = {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
  getRandomValues: jest.fn((arr) => arr),
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
  }
}

// Custom matchers
expect.extend({
  toBeValidApiKey(received: string) {
    const apiKeyRegex = /^sk_(live|test)_[a-f0-9]{64}$/
    const pass = apiKeyRegex.test(received)

    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a valid API key`
          : `Expected ${received} to be a valid API key format`,
      pass
    }
  },
})

// Cleanup
afterEach(() => {
  jest.clearAllMocks()
  jest.resetModules()
})
```

## Coverage Targets

| Category | Target | Notes |
|----------|--------|-------|
| **Critical Paths** | 90%+ | Auth, API, Validation |
| **Features** | 80%+ | UI, Business Logic |
| **Utilities** | 80%+ | Helpers, Services |
| **Components** | 70%+ | UI Components |

### Coverage Configuration

```typescript
// jest.config.ts
collectCoverageFrom: [
  'core/**/*.{js,ts}',
  'contents/themes/**/*.{js,ts}',
  '!core/**/*.d.ts',
  '!core/**/__tests__/**',
  '!core/**/*.config.{js,ts}',
],
coverageDirectory: '<rootDir>/coverage',
coverageReporters: ['text', 'lcov', 'html'],
```

## Common Assertions

```typescript
// Equality
expect(result).toBe('expected')              // Strict equality
expect(result).toEqual({ id: '123' })        // Deep equality
expect(result).toStrictEqual(expected)       // Strict deep equality

// Truthiness
expect(result).toBeTruthy()
expect(result).toBeFalsy()
expect(result).toBeNull()
expect(result).toBeUndefined()
expect(result).toBeDefined()

// Collections
expect(array).toHaveLength(2)
expect(array).toContain('item')
expect(obj).toHaveProperty('key')
expect(obj).toEqual(expect.objectContaining({ key: 'value' }))

// Strings
expect(text).toContain('substring')
expect(text).toMatch(/regex/)

// DOM (Testing Library)
expect(element).toBeInTheDocument()
expect(element).toHaveClass('className')
expect(element).toHaveAttribute('href', '/path')
expect(element).toHaveTextContent('text')
expect(element).toBeVisible()
expect(element).toBeDisabled()

// Mocks
expect(mockFn).toHaveBeenCalled()
expect(mockFn).toHaveBeenCalledTimes(1)
expect(mockFn).toHaveBeenCalledWith('arg')
expect(mockFn).toHaveBeenLastCalledWith('arg')
```

## Anti-Patterns

```typescript
// ❌ NEVER: Test implementation details
test('should set internal state', () => {
  const { result } = renderHook(() => useMyHook())
  expect(result.current._internalState).toBe('value')  // Don't test internals
})

// ✅ CORRECT: Test observable behavior
test('should show correct output', () => {
  const { result } = renderHook(() => useMyHook())
  expect(result.current.displayValue).toBe('value')
})

// ❌ NEVER: Skip cleanup
test('test without cleanup', () => {
  // No afterEach cleanup - leaks between tests
})

// ✅ CORRECT: Always cleanup
afterEach(() => {
  jest.clearAllMocks()
})

// ❌ NEVER: Test async code without await
test('async test without await', () => {
  fetchData().then(data => {
    expect(data).toBeDefined()  // May not run!
  })
})

// ✅ CORRECT: Properly await async
test('async test with await', async () => {
  const data = await fetchData()
  expect(data).toBeDefined()
})

// ❌ NEVER: Mock everything
jest.mock('@/core/lib/utils')  // Over-mocking

// ✅ CORRECT: Mock only external dependencies
jest.mock('@/core/lib/db')  // Mock database only

// ❌ NEVER: Hardcode test data inline
test('creates user', async () => {
  const result = await createUser({ name: 'John', email: 'john@test.com', age: 30 })
})

// ✅ CORRECT: Use test fixtures
const mockUser = { name: 'John', email: 'john@test.com', age: 30 }
test('creates user', async () => {
  const result = await createUser(mockUser)
})
```

## Checklist

Before finalizing unit tests:

- [ ] All database calls mocked (queryWithRLS, mutateWithRLS)
- [ ] External APIs mocked (fetch)
- [ ] Next.js functions mocked (useRouter, useSearchParams)
- [ ] Translations mocked (useTranslations)
- [ ] afterEach cleanup with jest.clearAllMocks()
- [ ] Async tests properly awaited
- [ ] Test both success and error paths
- [ ] Edge cases covered (null, empty, invalid input)
- [ ] Coverage targets met (90%+ critical, 80%+ features)
- [ ] Test names are descriptive

## Related Skills

- `cypress-e2e` - Integration/E2E testing
- `cypress-api` - API testing with Cypress
- `zod-validation` - Schema validation testing
- `service-layer` - Service patterns to test
