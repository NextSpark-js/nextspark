/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLastAuthMethod } from '@/core/hooks/useLastAuthMethod'

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

// Define the mock globally
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('useLastAuthMethod Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Initial State', () => {
    test('should start with isReady false and lastMethod null', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useLastAuthMethod())

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(false)
    })

    test('should return null when no stored auth method exists after delay', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useLastAuthMethod())

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(false)

      // Wait for the 150ms delay
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(true)
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('last-auth-method')
    })

    test('should return stored email method when present after delay', async () => {
      mockLocalStorage.getItem.mockReturnValue('email')

      const { result } = renderHook(() => useLastAuthMethod())

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(false)

      // Wait for the 150ms delay
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe('email')
      expect(result.current.isReady).toBe(true)
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('last-auth-method')
    })

    test('should return stored google method when present after delay', async () => {
      mockLocalStorage.getItem.mockReturnValue('google')

      const { result } = renderHook(() => useLastAuthMethod())

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(false)

      // Wait for the 150ms delay
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe('google')
      expect(result.current.isReady).toBe(true)
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('last-auth-method')
    })

    test('should ignore invalid stored values after delay', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-method')

      const { result } = renderHook(() => useLastAuthMethod())

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(false)

      // Wait for the 150ms delay
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(true)
    })
  })

  describe('saveAuthMethod Function', () => {
    test('should save email method to localStorage and update state immediately', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useLastAuthMethod())

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      act(() => {
        result.current.saveAuthMethod('email')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('last-auth-method', 'email')
      expect(result.current.lastMethod).toBe('email')
      expect(result.current.isReady).toBe(true)
    })

    test('should save google method to localStorage and update state immediately', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useLastAuthMethod())

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      act(() => {
        result.current.saveAuthMethod('google')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('last-auth-method', 'google')
      expect(result.current.lastMethod).toBe('google')
      expect(result.current.isReady).toBe(true)
    })

    test('should update from email to google method', async () => {
      mockLocalStorage.getItem.mockReturnValue('email')

      const { result } = renderHook(() => useLastAuthMethod())

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe('email')
      expect(result.current.isReady).toBe(true)

      act(() => {
        result.current.saveAuthMethod('google')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('last-auth-method', 'google')
      expect(result.current.lastMethod).toBe('google')
      expect(result.current.isReady).toBe(true)
    })

    test('should update from google to email method', async () => {
      mockLocalStorage.getItem.mockReturnValue('google')

      const { result } = renderHook(() => useLastAuthMethod())

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe('google')
      expect(result.current.isReady).toBe(true)

      act(() => {
        result.current.saveAuthMethod('email')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('last-auth-method', 'email')
      expect(result.current.lastMethod).toBe('email')
      expect(result.current.isReady).toBe(true)
    })
  })

  describe('clearAuthMethod Function', () => {
    test('should clear method from localStorage and reset state to null', async () => {
      mockLocalStorage.getItem.mockReturnValue('email')

      const { result } = renderHook(() => useLastAuthMethod())

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe('email')
      expect(result.current.isReady).toBe(true)

      act(() => {
        result.current.clearAuthMethod()
      })

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('last-auth-method')
      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(true)
    })

    test('should handle clearing when no method is stored', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useLastAuthMethod())

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(true)

      act(() => {
        result.current.clearAuthMethod()
      })

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('last-auth-method')
      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(true)
    })
  })

  describe('localStorage Integration', () => {
    test('should use correct localStorage key consistently', async () => {
      const expectedKey = 'last-auth-method'

      // Initial read
      mockLocalStorage.getItem.mockReturnValue(null)
      const { result } = renderHook(() => useLastAuthMethod())

      // Wait for the hook to complete initialization
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(expectedKey)

      // Save operation
      act(() => {
        result.current.saveAuthMethod('email')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(expectedKey, 'email')

      // Clear operation
      act(() => {
        result.current.clearAuthMethod()
      })

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(expectedKey)
    })

    test('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw error
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })

      // Should not throw error and return null
      const { result } = renderHook(() => useLastAuthMethod())

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(false)

      // Wait for the delay to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(true)
    })
  })

  describe('Timing and Delay Behavior', () => {
    test('should respect 150ms delay before setting isReady', async () => {
      mockLocalStorage.getItem.mockReturnValue('email')

      const { result } = renderHook(() => useLastAuthMethod())

      // Initially should not be ready
      expect(result.current.isReady).toBe(false)
      expect(result.current.lastMethod).toBe(null)

      // Should become ready after delay
      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.isReady).toBe(true)
      expect(result.current.lastMethod).toBe('email')
    })

    test('should clean up timer on unmount', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
      mockLocalStorage.getItem.mockReturnValue('email')

      const { unmount } = renderHook(() => useLastAuthMethod())

      unmount()

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty string in localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue('')

      const { result } = renderHook(() => useLastAuthMethod())

      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(true)
    })

    test('should handle whitespace-only string in localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue('   ')

      const { result } = renderHook(() => useLastAuthMethod())

      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(true)
    })

    test('should handle case sensitivity properly', async () => {
      mockLocalStorage.getItem.mockReturnValue('EMAIL')

      const { result } = renderHook(() => useLastAuthMethod())

      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.lastMethod).toBe(null)
      expect(result.current.isReady).toBe(true)
    })

    test('should maintain referential equality for function returns', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result, rerender } = renderHook(() => useLastAuthMethod())

      const firstSaveAuthMethod = result.current.saveAuthMethod
      const firstClearAuthMethod = result.current.clearAuthMethod

      rerender()

      expect(result.current.saveAuthMethod).toBe(firstSaveAuthMethod)
      expect(result.current.clearAuthMethod).toBe(firstClearAuthMethod)
    })
  })

  describe('Type Safety', () => {
    test('should only accept valid auth method types', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useLastAuthMethod())

      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      // These should compile and work
      act(() => {
        result.current.saveAuthMethod('email')
      })

      act(() => {
        result.current.saveAuthMethod('google')
      })

      expect(result.current.isReady).toBe(true)

      // TypeScript should prevent invalid values at compile time
      // The following would cause TypeScript errors if uncommented:
      // result.current.saveAuthMethod('facebook')
      // result.current.saveAuthMethod('invalid')
      // result.current.saveAuthMethod(123)
    })

    test('should expose isReady property in return interface', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useLastAuthMethod())

      // Check that isReady is part of the interface
      expect(typeof result.current.isReady).toBe('boolean')
      expect(result.current.isReady).toBe(false)

      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      }, { timeout: 300 })

      expect(result.current.isReady).toBe(true)
    })
  })
})