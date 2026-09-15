/**
 * withBasePath — an in-app path, written without the base path, gets it
 * prefixed exactly once. withBasePathRequest — the URL a route handler
 * receives gets the base path back, with the rest of the request intact.
 */
import { withBasePath, withBasePathRequest } from '@/core/lib/base-path'

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
})

describe('withBasePath', () => {
  test('leaves the path as-is when the app has no base path', () => {
    delete process.env.__NEXT_ROUTER_BASEPATH
    expect(withBasePath('/dashboard?auth_method=google')).toBe('/dashboard?auth_method=google')
  })

  test.each([
    ['/dashboard', '/base/dashboard'],
    ['/dashboard?auth_method=google', '/base/dashboard?auth_method=google'],
    ['/dashboard?at=2026-09-14T12%3A30%3A00Z#section', '/base/dashboard?at=2026-09-14T12%3A30%3A00Z#section'],
    ['/api/auth', '/base/api/auth'],
    ['/basement', '/base/basement'],
    ['/', '/base'],
  ])('prefixes the base path onto %s', (path, expected) => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    expect(withBasePath(path)).toBe(expected)
  })

  test.each([
    ['/dashboard', '/dashboard?auth_method=google', '/dashboard/dashboard?auth_method=google'],
    ['/dashboard', '/dashboard', '/dashboard/dashboard'],
    ['/base', '/base/reports', '/base/base/reports'],
  ])('under base path %s, prefixes %s even though it starts with the same segment', (base, path, expected) => {
    process.env.__NEXT_ROUTER_BASEPATH = base
    expect(withBasePath(path)).toBe(expected)
  })
})

describe('withBasePathRequest', () => {
  const OriginalRequest = globalThis.Request

  afterEach(() => {
    globalThis.Request = OriginalRequest
  })

  test('returns the same request when the app has no base path', () => {
    delete process.env.__NEXT_ROUTER_BASEPATH
    const request = new OriginalRequest('http://localhost:3191/api/auth/ok')
    expect(withBasePathRequest(request)).toBe(request)
  })

  test('builds a request for the URL with the base path, taking everything else from the original', () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    const request = new OriginalRequest('http://localhost:3191/api/auth/sign-in/email?x=1', { method: 'POST' })

    // The original request is passed as the init of the new one, which copies
    // its method, headers and body.
    const constructed: unknown[][] = []
    globalThis.Request = class {
      constructor(...args: unknown[]) {
        constructed.push(args)
      }
    } as unknown as typeof Request

    withBasePathRequest(request)

    expect(constructed).toHaveLength(1)
    const [input, init] = constructed[0]
    expect(String(input)).toBe('http://localhost:3191/base/api/auth/sign-in/email?x=1')
    expect(init).toBe(request)
  })
})
