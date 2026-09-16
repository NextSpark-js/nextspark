/**
 * withBasePath — an in-app path, written without the base path, gets it
 * prefixed exactly once. withBasePathIfInApp — a URL that is data, so it
 * arrives with or without the prefix and from any origin, gets it exactly
 * once too. withBasePathRequest — the URL a route handler receives gets the
 * base path back, with the rest of the request intact.
 */
import { withBasePath, withBasePathIfInApp, withBasePathInSrcset, withBasePathRequest, withoutBasePath } from '@/core/lib/base-path'

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

describe('withBasePathIfInApp — where the base path ends', () => {
  test.each([
    // the base path followed by a query or a fragment is still the base path
    ['/base', '/base?x=1', '/base?x=1'],
    ['/base', '/base#pricing', '/base#pricing'],
    ['/base', '/base/?x=1', '/base/?x=1'],
    ['/base', '/contact?x=1#form', '/base/contact?x=1#form'],
    // a segment that only starts like it is a different page
    ['/base', '/baseline', '/base/baseline'],
    ['/base', '/baseline?x=1', '/base/baseline?x=1'],
    // a base path given with a trailing slash names the same prefix
    ['/base/', '/contact', '/base/contact'],
    ['/base/', '/base/contact', '/base/contact'],
    ['/base/', '/base', '/base'],
    ['/base/', '/', '/base'],
    // a base path of more than one segment
    ['/a/b', '/a/b/contact', '/a/b/contact'],
    ['/a/b', '/a/b?x=1', '/a/b?x=1'],
    ['/a/b', '/a/contact', '/a/b/a/contact'],
    ['/a/b', '/a/bc', '/a/b/a/bc'],
  ])('under base path %s, %s becomes %s', (base, url, expected) => {
    process.env.__NEXT_ROUTER_BASEPATH = base
    expect(withBasePathIfInApp(url)).toBe(expected)
  })

  test('withBasePath does not double the slash of a base path given with one', () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base/'
    expect(withBasePath('/contact')).toBe('/base/contact')
    expect(withBasePath('/')).toBe('/base')
  })
})

describe('withoutBasePath', () => {
  test('leaves every URL as-is when the app has no base path', () => {
    delete process.env.__NEXT_ROUTER_BASEPATH
    expect(withoutBasePath('/base/contact')).toBe('/base/contact')
    expect(withoutBasePath('/contact')).toBe('/contact')
  })

  test.each([
    ['/base', '/base/contact', '/contact'],
    ['/base', '/base', '/'],
    ['/base', '/base/', '/'],
    ['/base', '/base?x=1', '/?x=1'],
    ['/base', '/base#pricing', '/#pricing'],
    ['/base', '/base/contact?x=1#form', '/contact?x=1#form'],
    // a URL without the base path, or with a segment that only starts like it
    ['/base', '/contact', '/contact'],
    ['/base', '/baseline', '/baseline'],
    // another origin
    ['/base', '//cdn.example.com/base/x.png', '//cdn.example.com/base/x.png'],
    ['/base', 'https://example.com/base/contact', 'https://example.com/base/contact'],
    // a base path given with a trailing slash, or of more than one segment
    ['/base/', '/base/contact', '/contact'],
    ['/a/b', '/a/b/contact', '/contact'],
    ['/a/b', '/a/contact', '/a/contact'],
  ])('under base path %s, %s becomes %s', (base, url, expected) => {
    process.env.__NEXT_ROUTER_BASEPATH = base
    expect(withoutBasePath(url)).toBe(expected)
  })

  test('puts back exactly what withBasePathIfInApp adds', () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    for (const url of ['/contact', '/contact?x=1', '/base/contact', '/baseline']) {
      expect(withBasePathIfInApp(withoutBasePath(url))).toBe(withBasePathIfInApp(url))
    }
  })
})

describe('withBasePathInSrcset', () => {
  // An inline SVG: commas inside the URL, in the media type's data and in its viewBox
  const SVG = "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270,0,1,1%27%3E%3C/svg%3E"
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  test.each([
    ['/a.png 1x, /b.png 2x', '/base/a.png 1x, /base/b.png 2x'],
    ['/a.png 640w,/b.png 1280w', '/base/a.png 640w,/base/b.png 1280w'],
    ['/a.png, /b.png 2x', '/base/a.png, /base/b.png 2x'],
    ['  /a.png   1x ,  /b.png 2x ', '  /base/a.png   1x ,  /base/b.png 2x '],
    ['https://cdn.example/a.png 1x, /base/b.png 2x', 'https://cdn.example/a.png 1x, /base/b.png 2x'],
    [`${SVG} 1x, /uploads/x.png 2x`, `${SVG} 1x, /base/uploads/x.png 2x`],
    [`/uploads/x.png 1x, ${SVG} 2x`, `/base/uploads/x.png 1x, ${SVG} 2x`],
    [`${PNG} 1x, /uploads/x.png 2x`, `${PNG} 1x, /base/uploads/x.png 2x`],
    [SVG, SVG],
  ])('%s becomes %s', (srcset, expected) => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    expect(withBasePathInSrcset(srcset)).toBe(expected)
  })

  test('with no base path the srcset comes back as it went in', () => {
    delete process.env.__NEXT_ROUTER_BASEPATH
    expect(withBasePathInSrcset(`${SVG} 1x, /uploads/x.png 2x`)).toBe(`${SVG} 1x, /uploads/x.png 2x`)
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
