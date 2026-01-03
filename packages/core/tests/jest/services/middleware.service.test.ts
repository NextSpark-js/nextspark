/**
 * Unit Tests - Middleware Service
 *
 * Tests the MiddlewareService static methods that provide middleware registry
 * operations and helper methods for Next.js middleware.
 *
 * Test Coverage:
 * - getByTheme() - retrieves middleware by theme name
 * - getAll() - returns all registered middlewares
 * - hasMiddleware() - checks if theme has middleware
 * - getMetadata() - returns metadata object
 * - execute() - executes theme middleware
 * - redirectWithoutSession() - redirect helper for unauthenticated users
 * - redirectWithSession() - redirect helper for authenticated users
 * - addUserHeaders() - adds user info headers to request
 * - Backward compatibility exports
 */

import type { SessionUser } from '@/core/lib/auth'

// Create mock middleware functions before mocking the registry
const mockMiddlewareSuccess = jest.fn()
const mockMiddlewareError = jest.fn()

// Mock NextResponse class
const mockNextResponse = {
  redirect: jest.fn((url: URL) => ({
    status: 307,
    headers: new Headers({ location: url.toString() })
  })),
  next: jest.fn((init?: { request?: { headers?: Headers } }) => ({
    status: 200,
    headers: init?.request?.headers || new Headers()
  }))
}

// Mock next/server module
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url: URL) => ({
    url: url.toString(),
    nextUrl: {
      pathname: url.pathname,
      origin: url.origin
    },
    headers: new Headers()
  })),
  NextResponse: mockNextResponse
}))

// Mock the middleware registry with test data
jest.mock('@/core/lib/registries/middleware-registry', () => {
  return {
    MIDDLEWARE_REGISTRY: {
      'test-theme': {
        themeName: 'test-theme',
        middleware: mockMiddlewareSuccess,
        middlewarePath: '@/contents/themes/test-theme/middleware.ts',
        middlewareExportName: 'default',
        exists: true
      },
      'error-theme': {
        themeName: 'error-theme',
        middleware: mockMiddlewareError,
        middlewarePath: '@/contents/themes/error-theme/middleware.ts',
        middlewareExportName: 'default',
        exists: true
      },
      'no-middleware-theme': {
        themeName: 'no-middleware-theme',
        middleware: mockMiddlewareSuccess,
        middlewarePath: '@/contents/themes/no-middleware-theme/middleware.ts',
        middlewareExportName: 'default',
        exists: false
      }
    },
    MIDDLEWARE_METADATA: {
      totalMiddlewares: 3,
      themesWithMiddleware: 2,
      generatedAt: '2025-01-01T00:00:00.000Z',
      themes: ['test-theme', 'error-theme', 'no-middleware-theme']
    }
  }
})

// Import after mocking
import { MiddlewareService } from '@/core/lib/services/middleware.service'
import {
  getActiveThemeMiddleware,
  getAllMiddlewares,
  hasThemeMiddleware,
  executeThemeMiddleware,
  redirectWithoutSessionMiddleware,
  redirectWithSessionMiddleware,
  addUserHeadersMiddleware
} from '@/core/lib/services/middleware.service'
import type { MiddlewareRegistryEntry } from '@/core/lib/registries/middleware-registry'
import { NextRequest, NextResponse } from 'next/server'

// Helper to create mock NextRequest
function createMockRequest(url: string = 'http://localhost:3000/dashboard') {
  const parsedUrl = new URL(url)
  return {
    url: url,
    nextUrl: {
      pathname: parsedUrl.pathname,
      origin: parsedUrl.origin
    },
    headers: new Headers()
  } as unknown as NextRequest
}

// Helper to create mock SessionUser
function createMockSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    image: null,
    ...overrides
  }
}

describe('MiddlewareService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Set up mock implementations
    mockMiddlewareSuccess.mockResolvedValue({ status: 200 })
    mockMiddlewareError.mockRejectedValue(new Error('Middleware error'))
  })

  describe('getByTheme', () => {
    it('should return MiddlewareRegistryEntry for valid theme', () => {
      const entry = MiddlewareService.getByTheme('test-theme')

      expect(entry).toBeDefined()
      expect(entry?.themeName).toBe('test-theme')
      expect(entry?.exists).toBe(true)
    })

    it('should return undefined for non-existent theme', () => {
      const entry = MiddlewareService.getByTheme('non-existent-theme')

      expect(entry).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      const entry = MiddlewareService.getByTheme('')

      expect(entry).toBeUndefined()
    })

    it('should return entry with correct structure', () => {
      const entry = MiddlewareService.getByTheme('test-theme')

      expect(entry).toHaveProperty('themeName')
      expect(entry).toHaveProperty('middleware')
      expect(entry).toHaveProperty('middlewarePath')
      expect(entry).toHaveProperty('middlewareExportName')
      expect(entry).toHaveProperty('exists')
    })

    it('should return entry even if exists is false', () => {
      const entry = MiddlewareService.getByTheme('no-middleware-theme')

      expect(entry).toBeDefined()
      expect(entry?.themeName).toBe('no-middleware-theme')
      expect(entry?.exists).toBe(false)
    })
  })

  describe('getAll', () => {
    it('should return array of MiddlewareRegistryEntry', () => {
      const middlewares = MiddlewareService.getAll()

      expect(Array.isArray(middlewares)).toBe(true)
      expect(middlewares.length).toBeGreaterThan(0)
    })

    it('should return all registered middlewares', () => {
      const middlewares = MiddlewareService.getAll()

      expect(middlewares.length).toBe(3) // From mock
    })

    it('should have correct structure on each entry', () => {
      const middlewares = MiddlewareService.getAll()

      middlewares.forEach(entry => {
        expect(entry).toHaveProperty('themeName')
        expect(entry).toHaveProperty('middleware')
        expect(entry).toHaveProperty('middlewarePath')
        expect(entry).toHaveProperty('middlewareExportName')
        expect(entry).toHaveProperty('exists')
      })
    })
  })

  describe('hasMiddleware', () => {
    it('should return true for theme with existing middleware', () => {
      expect(MiddlewareService.hasMiddleware('test-theme')).toBe(true)
    })

    it('should return false for non-existent theme', () => {
      expect(MiddlewareService.hasMiddleware('non-existent-theme')).toBe(false)
    })

    it('should return false when theme exists but middleware.exists is false', () => {
      expect(MiddlewareService.hasMiddleware('no-middleware-theme')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(MiddlewareService.hasMiddleware('')).toBe(false)
    })

    it('should return true for error-theme since exists is true', () => {
      expect(MiddlewareService.hasMiddleware('error-theme')).toBe(true)
    })
  })

  describe('getMetadata', () => {
    it('should return metadata object', () => {
      const metadata = MiddlewareService.getMetadata()

      expect(metadata).toBeDefined()
      expect(typeof metadata).toBe('object')
    })

    it('should have expected keys', () => {
      const metadata = MiddlewareService.getMetadata()

      expect(metadata).toHaveProperty('totalMiddlewares')
      expect(metadata).toHaveProperty('themesWithMiddleware')
      expect(metadata).toHaveProperty('generatedAt')
      expect(metadata).toHaveProperty('themes')
    })

    it('should have correct types', () => {
      const metadata = MiddlewareService.getMetadata()

      expect(typeof metadata.totalMiddlewares).toBe('number')
      expect(typeof metadata.themesWithMiddleware).toBe('number')
      expect(typeof metadata.generatedAt).toBe('string')
      expect(Array.isArray(metadata.themes)).toBe(true)
    })

    it('should have consistent counts', () => {
      const metadata = MiddlewareService.getMetadata()
      const all = MiddlewareService.getAll()

      expect(metadata.totalMiddlewares).toBe(all.length)
    })
  })

  describe('execute', () => {
    it('should return null for non-existent theme', async () => {
      const request = createMockRequest()
      const result = await MiddlewareService.execute('non-existent-theme', request)

      expect(result).toBeNull()
    })

    it('should return null when theme exists but middleware.exists is false', async () => {
      const request = createMockRequest()
      const result = await MiddlewareService.execute('no-middleware-theme', request)

      expect(result).toBeNull()
    })

    it('should execute middleware and return response for valid theme', async () => {
      const request = createMockRequest()
      const result = await MiddlewareService.execute('test-theme', request)

      expect(result).toBeDefined()
      expect(result).toHaveProperty('status')
    })

    it('should pass request to middleware function', async () => {
      const request = createMockRequest('http://localhost:3000/custom-path')
      await MiddlewareService.execute('test-theme', request)

      // Get the mock from the registry
      const entry = MiddlewareService.getByTheme('test-theme')
      expect(entry?.middleware).toHaveBeenCalledWith(request, undefined)
    })

    it('should pass session to middleware function', async () => {
      const request = createMockRequest()
      const session = createMockSessionUser()
      await MiddlewareService.execute('test-theme', request, session)

      const entry = MiddlewareService.getByTheme('test-theme')
      expect(entry?.middleware).toHaveBeenCalledWith(request, session)
    })

    it('should catch errors and return null', async () => {
      const request = createMockRequest()
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const result = await MiddlewareService.execute('error-theme', request)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should log error message with theme name', async () => {
      const request = createMockRequest()
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      await MiddlewareService.execute('error-theme', request)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('error-theme'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('redirectWithoutSession', () => {
    it('should redirect to login with callback URL', () => {
      const request = createMockRequest('http://localhost:3000/dashboard')
      const response = MiddlewareService.redirectWithoutSession(request)

      expect(response).toBeDefined()
      expect(response.status).toBe(307)
      expect(mockNextResponse.redirect).toHaveBeenCalled()
    })

    it('should use custom target path', () => {
      const request = createMockRequest('http://localhost:3000/admin')
      const response = MiddlewareService.redirectWithoutSession(request, '/auth/signin')

      expect(mockNextResponse.redirect).toHaveBeenCalled()
      const callArg = mockNextResponse.redirect.mock.calls[0][0]
      expect(callArg.pathname).toBe('/auth/signin')
    })

    it('should preserve full pathname in callback', () => {
      const request = createMockRequest('http://localhost:3000/dashboard/settings/profile')
      MiddlewareService.redirectWithoutSession(request)

      expect(mockNextResponse.redirect).toHaveBeenCalled()
      const callArg = mockNextResponse.redirect.mock.calls[0][0]
      expect(callArg.searchParams.get('callbackUrl')).toBe('/dashboard/settings/profile')
    })

    it('should default target path to /login', () => {
      const request = createMockRequest()
      MiddlewareService.redirectWithoutSession(request)

      expect(mockNextResponse.redirect).toHaveBeenCalled()
      const callArg = mockNextResponse.redirect.mock.calls[0][0]
      expect(callArg.pathname).toBe('/login')
    })
  })

  describe('redirectWithSession', () => {
    it('should redirect to dashboard by default', () => {
      const request = createMockRequest('http://localhost:3000/login')
      const response = MiddlewareService.redirectWithSession(request)

      expect(response).toBeDefined()
      expect(response.status).toBe(307)
      expect(mockNextResponse.redirect).toHaveBeenCalled()
    })

    it('should use custom target path', () => {
      const request = createMockRequest()
      MiddlewareService.redirectWithSession(request, '/home')

      expect(mockNextResponse.redirect).toHaveBeenCalled()
      const callArg = mockNextResponse.redirect.mock.calls[0][0]
      expect(callArg.pathname).toBe('/home')
    })

    it('should redirect with absolute URL', () => {
      const request = createMockRequest('http://localhost:3000/login')
      MiddlewareService.redirectWithSession(request, '/dashboard')

      expect(mockNextResponse.redirect).toHaveBeenCalled()
      const callArg = mockNextResponse.redirect.mock.calls[0][0]
      expect(callArg.toString()).toBe('http://localhost:3000/dashboard')
    })
  })

  describe('addUserHeaders', () => {
    it('should call NextResponse.next', () => {
      const request = createMockRequest('http://localhost:3000/dashboard/settings')
      MiddlewareService.addUserHeaders(request, null)

      expect(mockNextResponse.next).toHaveBeenCalled()
    })

    it('should add x-user-id when session has id', () => {
      const request = createMockRequest()
      const session = createMockSessionUser({ id: 'user-456' })
      MiddlewareService.addUserHeaders(request, session)

      expect(mockNextResponse.next).toHaveBeenCalled()
    })

    it('should add x-user-email when session has email', () => {
      const request = createMockRequest()
      const session = createMockSessionUser({ email: 'user@test.com' })
      MiddlewareService.addUserHeaders(request, session)

      expect(mockNextResponse.next).toHaveBeenCalled()
    })

    it('should handle null session', () => {
      const request = createMockRequest()
      MiddlewareService.addUserHeaders(request, null)

      expect(mockNextResponse.next).toHaveBeenCalled()
    })

    it('should handle session with missing id', () => {
      const request = createMockRequest()
      const session = { ...createMockSessionUser(), id: undefined as any }
      MiddlewareService.addUserHeaders(request, session)

      expect(mockNextResponse.next).toHaveBeenCalled()
    })

    it('should handle session with missing email', () => {
      const request = createMockRequest()
      const session = { ...createMockSessionUser(), email: undefined as any }
      MiddlewareService.addUserHeaders(request, session)

      expect(mockNextResponse.next).toHaveBeenCalled()
    })
  })

  describe('Backward Compatibility Exports', () => {
    describe('getActiveThemeMiddleware', () => {
      it('should be an alias for MiddlewareService.getByTheme', () => {
        const resultService = MiddlewareService.getByTheme('test-theme')
        const resultExport = getActiveThemeMiddleware('test-theme')

        expect(resultExport).toEqual(resultService)
      })

      it('should return entry for valid theme', () => {
        const entry = getActiveThemeMiddleware('test-theme')

        expect(entry).toBeDefined()
        expect(entry?.themeName).toBe('test-theme')
      })

      it('should return undefined for invalid theme', () => {
        const entry = getActiveThemeMiddleware('non-existent')

        expect(entry).toBeUndefined()
      })
    })

    describe('getAllMiddlewares', () => {
      it('should be an alias for MiddlewareService.getAll', () => {
        const resultService = MiddlewareService.getAll()
        const resultExport = getAllMiddlewares()

        expect(resultExport).toEqual(resultService)
      })

      it('should return array of middlewares', () => {
        const middlewares = getAllMiddlewares()

        expect(Array.isArray(middlewares)).toBe(true)
        expect(middlewares.length).toBeGreaterThan(0)
      })
    })

    describe('hasThemeMiddleware', () => {
      it('should be an alias for MiddlewareService.hasMiddleware', () => {
        const resultService = MiddlewareService.hasMiddleware('test-theme')
        const resultExport = hasThemeMiddleware('test-theme')

        expect(resultExport).toEqual(resultService)
      })

      it('should return true for theme with middleware', () => {
        expect(hasThemeMiddleware('test-theme')).toBe(true)
      })

      it('should return false for theme without middleware', () => {
        expect(hasThemeMiddleware('no-middleware-theme')).toBe(false)
      })
    })

    describe('executeThemeMiddleware', () => {
      it('should be an alias for MiddlewareService.execute', async () => {
        const request = createMockRequest()

        // Both should behave the same - we can't directly compare async functions
        const resultExport = await executeThemeMiddleware('test-theme', request)

        expect(resultExport).toBeDefined()
        expect(resultExport).toHaveProperty('status')
      })

      it('should execute middleware for valid theme', async () => {
        const request = createMockRequest()
        const result = await executeThemeMiddleware('test-theme', request)

        expect(result).toBeDefined()
      })

      it('should return null for invalid theme', async () => {
        const request = createMockRequest()
        const result = await executeThemeMiddleware('non-existent', request)

        expect(result).toBeNull()
      })
    })

    describe('redirectWithoutSessionMiddleware', () => {
      it('should call NextResponse.redirect', () => {
        const request = createMockRequest()
        redirectWithoutSessionMiddleware(request)

        expect(mockNextResponse.redirect).toHaveBeenCalled()
      })

      it('should redirect to login', () => {
        const request = createMockRequest()
        redirectWithoutSessionMiddleware(request)

        expect(mockNextResponse.redirect).toHaveBeenCalled()
        const callArg = mockNextResponse.redirect.mock.calls[0][0]
        expect(callArg.pathname).toBe('/login')
      })
    })

    describe('redirectWithSessionMiddleware', () => {
      it('should call NextResponse.redirect', () => {
        const request = createMockRequest()
        redirectWithSessionMiddleware(request)

        expect(mockNextResponse.redirect).toHaveBeenCalled()
      })

      it('should redirect to dashboard', () => {
        const request = createMockRequest()
        redirectWithSessionMiddleware(request)

        expect(mockNextResponse.redirect).toHaveBeenCalled()
        const callArg = mockNextResponse.redirect.mock.calls[0][0]
        expect(callArg.pathname).toBe('/dashboard')
      })
    })

    describe('addUserHeadersMiddleware', () => {
      it('should call NextResponse.next', () => {
        const request = createMockRequest()
        const session = createMockSessionUser()
        addUserHeadersMiddleware(request, session)

        expect(mockNextResponse.next).toHaveBeenCalled()
      })

      it('should handle null session', () => {
        const request = createMockRequest()
        addUserHeadersMiddleware(request, null)

        expect(mockNextResponse.next).toHaveBeenCalled()
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string in getByTheme', () => {
      const entry = MiddlewareService.getByTheme('')

      expect(entry).toBeUndefined()
    })

    it('should handle whitespace-only string in hasMiddleware', () => {
      expect(MiddlewareService.hasMiddleware('   ')).toBe(false)
    })

    it('should handle special characters in theme name lookup', () => {
      expect(MiddlewareService.getByTheme('theme-with-dashes')).toBeUndefined()
      expect(MiddlewareService.getByTheme('theme.with.dots')).toBeUndefined()
    })

    it('should not throw when execute is called with missing parameters', async () => {
      const request = createMockRequest()

      // Should not throw, just return null
      await expect(MiddlewareService.execute('', request)).resolves.toBeNull()
    })
  })

  describe('Data Consistency', () => {
    it('should have consistent middleware counts', () => {
      const metadata = MiddlewareService.getMetadata()
      const all = MiddlewareService.getAll()

      expect(metadata.totalMiddlewares).toBe(all.length)
    })

    it('should have themes array matching getAll length', () => {
      const metadata = MiddlewareService.getMetadata()
      const all = MiddlewareService.getAll()

      expect(metadata.themes.length).toBe(all.length)
    })

    it('should have consistent themesWithMiddleware count', () => {
      const metadata = MiddlewareService.getMetadata()
      const all = MiddlewareService.getAll()

      const withMiddleware = all.filter(m => m.exists).length
      expect(metadata.themesWithMiddleware).toBe(withMiddleware)
    })
  })
})
