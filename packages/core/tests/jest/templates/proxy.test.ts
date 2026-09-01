/**
 * Proxy identity-header hardening (#87)
 *
 * Inbound x-user-id / x-user-email / x-pathname must never reach the app:
 * they are stripped on EVERY path (public, /api/v1, unmatched) and re-added
 * only from the verified session on protected routes.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'

jest.mock('@better-fetch/fetch', () => ({
  betterFetch: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/middleware', () => ({
  hasThemeMiddleware: () => false,
  executeThemeMiddleware: jest.fn(),
  getThemeAppConfig: () => undefined,
}))

import { betterFetch } from '@better-fetch/fetch'
import { NextRequest } from 'next/server'
import { proxy } from '../../../templates/proxy'

type PassThrough = { type?: string; requestHeaders?: Headers | null; redirectUrl?: string }

const FORGED = {
  'x-user-id': 'attacker-controlled-id',
  'x-user-email': 'attacker@example.com',
  'x-pathname': '/admin',
}

function makeRequest(path: string, extraHeaders: Record<string, string> = {}) {
  const request = new NextRequest(`http://localhost:3000${path}`, { method: 'POST' }) as unknown as NextRequest
  // Use the global Headers polyfill (tests/jest/setup.ts) so `new Headers(request.headers)`
  // inside the proxy copies the inbound headers exactly like the runtime does.
  ;(request as unknown as { headers: Headers }).headers = new Headers({
    ...FORGED,
    'next-action': 'abc123',
    cookie: '',
    ...extraHeaders,
  })
  return request
}

const mockedFetch = betterFetch as unknown as jest.Mock

describe('proxy identity headers (#87)', () => {
  beforeEach(() => {
    mockedFetch.mockReset()
    delete process.env.NEXT_PUBLIC_ACTIVE_THEME
  })

  test.each([
    ['public path', '/login'],
    ['root', '/'],
    ['api v1', '/api/v1/teams'],
    ['unmatched path', '/some-marketing-page'],
  ])('strips forged identity headers on %s', async (_label, path) => {
    const response = (await proxy(makeRequest(path))) as unknown as PassThrough

    expect(response.type).toBe('next')
    const forwarded = response.requestHeaders as Headers
    expect(forwarded).toBeTruthy()
    expect(forwarded.get('x-user-id')).toBeNull()
    expect(forwarded.get('x-user-email')).toBeNull()
    // x-pathname is always the real pathname, never the inbound value
    expect(forwarded.get('x-pathname')).toBe(path)
    // Unrelated headers still pass through
    expect(forwarded.get('next-action')).toBe('abc123')
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  test('re-adds identity headers only from the verified session on protected routes', async () => {
    mockedFetch.mockResolvedValue({
      data: { user: { id: 'real-user-id', email: 'real@example.com', role: 'member' } },
    })

    const response = (await proxy(makeRequest('/dashboard'))) as unknown as PassThrough

    expect(response.type).toBe('next')
    const forwarded = response.requestHeaders as Headers
    expect(forwarded.get('x-user-id')).toBe('real-user-id')
    expect(forwarded.get('x-user-email')).toBe('real@example.com')
    expect(forwarded.get('x-pathname')).toBe('/dashboard')
  })

  test('redirects to login on protected routes without a session (forged header does not help)', async () => {
    mockedFetch.mockResolvedValue({ data: null })

    const response = (await proxy(makeRequest('/dashboard'))) as unknown as PassThrough

    expect(response.type).toBe('redirect')
    expect(response.redirectUrl).toContain('/login')
  })
})
