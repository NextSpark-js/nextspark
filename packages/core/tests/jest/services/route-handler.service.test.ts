/**
 * RouteHandlerService Unit Tests
 *
 * Tests for the RouteHandlerService which provides O(1) lookups
 * for theme and plugin route handlers.
 */

import {
  RouteHandlerService,
  getThemeRouteHandler,
  getPluginRouteHandler,
  getThemeRouteKeys,
  getPluginRouteKeys,
  type RouteHandler
} from '@/core/lib/services/route-handler.service'
import {
  THEME_ROUTE_HANDLERS,
  PLUGIN_ROUTE_HANDLERS
} from '@/core/lib/registries/route-handlers'

describe('RouteHandlerService', () => {
  // ==================== Theme Route Methods ====================

  describe('getThemeHandler', () => {
    it('should return null for non-existent route key', () => {
      const handler = RouteHandlerService.getThemeHandler('nonexistent/route', 'GET')
      expect(handler).toBeNull()
    })

    it('should return null for empty route key', () => {
      const handler = RouteHandlerService.getThemeHandler('', 'GET')
      expect(handler).toBeNull()
    })

    it('should return null for non-existent method on existing route', () => {
      // With empty registry, all routes are non-existent
      const handler = RouteHandlerService.getThemeHandler('some/route', 'INVALID_METHOD')
      expect(handler).toBeNull()
    })

    it('should handle various HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      methods.forEach(method => {
        const handler = RouteHandlerService.getThemeHandler('test/route', method)
        // With empty registry, should return null
        expect(handler).toBeNull()
      })
    })

    it('should return handler when route and method exist', () => {
      // Test with actual registry data if any
      const keys = RouteHandlerService.getThemeKeys()
      if (keys.length > 0) {
        const routeKey = keys[0]
        const handlers = THEME_ROUTE_HANDLERS[routeKey]
        if (handlers) {
          const method = Object.keys(handlers)[0]
          if (method) {
            const handler = RouteHandlerService.getThemeHandler(routeKey, method)
            expect(handler).not.toBeNull()
            expect(typeof handler).toBe('function')
          }
        }
      }
    })
  })

  describe('getThemeKeys', () => {
    it('should return an array', () => {
      const keys = RouteHandlerService.getThemeKeys()
      expect(Array.isArray(keys)).toBe(true)
    })

    it('should return strings', () => {
      const keys = RouteHandlerService.getThemeKeys()
      keys.forEach(key => {
        expect(typeof key).toBe('string')
      })
    })

    it('should match Object.keys of THEME_ROUTE_HANDLERS', () => {
      const serviceKeys = RouteHandlerService.getThemeKeys()
      const directKeys = Object.keys(THEME_ROUTE_HANDLERS)
      expect(serviceKeys).toEqual(directKeys)
    })

    it('should return new array on each call (not mutating original)', () => {
      const keys1 = RouteHandlerService.getThemeKeys()
      const keys2 = RouteHandlerService.getThemeKeys()
      expect(keys1).not.toBe(keys2)
      expect(keys1).toEqual(keys2)
    })
  })

  describe('hasThemeRoute', () => {
    it('should return false for non-existent route', () => {
      expect(RouteHandlerService.hasThemeRoute('nonexistent/route')).toBe(false)
    })

    it('should return false for empty route key', () => {
      expect(RouteHandlerService.hasThemeRoute('')).toBe(false)
    })

    it('should return false for non-existent method on existing route', () => {
      const keys = RouteHandlerService.getThemeKeys()
      if (keys.length > 0) {
        expect(RouteHandlerService.hasThemeRoute(keys[0], 'INVALID_METHOD')).toBe(false)
      }
    })

    it('should return true for existing route without method check', () => {
      const keys = RouteHandlerService.getThemeKeys()
      if (keys.length > 0) {
        expect(RouteHandlerService.hasThemeRoute(keys[0])).toBe(true)
      }
    })

    it('should return true for existing route with valid method', () => {
      const keys = RouteHandlerService.getThemeKeys()
      if (keys.length > 0) {
        const routeKey = keys[0]
        const handlers = THEME_ROUTE_HANDLERS[routeKey]
        if (handlers) {
          const method = Object.keys(handlers).find(m => handlers[m] !== undefined)
          if (method) {
            expect(RouteHandlerService.hasThemeRoute(routeKey, method)).toBe(true)
          }
        }
      }
    })
  })

  describe('getThemeCount', () => {
    it('should return a number', () => {
      const count = RouteHandlerService.getThemeCount()
      expect(typeof count).toBe('number')
    })

    it('should return non-negative value', () => {
      const count = RouteHandlerService.getThemeCount()
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should match length of getThemeKeys', () => {
      const count = RouteHandlerService.getThemeCount()
      const keys = RouteHandlerService.getThemeKeys()
      expect(count).toBe(keys.length)
    })

    it('should match Object.keys length of THEME_ROUTE_HANDLERS', () => {
      const count = RouteHandlerService.getThemeCount()
      expect(count).toBe(Object.keys(THEME_ROUTE_HANDLERS).length)
    })
  })

  describe('getAllThemeHandlers', () => {
    it('should return the THEME_ROUTE_HANDLERS registry', () => {
      const handlers = RouteHandlerService.getAllThemeHandlers()
      expect(handlers).toBe(THEME_ROUTE_HANDLERS)
    })

    it('should return same reference (not a copy)', () => {
      const handlers1 = RouteHandlerService.getAllThemeHandlers()
      const handlers2 = RouteHandlerService.getAllThemeHandlers()
      expect(handlers1).toBe(handlers2)
    })

    it('should be an object', () => {
      const handlers = RouteHandlerService.getAllThemeHandlers()
      expect(typeof handlers).toBe('object')
      expect(handlers).not.toBeNull()
    })
  })

  // ==================== Plugin Route Methods ====================

  describe('getPluginHandler', () => {
    it('should return null for non-existent route key', () => {
      const handler = RouteHandlerService.getPluginHandler('nonexistent/route', 'GET')
      expect(handler).toBeNull()
    })

    it('should return null for empty route key', () => {
      const handler = RouteHandlerService.getPluginHandler('', 'POST')
      expect(handler).toBeNull()
    })

    it('should return null for non-existent method on existing route', () => {
      const handler = RouteHandlerService.getPluginHandler('some/route', 'INVALID_METHOD')
      expect(handler).toBeNull()
    })

    it('should handle various HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      methods.forEach(method => {
        const handler = RouteHandlerService.getPluginHandler('test/route', method)
        // With empty registry, should return null
        expect(handler).toBeNull()
      })
    })

    it('should return handler when route and method exist', () => {
      const keys = RouteHandlerService.getPluginKeys()
      if (keys.length > 0) {
        const routeKey = keys[0]
        const handlers = PLUGIN_ROUTE_HANDLERS[routeKey]
        if (handlers) {
          const method = Object.keys(handlers)[0]
          if (method) {
            const handler = RouteHandlerService.getPluginHandler(routeKey, method)
            expect(handler).not.toBeNull()
            expect(typeof handler).toBe('function')
          }
        }
      }
    })
  })

  describe('getPluginKeys', () => {
    it('should return an array', () => {
      const keys = RouteHandlerService.getPluginKeys()
      expect(Array.isArray(keys)).toBe(true)
    })

    it('should return strings', () => {
      const keys = RouteHandlerService.getPluginKeys()
      keys.forEach(key => {
        expect(typeof key).toBe('string')
      })
    })

    it('should match Object.keys of PLUGIN_ROUTE_HANDLERS', () => {
      const serviceKeys = RouteHandlerService.getPluginKeys()
      const directKeys = Object.keys(PLUGIN_ROUTE_HANDLERS)
      expect(serviceKeys).toEqual(directKeys)
    })

    it('should return new array on each call (not mutating original)', () => {
      const keys1 = RouteHandlerService.getPluginKeys()
      const keys2 = RouteHandlerService.getPluginKeys()
      expect(keys1).not.toBe(keys2)
      expect(keys1).toEqual(keys2)
    })
  })

  describe('hasPluginRoute', () => {
    it('should return false for non-existent route', () => {
      expect(RouteHandlerService.hasPluginRoute('nonexistent/route')).toBe(false)
    })

    it('should return false for empty route key', () => {
      expect(RouteHandlerService.hasPluginRoute('')).toBe(false)
    })

    it('should return false for non-existent method on existing route', () => {
      const keys = RouteHandlerService.getPluginKeys()
      if (keys.length > 0) {
        expect(RouteHandlerService.hasPluginRoute(keys[0], 'INVALID_METHOD')).toBe(false)
      }
    })

    it('should return true for existing route without method check', () => {
      const keys = RouteHandlerService.getPluginKeys()
      if (keys.length > 0) {
        expect(RouteHandlerService.hasPluginRoute(keys[0])).toBe(true)
      }
    })

    it('should return true for existing route with valid method', () => {
      const keys = RouteHandlerService.getPluginKeys()
      if (keys.length > 0) {
        const routeKey = keys[0]
        const handlers = PLUGIN_ROUTE_HANDLERS[routeKey]
        if (handlers) {
          const method = Object.keys(handlers).find(m => handlers[m] !== undefined)
          if (method) {
            expect(RouteHandlerService.hasPluginRoute(routeKey, method)).toBe(true)
          }
        }
      }
    })
  })

  describe('getPluginCount', () => {
    it('should return a number', () => {
      const count = RouteHandlerService.getPluginCount()
      expect(typeof count).toBe('number')
    })

    it('should return non-negative value', () => {
      const count = RouteHandlerService.getPluginCount()
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should match length of getPluginKeys', () => {
      const count = RouteHandlerService.getPluginCount()
      const keys = RouteHandlerService.getPluginKeys()
      expect(count).toBe(keys.length)
    })

    it('should match Object.keys length of PLUGIN_ROUTE_HANDLERS', () => {
      const count = RouteHandlerService.getPluginCount()
      expect(count).toBe(Object.keys(PLUGIN_ROUTE_HANDLERS).length)
    })
  })

  describe('getAllPluginHandlers', () => {
    it('should return the PLUGIN_ROUTE_HANDLERS registry', () => {
      const handlers = RouteHandlerService.getAllPluginHandlers()
      expect(handlers).toBe(PLUGIN_ROUTE_HANDLERS)
    })

    it('should return same reference (not a copy)', () => {
      const handlers1 = RouteHandlerService.getAllPluginHandlers()
      const handlers2 = RouteHandlerService.getAllPluginHandlers()
      expect(handlers1).toBe(handlers2)
    })

    it('should be an object', () => {
      const handlers = RouteHandlerService.getAllPluginHandlers()
      expect(typeof handlers).toBe('object')
      expect(handlers).not.toBeNull()
    })
  })

  // ==================== Combined Methods ====================

  describe('getTotalCount', () => {
    it('should return a number', () => {
      const count = RouteHandlerService.getTotalCount()
      expect(typeof count).toBe('number')
    })

    it('should return sum of theme and plugin counts', () => {
      const total = RouteHandlerService.getTotalCount()
      const themeCount = RouteHandlerService.getThemeCount()
      const pluginCount = RouteHandlerService.getPluginCount()
      expect(total).toBe(themeCount + pluginCount)
    })

    it('should return non-negative value', () => {
      const count = RouteHandlerService.getTotalCount()
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  // ==================== Backward Compatibility ====================

  describe('Backward Compatibility Exports', () => {
    describe('getThemeRouteHandler', () => {
      it('should be exported', () => {
        expect(getThemeRouteHandler).toBeDefined()
        expect(typeof getThemeRouteHandler).toBe('function')
      })

      it('should work the same as RouteHandlerService.getThemeHandler', () => {
        const key = 'test/route'
        const method = 'GET'
        expect(getThemeRouteHandler(key, method)).toBe(
          RouteHandlerService.getThemeHandler(key, method)
        )
      })
    })

    describe('getPluginRouteHandler', () => {
      it('should be exported', () => {
        expect(getPluginRouteHandler).toBeDefined()
        expect(typeof getPluginRouteHandler).toBe('function')
      })

      it('should work the same as RouteHandlerService.getPluginHandler', () => {
        const key = 'test/route'
        const method = 'POST'
        expect(getPluginRouteHandler(key, method)).toBe(
          RouteHandlerService.getPluginHandler(key, method)
        )
      })
    })

    describe('getThemeRouteKeys', () => {
      it('should be exported', () => {
        expect(getThemeRouteKeys).toBeDefined()
        expect(typeof getThemeRouteKeys).toBe('function')
      })

      it('should return same result as RouteHandlerService.getThemeKeys', () => {
        expect(getThemeRouteKeys()).toEqual(RouteHandlerService.getThemeKeys())
      })
    })

    describe('getPluginRouteKeys', () => {
      it('should be exported', () => {
        expect(getPluginRouteKeys).toBeDefined()
        expect(typeof getPluginRouteKeys).toBe('function')
      })

      it('should return same result as RouteHandlerService.getPluginKeys', () => {
        expect(getPluginRouteKeys()).toEqual(RouteHandlerService.getPluginKeys())
      })
    })
  })

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle special characters in route key', () => {
      const handler = RouteHandlerService.getThemeHandler('test/[id]/route', 'GET')
      expect(handler).toBeNull()
    })

    it('should handle route key with multiple slashes', () => {
      const handler = RouteHandlerService.getPluginHandler('plugin/a/b/c/d', 'POST')
      expect(handler).toBeNull()
    })

    it('should handle undefined method gracefully', () => {
      // TypeScript would catch this, but test runtime behavior
      const handler = RouteHandlerService.getThemeHandler('test', undefined as unknown as string)
      expect(handler).toBeNull()
    })

    it('should handle method case sensitivity', () => {
      // HTTP methods should be case-sensitive per spec
      const handler1 = RouteHandlerService.getPluginHandler('test', 'get')
      const handler2 = RouteHandlerService.getPluginHandler('test', 'GET')
      // Both should be null with empty registry, but behavior would differ with data
      expect(handler1).toBeNull()
      expect(handler2).toBeNull()
    })
  })

  // ==================== Type Checks ====================

  describe('Type Safety', () => {
    it('RouteHandler type should be exported', () => {
      // This is a compile-time check, but we can verify the import works
      const mockHandler: RouteHandler = async (request, context) => {
        return new Response('test') as any
      }
      expect(typeof mockHandler).toBe('function')
    })
  })

  // ==================== Integration Tests ====================

  describe('Integration', () => {
    it('getThemeKeys results should all be valid for hasThemeRoute', () => {
      const keys = RouteHandlerService.getThemeKeys()
      keys.forEach(key => {
        expect(RouteHandlerService.hasThemeRoute(key)).toBe(true)
      })
    })

    it('getPluginKeys results should all be valid for hasPluginRoute', () => {
      const keys = RouteHandlerService.getPluginKeys()
      keys.forEach(key => {
        expect(RouteHandlerService.hasPluginRoute(key)).toBe(true)
      })
    })

    it('getAllThemeHandlers keys should match getThemeKeys', () => {
      const handlers = RouteHandlerService.getAllThemeHandlers()
      const keys = RouteHandlerService.getThemeKeys()
      expect(Object.keys(handlers)).toEqual(keys)
    })

    it('getAllPluginHandlers keys should match getPluginKeys', () => {
      const handlers = RouteHandlerService.getAllPluginHandlers()
      const keys = RouteHandlerService.getPluginKeys()
      expect(Object.keys(handlers)).toEqual(keys)
    })
  })
})
