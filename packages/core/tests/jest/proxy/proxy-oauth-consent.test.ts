/**
 * The consent page of MCP browser sign-in (#541) is a page only while MCP_OAUTH_ENABLED is on. Off, the proxy sends
 * that one path to the app's not-found page; a project's own routes under /oauth are left as they were.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const mockHasProjectMiddleware = jest.fn()

jest.mock('@nextsparkjs/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn(async () => null) } } }))
jest.mock('@nextsparkjs/core/lib/middleware', () => ({
  hasProjectMiddleware: mockHasProjectMiddleware,
  executeProjectMiddleware: jest.fn(),
  getProjectAppConfig: () => undefined,
}))
jest.mock('next/server', () => {
  Object.assign(globalThis, jest.requireActual('node:stream/web'))
  Object.assign(globalThis, jest.requireActual('next/dist/compiled/@edge-runtime/primitives/fetch') as object)
  return {
    ...jest.requireActual('next/dist/server/web/spec-extension/request'),
    ...jest.requireActual('next/dist/server/web/spec-extension/response'),
  }
})

import { NextRequest } from 'next/server'
import { proxy } from '@nextsparkjs/core/proxy'

const request = (path: string) => new NextRequest(`http://localhost:3000${path}`)
const rewrite = async (path: string) => (await proxy(request(path))).headers.get('x-middleware-rewrite')
const env = process.env as Record<string, string | undefined>
const saved = { oauth: env.MCP_OAUTH_ENABLED, mcp: env.MCP_ENABLED }

describe('/oauth/consent and MCP_OAUTH_ENABLED (#541)', () => {
  beforeEach(() => {
    mockHasProjectMiddleware.mockReset().mockReturnValue(false)
    delete env.MCP_ENABLED
  })
  afterEach(() => {
    env.MCP_OAUTH_ENABLED = saved.oauth
    env.MCP_ENABLED = saved.mcp
  })

  test('off: the consent and team picker paths are rewritten to the not-found page', async () => {
    delete env.MCP_OAUTH_ENABLED
    expect(await rewrite('/oauth/select-team')).toBe('http://localhost:3000/_ns/not-found')
    expect(await rewrite('/oauth/consent')).toBe('http://localhost:3000/_ns/not-found')
    expect(await rewrite('/oauth/consent?client_id=x&sig=y')).toMatch(/\/_ns\/not-found/)
  })

  test.each(['/oauth', '/oauth/callback', '/oauth/consent/more', '/oauthx'])('off: %s, a path a project may own, is answered as any other path', async path => {
    delete env.MCP_OAUTH_ENABLED
    const [oauthPath, otherPath] = await Promise.all([proxy(request(path)), proxy(request('/some-project-page'))])
    expect(oauthPath.headers.get('x-middleware-rewrite')).toBe(otherPath.headers.get('x-middleware-rewrite'))
    expect(oauthPath.status).toBe(otherPath.status)
    expect(oauthPath.headers.get('x-middleware-rewrite') ?? '').not.toMatch(/not-found/)
  })

  test('on: both paths reach their pages', async () => {
    env.MCP_OAUTH_ENABLED = 'true'
    expect((await rewrite('/oauth/consent')) ?? '').not.toMatch(/not-found/)
    expect((await rewrite('/oauth/select-team')) ?? '').not.toMatch(/not-found/)
  })
})
