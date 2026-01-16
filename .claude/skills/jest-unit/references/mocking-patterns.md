# Mocking Patterns Reference

Complete mocking strategies for Jest tests in this Next.js application.

## Database Mocking (MANDATORY)

Always mock database functions in unit tests.

```typescript
// Setup mock at top of test file
jest.mock('@/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  queryOneWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

import { queryWithRLS, queryOneWithRLS, mutateWithRLS } from '@/core/lib/db'

// Type the mocks for TypeScript
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

---

## Next.js Mocking

### Navigation Hooks

```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))
```

### Server Components

```typescript
// __mocks__/next-server.js
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url, options) => ({
    url,
    method: options?.method || 'GET',
    headers: new Map(Object.entries(options?.headers || {})),
    json: jest.fn().mockResolvedValue(options?.body || {}),
    nextUrl: new URL(url),
  })),
  NextResponse: {
    json: jest.fn((body, init) => ({
      body,
      status: init?.status || 200,
      headers: new Headers(init?.headers),
    })),
    redirect: jest.fn((url) => ({ url })),
    next: jest.fn(() => ({})),
  },
}))
```

### Headers and Cookies

```typescript
jest.mock('next/headers', () => ({
  headers: jest.fn(() => new Map()),
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(() => false),
  })),
}))
```

---

## Translation Mocking (next-intl)

### Basic Translation Mock

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
  useMessages: () => ({}),
  useNow: () => new Date(),
  useTimeZone: () => 'UTC',
}))
```

### Dynamic Translation Mock

```typescript
// For tests that need specific translations
const createTranslationMock = (translations: Record<string, string>) => {
  return (key: string) => translations[key] || key
}

jest.mock('next-intl', () => ({
  useTranslations: () => createTranslationMock({
    'custom.key': 'Custom Value',
    // Add test-specific translations
  }),
}))
```

---

## Auth Mocking

### useAuth Hook

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
  isAuthenticated: false,
}

jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth
}))

// Override for authenticated tests
beforeEach(() => {
  mockUseAuth.user = { id: 'user-123', email: 'test@example.com' }
  mockUseAuth.isAuthenticated = true
})
```

### Session Mock

```typescript
const mockSession = {
  user: {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: mockSession,
    status: 'authenticated',
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
}))
```

---

## Fetch Mocking

### Basic Fetch Mock

```typescript
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

beforeEach(() => {
  mockFetch.mockClear()
})

// Mock successful response
mockFetch.mockResolvedValueOnce(
  new Response(JSON.stringify({ data: 'test' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
)

// Mock error response
mockFetch.mockResolvedValueOnce(
  new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404
  })
)

// Mock network error
mockFetch.mockRejectedValueOnce(new Error('Network error'))
```

### Sequential Responses

```typescript
// First call returns loading data, second returns complete
mockFetch
  .mockResolvedValueOnce(
    new Response(JSON.stringify({ status: 'loading' }), { status: 200 })
  )
  .mockResolvedValueOnce(
    new Response(JSON.stringify({ status: 'complete', data: [] }), { status: 200 })
  )
```

---

## TanStack Query Mocking

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
)

// Use in tests
const { result } = renderHook(() => useMyQuery(), { wrapper })
```

---

## External Libraries

### UUID

```typescript
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}))
```

### Date-fns

```typescript
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  format: jest.fn((date, formatStr) => '2024-01-01'),
  formatDistance: jest.fn(() => '2 days ago'),
}))
```

### Crypto

```typescript
let uuidCounter = 0

global.crypto = {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256)
    }
    return arr
  }),
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
} as unknown as Crypto
```

---

## Browser APIs

### ResizeObserver

```typescript
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))
```

### IntersectionObserver

```typescript
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}))
```

### matchMedia

```typescript
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})
```

### localStorage/sessionStorage

```typescript
const mockStorage: Record<string, string> = {}

const storageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key]
  }),
  clear: jest.fn(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key])
  }),
}

Object.defineProperty(window, 'localStorage', { value: storageMock })
Object.defineProperty(window, 'sessionStorage', { value: storageMock })
```
