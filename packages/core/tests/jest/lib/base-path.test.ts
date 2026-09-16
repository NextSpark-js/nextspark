/**
 * withBasePath — an in-app path, written without the base path, gets it
 * prefixed exactly once. withBasePathIfInApp — a URL that is data, so it
 * arrives with or without the prefix and from any origin, gets it exactly
 * once too. withBasePathRequest — the URL a route handler receives gets the
 * base path back, with the rest of the request intact.
 */
import { withBasePath, withBasePathIfInApp, withBasePathRequest } from '@/core/lib/base-path'

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

describe('withBasePathIfInApp', () => {
  test('leaves every URL as-is when the app has no base path', () => {
    delete process.env.__NEXT_ROUTER_BASEPATH
    expect(withBasePathIfInApp('/contact')).toBe('/contact')
    expect(withBasePathIfInApp('https://example.com/contact')).toBe('https://example.com/contact')
  })

  test.each([
    // written without the prefix, the way a path in the code is
    ['/contact', '/base/contact'],
    ['/uploads/temp/x.png', '/base/uploads/temp/x.png'],
    ['/', '/base'],
    // saved with the prefix, the way an author copies it out of the address bar
    ['/base/contact', '/base/contact'],
    ['/base', '/base'],
    // a path that only starts like the base path is a different page
    ['/baseline', '/base/baseline'],
    ['/base-camp/contact', '/base/base-camp/contact'],
    // another origin, which this app does not serve
    ['https://example.com/contact', 'https://example.com/contact'],
    ['//cdn.example.com/x.png', '//cdn.example.com/x.png'],
    ['mailto:someone@example.com', 'mailto:someone@example.com'],
  ])('%s becomes %s', (url, expected) => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    expect(withBasePathIfInApp(url)).toBe(expected)
  })

  test('prefixing an already-prefixed URL twice changes nothing', () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    expect(withBasePathIfInApp(withBasePathIfInApp('/contact'))).toBe('/base/contact')
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
