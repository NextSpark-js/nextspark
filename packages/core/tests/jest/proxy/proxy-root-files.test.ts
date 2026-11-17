/**
 * createProxy({ rejectUnknownRootFiles }) (#480)
 *
 * A one-segment request for a file the build did not list gets an empty 404 before any route renders. The root files
 * come from the registries mock (root-files.ts): favicon.ico, llms.txt, logo.png, 'my logo.png', robots.txt, sitemap.xml.
 * Next's real NextRequest/NextResponse, as in proxy-theme-composition.test.ts, so the status and body are the real ones.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const mockHasProjectMiddleware = jest.fn()
const mockExecuteProjectMiddleware = jest.fn()

// A factory runs when the module is first required: the counter says whether the auth instance was built (#480)
const mockAuthLoads = jest.fn()
jest.mock('@nextsparkjs/core/lib/auth', () => {
  mockAuthLoads()
  return { auth: { api: { getSession: jest.fn(async () => null) } } }
})

jest.mock('@nextsparkjs/core/lib/middleware', () => ({
  hasProjectMiddleware: mockHasProjectMiddleware,
  executeProjectMiddleware: (...args: unknown[]) => mockExecuteProjectMiddleware(...args),
  getProjectAppConfig: () => undefined,
}))

jest.mock('next/server', () => {
  Object.assign(globalThis, jest.requireActual('node:stream/web'))
  const primitives = jest.requireActual('next/dist/compiled/@edge-runtime/primitives/fetch') as {
    Headers: typeof Headers
    Request: typeof Request
    Response: typeof Response
  }
  Object.assign(globalThis, primitives)
  return {
    ...jest.requireActual('next/dist/server/web/spec-extension/request'),
    ...jest.requireActual('next/dist/server/web/spec-extension/response'),
  }
})

import { NextRequest, NextResponse } from 'next/server'
import { createProxy, proxy } from '@nextsparkjs/core/proxy'

function request(path: string, init: { method?: string; nextConfig?: object } = {}): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, init as ConstructorParameters<typeof NextRequest>[1])
}

const rejecting = createProxy({ rejectUnknownRootFiles: true })
const env = process.env as Record<string, string | undefined>
const nodeEnv = env.NODE_ENV

describe('createProxy({ rejectUnknownRootFiles }) (#480)', () => {
  beforeEach(() => {
    mockHasProjectMiddleware.mockReset().mockReturnValue(false)
    mockExecuteProjectMiddleware.mockReset()
  })

  afterEach(() => {
    env.NODE_ENV = nodeEnv
  })

  test.each(['/meta.json', '/wp-login.php', '/apple-touch-icon.png', '/ads.txt', '/sitemap_index.xml', '/WP-LOGIN.PHP', '/%6Deta.json'])(
    '%s gets an empty 404',
    async path => {
      const response = await rejecting(request(path))

      expect(response.status).toBe(404)
      expect(await response.text()).toBe('')
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
      expect(response.headers.get('x-middleware-next')).toBeNull()
    }
  )

  test('HEAD is answered the same', async () => {
    expect((await rejecting(request('/meta.json', { method: 'HEAD' }))).status).toBe(404)
  })

  test.each(['/robots.txt', '/sitemap.xml', '/favicon.ico', '/logo.png', '/llms.txt'])('a listed root file, %s, goes on to the app', async path => {
    const response = await rejecting(request(path))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  test.each([
    ['a page slug', '/about'],
    ['a slug with a dot and no file extension', '/release-1.0'],
    ['a file under a folder', '/images/missing.png'],
    ['an API route', '/api/v1/data.json'],
    ['the site root', '/'],
  ])('%s (%s) goes on to the app', async (_label, path) => {
    const response = await rejecting(request(path))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  test('a listed name is compared decoded: /my%20logo.png is "my logo.png"', async () => {
    expect((await rejecting(request('/my%20logo.png'))).headers.get('x-middleware-next')).toBe('1')
    expect((await rejecting(request('/my%20other.png'))).status).toBe(404)
  })

  test('a hook rewrite to an unlisted one-segment name goes to that destination, not to the 404', async () => {
    mockHasProjectMiddleware.mockReturnValue(true)
    mockExecuteProjectMiddleware.mockReturnValueOnce(NextResponse.rewrite(new URL('http://localhost:3000/generated.json')))

    const response = await rejecting(request('/feed.json'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/generated.json')
  })

  test('a POST is left to the app', async () => {
    expect((await rejecting(request('/meta.json', { method: 'POST' }))).headers.get('x-middleware-next')).toBe('1')
  })

  test('off by default: proxy and createProxy() let it through', async () => {
    expect((await proxy(request('/meta.json'))).headers.get('x-middleware-next')).toBe('1')
    expect((await createProxy()(request('/meta.json'))).headers.get('x-middleware-next')).toBe('1')
  })

  test('under a basePath, the root is the base path', async () => {
    const nextConfig = { basePath: '/base' }

    expect((await rejecting(request('/base/meta.json', { nextConfig }))).status).toBe(404)
    expect((await rejecting(request('/base/robots.txt', { nextConfig }))).headers.get('x-middleware-next')).toBe('1')
  })

  test('a file the project hook rewrites or answers is not refused', async () => {
    mockHasProjectMiddleware.mockReturnValue(true)
    mockExecuteProjectMiddleware.mockReturnValueOnce(NextResponse.rewrite(new URL('http://localhost:3000/api/meta')))
    const rewritten = await rejecting(request('/meta.json'))
    mockExecuteProjectMiddleware.mockReturnValueOnce(NextResponse.json({ ok: true }))
    const answered = await rejecting(request('/meta.json'))

    expect(rewritten.headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/api/meta')
    expect(answered.status).toBe(200)
    expect(await answered.json()).toEqual({ ok: true })
  })

  test('a hook that lets the request through still gets the 404, with the headers the hook set', async () => {
    mockHasProjectMiddleware.mockReturnValue(true)
    const next = NextResponse.next()
    next.headers.set('x-project', 'yes')
    mockExecuteProjectMiddleware.mockReturnValueOnce(next)

    const response = await rejecting(request('/meta.json'))

    expect(response.status).toBe(404)
    expect(response.headers.get('x-project')).toBe('yes')
  })

  test('next dev serves public/ as it is now, so nothing is refused there', async () => {
    env.NODE_ENV = 'development'

    expect((await rejecting(request('/meta.json'))).headers.get('x-middleware-next')).toBe('1')
  })

  // Last in the file: every request above was a public page or a root file, and none built the auth instance
  test('public pages and root files do not build the auth instance; the first protected request does (#480)', async () => {
    await proxy(request('/'))
    await rejecting(request('/meta.json'))
    await rejecting(request('/robots.txt'))
    expect(mockAuthLoads).not.toHaveBeenCalled()

    const response = await proxy(request('/dashboard'))

    expect(mockAuthLoads).toHaveBeenCalledTimes(1)
    expect(response.headers.get('location')).toContain('/login')
  })
})
