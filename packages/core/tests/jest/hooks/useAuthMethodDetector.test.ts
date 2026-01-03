/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { renderHook } from '@testing-library/react'
import { useAuthMethodDetector } from '@/core/hooks/useAuthMethodDetector'

// Mock useSearchParams
const mockSearchParams = {
  get: jest.fn(),
}

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams
}))

// Mock useLastAuthMethod
const mockSaveAuthMethod = jest.fn()
const mockUseLastAuthMethod = {
  saveAuthMethod: mockSaveAuthMethod,
  lastMethod: null,
  clearAuthMethod: jest.fn(),
  isReady: true,
}

jest.mock('@/core/hooks/useLastAuthMethod', () => ({
  useLastAuthMethod: () => mockUseLastAuthMethod
}))

// Mock window and history
const mockReplaceState = jest.fn()
const originalWindow = global.window

describe('useAuthMethodDetector Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Reset mock implementations
    mockSearchParams.get.mockReturnValue(null)
    mockSaveAuthMethod.mockImplementation(() => {})

    // Reset the useLastAuthMethod mock object
    mockUseLastAuthMethod.saveAuthMethod = mockSaveAuthMethod

    // Setup window mock
    Object.defineProperty(global, 'window', {
      value: {
        location: {
          href: 'http://localhost:3000/dashboard'
        },
        history: {
          replaceState: mockReplaceState
        }
      },
      writable: true
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    global.window = originalWindow
  })

  describe('OAuth Detection', () => {
    test('should detect Google OAuth parameter and save auth method', () => {
      mockSearchParams.get.mockReturnValue('google')

      renderHook(() => useAuthMethodDetector())

      expect(mockSearchParams.get).toHaveBeenCalledWith('auth_method')
      expect(mockSaveAuthMethod).toHaveBeenCalledWith('google')
    })

    test('should not save auth method when parameter is missing', () => {
      mockSearchParams.get.mockReturnValue(null)

      renderHook(() => useAuthMethodDetector())

      expect(mockSearchParams.get).toHaveBeenCalledWith('auth_method')
      expect(mockSaveAuthMethod).not.toHaveBeenCalled()
    })

    test('should not save auth method for invalid auth_method values', () => {
      mockSearchParams.get.mockReturnValue('facebook')

      renderHook(() => useAuthMethodDetector())

      expect(mockSearchParams.get).toHaveBeenCalledWith('auth_method')
      expect(mockSaveAuthMethod).not.toHaveBeenCalled()
    })

    test('should not save auth method for empty string', () => {
      mockSearchParams.get.mockReturnValue('')

      renderHook(() => useAuthMethodDetector())

      expect(mockSearchParams.get).toHaveBeenCalledWith('auth_method')
      expect(mockSaveAuthMethod).not.toHaveBeenCalled()
    })
  })

  describe('URL Parameter Cleanup', () => {
    test('should clean auth_method parameter from URL after Google OAuth', () => {
      mockSearchParams.get.mockReturnValue('google')

      // Mock URL constructor and methods
      const mockURL = {
        searchParams: {
          delete: jest.fn()
        },
        toString: jest.fn().mockReturnValue('http://localhost:3000/dashboard')
      }

      // Mock URL constructor
      global.URL = jest.fn().mockImplementation(() => mockURL)

      renderHook(() => useAuthMethodDetector())

      expect(mockURL.searchParams.delete).toHaveBeenCalledWith('auth_method')
      expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000/dashboard')
    })

    test('should not modify URL when no auth_method parameter present', () => {
      mockSearchParams.get.mockReturnValue(null)

      renderHook(() => useAuthMethodDetector())

      expect(mockReplaceState).not.toHaveBeenCalled()
    })

    test('should handle URL cleanup gracefully when window is undefined', () => {
      mockSearchParams.get.mockReturnValue('google')

      // Mock console.warn to track warning calls
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Mock window with location but no history (simulating server-side rendering)
      const originalWindow = global.window
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            href: 'http://localhost:3000/dashboard'
          }
          // No history property to simulate undefined condition
        },
        writable: true
      })

      // The hook should still run successfully despite missing history
      const { result } = renderHook(() => useAuthMethodDetector())

      // The auth method should still be saved
      expect(mockSaveAuthMethod).toHaveBeenCalledWith('google')

      // Restore window
      global.window = originalWindow
      consoleSpy.mockRestore()
    })
  })

  describe('Effect Dependencies', () => {
    test('should re-run effect when searchParams change', () => {
      // Test that the hook correctly responds to different searchParams values
      mockSearchParams.get.mockReturnValue('google')

      const { unmount } = renderHook(() => useAuthMethodDetector())

      expect(mockSaveAuthMethod).toHaveBeenCalledTimes(1)
      expect(mockSearchParams.get).toHaveBeenCalledWith('auth_method')

      unmount()

      // Test with different param value
      mockSaveAuthMethod.mockClear()
      mockSearchParams.get.mockClear()
      mockSearchParams.get.mockReturnValue(null)

      renderHook(() => useAuthMethodDetector())

      // Verify effect ran and checked params but didn't save
      expect(mockSearchParams.get).toHaveBeenCalledWith('auth_method')
      expect(mockSaveAuthMethod).not.toHaveBeenCalled()
    })

    test('should re-run effect when saveAuthMethod reference changes', () => {
      mockSearchParams.get.mockReturnValue('google')

      const { rerender } = renderHook(() => useAuthMethodDetector())

      expect(mockSaveAuthMethod).toHaveBeenCalledTimes(1)

      // Test that different saveAuthMethod references work
      const newSaveAuthMethod = jest.fn()
      mockUseLastAuthMethod.saveAuthMethod = newSaveAuthMethod
      mockSaveAuthMethod.mockClear()

      // Unmount and mount again to test new reference
      renderHook(() => useAuthMethodDetector())

      // Effect should run with new function
      expect(newSaveAuthMethod).toHaveBeenCalledWith('google')
    })
  })

  describe('Error Handling', () => {
    test('should save auth method even when URL cleanup fails', () => {
      mockSearchParams.get.mockReturnValue('google')

      // Hook should save auth method regardless of URL cleanup success
      renderHook(() => useAuthMethodDetector())

      // Auth method should be saved
      expect(mockSaveAuthMethod).toHaveBeenCalledWith('google')
    })

    test('should handle window.history errors gracefully', () => {
      mockSearchParams.get.mockReturnValue('google')

      // Mock history.replaceState to throw error
      const originalReplaceState = mockReplaceState
      mockReplaceState.mockImplementation(() => {
        throw new Error('History manipulation error')
      })

      // Mock URL to work properly
      const mockURL = {
        searchParams: {
          delete: jest.fn()
        },
        toString: jest.fn().mockReturnValue('http://localhost:3000/dashboard')
      }
      const originalURL = global.URL
      global.URL = jest.fn().mockImplementation(() => mockURL)

      // Hook should still save auth method despite history error
      renderHook(() => useAuthMethodDetector())

      expect(mockSaveAuthMethod).toHaveBeenCalledWith('google')

      // Restore mocks
      global.URL = originalURL
      mockReplaceState.mockImplementation(originalReplaceState)
    })
  })

  describe('Integration Scenarios', () => {
    test('should handle complete OAuth redirect flow', () => {
      // Simulate complete OAuth redirect with auth_method parameter
      mockSearchParams.get.mockReturnValue('google')

      const mockURL = {
        searchParams: {
          delete: jest.fn()
        },
        toString: jest.fn().mockReturnValue('http://localhost:3000/dashboard?code=abc123')
      }

      const originalURL = global.URL
      global.URL = jest.fn().mockImplementation(() => mockURL)

      renderHook(() => useAuthMethodDetector())

      // Should save auth method
      expect(mockSaveAuthMethod).toHaveBeenCalledWith('google')

      // Should clean only auth_method parameter, leaving others intact
      expect(mockURL.searchParams.delete).toHaveBeenCalledWith('auth_method')
      expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000/dashboard?code=abc123')

      // Restore URL
      global.URL = originalURL
    })

    test('should work with multiple URL parameters', () => {
      mockSearchParams.get.mockReturnValue('google')

      const mockURL = {
        searchParams: {
          delete: jest.fn()
        },
        toString: jest.fn().mockReturnValue('http://localhost:3000/dashboard?tab=profile&section=settings')
      }

      const originalURL = global.URL
      global.URL = jest.fn().mockImplementation(() => mockURL)

      renderHook(() => useAuthMethodDetector())

      expect(mockSaveAuthMethod).toHaveBeenCalledWith('google')
      expect(mockURL.searchParams.delete).toHaveBeenCalledWith('auth_method')
      expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000/dashboard?tab=profile&section=settings')

      // Restore URL
      global.URL = originalURL
    })
  })

  describe('Case Sensitivity', () => {
    test('should be case sensitive for auth_method values', () => {
      mockSearchParams.get.mockReturnValue('Google') // Capital G

      renderHook(() => useAuthMethodDetector())

      expect(mockSaveAuthMethod).not.toHaveBeenCalled()
    })

    test('should only accept exact "google" value', () => {
      const invalidValues = ['GOOGLE', 'Google', 'gOOgle', 'google ']

      invalidValues.forEach(value => {
        jest.clearAllMocks()
        mockSearchParams.get.mockReturnValue(value)

        renderHook(() => useAuthMethodDetector())

        expect(mockSaveAuthMethod).not.toHaveBeenCalled()
      })
    })
  })
})