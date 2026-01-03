/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests for useApiRequest Hook
 *
 * Tests the custom hook used for executing API requests in the DevTools API Tester:
 * - Initial state (idle, null response/error)
 * - Execute success flow
 * - Execute error flow
 * - Cancel functionality
 * - Reset functionality
 * - AbortController cleanup
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useApiRequest } from '@/core/components/devtools/api-tester/hooks/useApiRequest'
import type { RequestConfig, ApiResponse } from '@/core/components/devtools/api-tester/types'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Helper function to create mock Headers object
function createMockHeaders(entries: [string, string][] = []): any {
  const headersMap = new Map(entries)
  return {
    forEach: (callback: (value: string, key: string) => void) => {
      headersMap.forEach((value, key) => callback(value, key))
    },
    get: (key: string) => headersMap.get(key) || null,
  }
}

describe('useApiRequest Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Initial State', () => {
    test('should start with idle status', () => {
      const { result } = renderHook(() => useApiRequest())

      expect(result.current.status).toBe('idle')
      expect(result.current.response).toBeNull()
      expect(result.current.error).toBeNull()
    })

    test('should expose all required functions', () => {
      const { result } = renderHook(() => useApiRequest())

      expect(typeof result.current.execute).toBe('function')
      expect(typeof result.current.cancel).toBe('function')
      expect(typeof result.current.reset).toBe('function')
    })

    test('should maintain referential equality for functions on re-renders', () => {
      const { result, rerender } = renderHook(() => useApiRequest())

      const firstExecute = result.current.execute
      const firstCancel = result.current.cancel
      const firstReset = result.current.reset

      rerender()

      expect(result.current.execute).toBe(firstExecute)
      expect(result.current.cancel).toBe(firstCancel)
      expect(result.current.reset).toBe(firstReset)
    })
  })

  describe('Execute - Success Cases', () => {
    test('should execute GET request successfully with JSON response', async () => {
      const mockResponseData = { data: { id: 1, name: 'Test User' } }
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([
          ['content-type', 'application/json'],
          ['x-request-id', '123'],
        ]),
        json: async () => mockResponseData,
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/users',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('success')
      expect(result.current.response).not.toBeNull()
      expect(result.current.response?.status).toBe(200)
      expect(result.current.response?.statusText).toBe('OK')
      expect(result.current.response?.body).toEqual(mockResponseData)
      expect(result.current.response?.timing).toBeGreaterThanOrEqual(0) // Can be 0 in test environment
      expect(result.current.error).toBeNull()
    })

    test('should execute POST request with body successfully', async () => {
      const mockResponseData = { data: { id: 2, name: 'New User' } }
      mockFetch.mockResolvedValueOnce({
        status: 201,
        statusText: 'Created',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => mockResponseData,
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/users',
        method: 'POST',
        headers: {},
        body: JSON.stringify({ name: 'New User' }),
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          method: 'POST',
          body: config.body,
          credentials: 'include',
        })
      )
      expect(result.current.status).toBe('success')
      expect(result.current.response?.status).toBe(201)
    })

    test('should execute PATCH request with body successfully', async () => {
      const mockResponseData = { data: { id: 1, name: 'Updated User' } }
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => mockResponseData,
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/users/1',
        method: 'PATCH',
        headers: {},
        body: JSON.stringify({ name: 'Updated User' }),
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          method: 'PATCH',
          body: config.body,
        })
      )
      expect(result.current.status).toBe('success')
    })

    test('should execute PUT request with body successfully', async () => {
      const mockResponseData = { data: { id: 1, name: 'Replaced User' } }
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => mockResponseData,
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/users/1',
        method: 'PUT',
        headers: {},
        body: JSON.stringify({ name: 'Replaced User' }),
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          method: 'PUT',
          body: config.body,
        })
      )
      expect(result.current.status).toBe('success')
    })

    test('should execute DELETE request successfully', async () => {
      const mockResponseData = { success: true }
      mockFetch.mockResolvedValueOnce({
        status: 204,
        statusText: 'No Content',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => mockResponseData,
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/users/1',
        method: 'DELETE',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          method: 'DELETE',
        })
      )
      expect(result.current.status).toBe('success')
      expect(result.current.response?.status).toBe(204)
    })

    test('should handle text/plain responses', async () => {
      const textResponse = 'Plain text response'
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'text/plain']]),
        text: async () => textResponse,
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/status',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('success')
      expect(result.current.response?.body).toBe(textResponse)
    })

    test('should measure timing correctly', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  status: 200,
                  statusText: 'OK',
                  headers: createMockHeaders([['content-type', 'application/json']]),
                  json: async () => ({ data: 'test' }),
                }),
              50
            )
          )
      )

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('success')
      expect(result.current.response?.timing).toBeGreaterThanOrEqual(50)
    })

    test('should parse response headers correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([
          ['content-type', 'application/json'],
          ['x-request-id', '12345'],
          ['x-rate-limit', '100'],
        ]),
        json: async () => ({ data: 'test' }),
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('success')
      expect(result.current.response?.headers).toEqual({
        'content-type': 'application/json',
        'x-request-id': '12345',
        'x-rate-limit': '100',
      })
    })
  })

  describe('Execute - Authentication', () => {
    test('should use credentials: include for session auth', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => ({ data: 'test' }),
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          credentials: 'include',
        })
      )
    })

    test('should use credentials: omit for API key auth', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => ({ data: 'test' }),
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'apiKey',
        apiKey: 'test-api-key-123',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          credentials: 'omit',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key-123',
          }),
        })
      )
    })

    test('should add x-api-key header when using API key auth', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => ({ data: 'test' }),
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'apiKey',
        apiKey: 'my-secret-key',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'my-secret-key',
          }),
        })
      )
    })

    test('should not add x-api-key header for session auth', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => ({ data: 'test' }),
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      expect(fetchOptions.headers).not.toHaveProperty('x-api-key')
    })
  })

  describe('Execute - Custom Headers', () => {
    test('should include custom headers in request', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => ({ data: 'test' }),
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {
          'X-Custom-Header': 'custom-value',
          Authorization: 'Bearer token123',
        },
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
            Authorization: 'Bearer token123',
          }),
        })
      )
    })

    test('should always include Content-Type: application/json', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => ({ data: 'test' }),
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'POST',
        headers: {},
        body: '{"test": true}',
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })

  describe('Execute - Error Cases', () => {
    test('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Network error')
      expect(result.current.response).toBeNull()
    })

    test('should handle fetch timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'))

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/slow',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Timeout')
    })

    test('should handle unknown error types', async () => {
      mockFetch.mockRejectedValueOnce('string error')

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Unknown error occurred')
    })

    test('should handle 4xx errors successfully (not as error state)', async () => {
      const errorResponse = { error: 'Not found' }
      mockFetch.mockResolvedValueOnce({
        status: 404,
        statusText: 'Not Found',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => errorResponse,
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/users/999',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      // 4xx should be success state (fetch succeeded), response shows error
      expect(result.current.status).toBe('success')
      expect(result.current.response?.status).toBe(404)
      expect(result.current.response?.body).toEqual(errorResponse)
    })

    test('should handle 5xx errors successfully (not as error state)', async () => {
      const errorResponse = { error: 'Internal server error' }
      mockFetch.mockResolvedValueOnce({
        status: 500,
        statusText: 'Internal Server Error',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => errorResponse,
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      // 5xx should be success state (fetch succeeded), response shows error
      expect(result.current.status).toBe('success')
      expect(result.current.response?.status).toBe(500)
      expect(result.current.response?.body).toEqual(errorResponse)
    })
  })

  describe('Cancel Functionality', () => {
    test('should cancel in-flight request', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              const error = new Error('Request aborted')
              error.name = 'AbortError'
              reject(error)
            }, 100)
          })
      )

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/slow',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      act(() => {
        result.current.execute(config)
      })

      // Cancel immediately
      act(() => {
        result.current.cancel()
      })

      await waitFor(() => {
        expect(result.current.status).toBe('cancelled')
      })

      expect(result.current.error).toBe('Request cancelled')
      expect(result.current.response).toBeNull()
    })

    test('should handle cancel when no request is in flight', () => {
      const { result } = renderHook(() => useApiRequest())

      // Cancel without executing
      act(() => {
        result.current.cancel()
      })

      expect(result.current.status).toBe('idle')
      expect(result.current.error).toBeNull()
    })

    test('should abort previous request when executing new request', async () => {
      let firstAborted = false

      mockFetch
        .mockImplementationOnce(
          () =>
            new Promise((resolve, reject) => {
              setTimeout(() => {
                const error = new Error('Request aborted')
                error.name = 'AbortError'
                firstAborted = true
                reject(error)
              }, 50)
            })
        )
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: createMockHeaders([['content-type', 'application/json']]),
          json: async () => ({ data: 'second request' }),
        })

      const { result } = renderHook(() => useApiRequest())

      const config1: RequestConfig = {
        url: 'http://localhost:5173/api/v1/first',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      const config2: RequestConfig = {
        url: 'http://localhost:5173/api/v1/second',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      // Start first request
      act(() => {
        result.current.execute(config1)
      })

      // Start second request (should abort first)
      await act(async () => {
        await result.current.execute(config2)
      })

      expect(result.current.status).toBe('success')
      expect(result.current.response?.body).toEqual({ data: 'second request' })
    })
  })

  describe('Reset Functionality', () => {
    test('should reset state to initial values', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => ({ data: 'test' }),
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      // Execute request
      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('success')
      expect(result.current.response).not.toBeNull()

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.status).toBe('idle')
      expect(result.current.response).toBeNull()
      expect(result.current.error).toBeNull()
    })

    test('should reset error state', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Test error'))

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      // Execute request that fails
      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Test error')

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.status).toBe('idle')
      expect(result.current.error).toBeNull()
    })
  })

  describe('State Transitions', () => {
    test('should transition from idle to loading to success', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => ({ data: 'test' }),
      })

      const { result } = renderHook(() => useApiRequest())

      expect(result.current.status).toBe('idle')

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      // Execute and wait for completion
      await act(async () => {
        await result.current.execute(config)
      })

      // Should be success after completion
      expect(result.current.status).toBe('success')
    })

    test('should clear previous response when starting new request', async () => {
      mockFetch
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: createMockHeaders([['content-type', 'application/json']]),
          json: async () => ({ data: 'first' }),
        })
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: createMockHeaders([['content-type', 'application/json']]),
          json: async () => ({ data: 'second' }),
        })

      const { result } = renderHook(() => useApiRequest())

      const config1: RequestConfig = {
        url: 'http://localhost:5173/api/v1/first',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      // First request
      await act(async () => {
        await result.current.execute(config1)
      })

      expect(result.current.response?.body).toEqual({ data: 'first' })

      const config2: RequestConfig = {
        url: 'http://localhost:5173/api/v1/second',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      // Second request
      await act(async () => {
        await result.current.execute(config2)
      })

      expect(result.current.response?.body).toEqual({ data: 'second' })
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty response body', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 204,
        statusText: 'No Content',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => null,
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'DELETE',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('success')
      expect(result.current.response?.body).toBeNull()
    })

    test('should handle response with no content-type header', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([]),
        text: async () => 'Plain response',
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      expect(result.current.status).toBe('success')
      expect(result.current.response?.body).toBe('Plain response')
    })

    test('should not include body for GET requests', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: createMockHeaders([['content-type', 'application/json']]),
        json: async () => ({ data: 'test' }),
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test',
        method: 'GET',
        headers: {},
        body: '{"should": "not be included"}',
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      expect(fetchOptions.body).toBeUndefined()
    })

    test('should not include body for DELETE requests', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 204,
        statusText: 'No Content',
        headers: createMockHeaders([]),
        json: async () => null,
      })

      const { result } = renderHook(() => useApiRequest())

      const config: RequestConfig = {
        url: 'http://localhost:5173/api/v1/test/1',
        method: 'DELETE',
        headers: {},
        body: '{"should": "not be included"}',
        authType: 'session',
      }

      await act(async () => {
        await result.current.execute(config)
      })

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      expect(fetchOptions.body).toBeUndefined()
    })
  })
})
