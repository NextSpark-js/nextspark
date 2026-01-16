# Service & Hook Testing Reference

Testing patterns for React hooks and service classes.

## React Hook Testing

### Basic Hook Test with renderHook

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

---

### Testing Hooks with State

```typescript
import { renderHook, act } from '@testing-library/react'
import { useCounter } from '@/core/hooks/useCounter'

describe('useCounter', () => {
  test('should initialize with default value', () => {
    const { result } = renderHook(() => useCounter())

    expect(result.current.count).toBe(0)
  })

  test('should initialize with custom value', () => {
    const { result } = renderHook(() => useCounter(10))

    expect(result.current.count).toBe(10)
  })

  test('should increment count', () => {
    const { result } = renderHook(() => useCounter())

    act(() => {
      result.current.increment()
    })

    expect(result.current.count).toBe(1)
  })

  test('should decrement count', () => {
    const { result } = renderHook(() => useCounter(5))

    act(() => {
      result.current.decrement()
    })

    expect(result.current.count).toBe(4)
  })

  test('should reset to initial value', () => {
    const { result } = renderHook(() => useCounter(10))

    act(() => {
      result.current.increment()
      result.current.increment()
      result.current.reset()
    })

    expect(result.current.count).toBe(10)
  })
})
```

---

### Testing Async Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useUserData } from '@/core/hooks/useUserData'

describe('useUserData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should fetch user data successfully', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: '123', name: 'John' }), { status: 200 })
    )

    const { result } = renderHook(() => useUserData('123'))

    // Initially loading
    expect(result.current.isLoading).toBe(true)

    // Wait for data
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual({ id: '123', name: 'John' })
    expect(result.current.error).toBeNull()
  })

  test('should handle fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useUserData('123'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('Network error')
  })
})
```

---

### Testing Hooks with Providers

```typescript
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEntityQuery } from '@/core/hooks/useEntityQuery'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useEntityQuery', () => {
  test('should fetch entity data', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    )

    const { result } = renderHook(
      () => useEntityQuery('products'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({ data: [] })
  })
})
```

---

## Service Testing

### BaseEntityService Pattern

```typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

// Mock database
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import { TestEntityService } from '@/core/services/test-entity.service'

const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>

// Test fixtures
const mockEntityRow = {
  id: 'entity-123',
  title: 'Test Entity',
  status: 'active',
  userId: 'user-456',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

describe('TestEntityService', () => {
  let service: TestEntityService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new TestEntityService()
  })

  describe('getById', () => {
    test('returns entity when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockEntityRow)

      const result = await service.getById('entity-123', 'user-456')

      expect(result).toEqual(mockEntityRow)
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
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })

    test('respects pagination parameters', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '50' }])
        .mockResolvedValueOnce([mockEntityRow])

      const result = await service.list('user-456', { page: 2, limit: 10 })

      expect(result.page).toBe(2)
      expect(result.limit).toBe(10)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET 10'),
        expect.any(Array),
        'user-456'
      )
    })
  })

  describe('create', () => {
    test('creates entity and returns it', async () => {
      const newEntity = { title: 'New Entity', status: 'draft' }
      mockMutateWithRLS.mockResolvedValue({ ...mockEntityRow, ...newEntity })

      const result = await service.create(newEntity, 'user-456')

      expect(result.title).toBe('New Entity')
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining(['New Entity']),
        'user-456'
      )
    })

    test('throws error for invalid data', async () => {
      await expect(service.create({}, 'user-456'))
        .rejects.toThrow('Title is required')
    })
  })

  describe('update', () => {
    test('updates entity successfully', async () => {
      const updates = { title: 'Updated Title' }
      mockMutateWithRLS.mockResolvedValue({ ...mockEntityRow, ...updates })

      const result = await service.update('entity-123', updates, 'user-456')

      expect(result.title).toBe('Updated Title')
    })

    test('returns null when entity not found', async () => {
      mockMutateWithRLS.mockResolvedValue(null)

      const result = await service.update('non-existent', { title: 'X' }, 'user-456')

      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    test('deletes entity and returns true', async () => {
      mockMutateWithRLS.mockResolvedValue({ id: 'entity-123' })

      const result = await service.delete('entity-123', 'user-456')

      expect(result).toBe(true)
    })

    test('returns false when entity not found', async () => {
      mockMutateWithRLS.mockResolvedValue(null)

      const result = await service.delete('non-existent', 'user-456')

      expect(result).toBe(false)
    })
  })
})
```

---

## Utility Function Testing

```typescript
import { describe, test, expect } from '@jest/globals'
import { formatCurrency, parseAmount, validateEmail } from '@/core/lib/utils'

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    test('formats USD correctly', () => {
      expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56')
    })

    test('formats EUR correctly', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56')
    })

    test('handles zero', () => {
      expect(formatCurrency(0, 'USD')).toBe('$0.00')
    })

    test('handles negative values', () => {
      expect(formatCurrency(-50, 'USD')).toBe('-$50.00')
    })
  })

  describe('parseAmount', () => {
    test('parses integer string', () => {
      expect(parseAmount('100')).toBe(100)
    })

    test('parses decimal string', () => {
      expect(parseAmount('99.99')).toBe(99.99)
    })

    test('returns 0 for invalid input', () => {
      expect(parseAmount('invalid')).toBe(0)
      expect(parseAmount('')).toBe(0)
      expect(parseAmount(null as any)).toBe(0)
    })
  })

  describe('validateEmail', () => {
    test('accepts valid emails', () => {
      expect(validateEmail('user@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co.uk')).toBe(true)
    })

    test('rejects invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
    })
  })
})
```

---

## Testing Error Handling

```typescript
describe('Error Handling', () => {
  test('throws specific error type', async () => {
    mockQueryWithRLS.mockRejectedValue(new DatabaseError('Connection failed'))

    await expect(service.list('user-123'))
      .rejects.toThrow(DatabaseError)

    await expect(service.list('user-123'))
      .rejects.toThrow('Connection failed')
  })

  test('handles and transforms errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await service.fetchWithFallback()

    expect(result).toEqual({ data: null, error: 'Network error' })
  })

  test('logs errors appropriately', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    mockQueryWithRLS.mockRejectedValue(new Error('DB Error'))

    try {
      await service.criticalOperation()
    } catch {
      // Expected
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Service]'),
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })
})
```
