/**
 * The proxy sends a signed-in user without the role of an area to their landing route (dashboard.homeRoute of
 * app.config, per role), keeping error=access_denied. Without the option it is /dashboard, as before.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'

jest.mock('@nextsparkjs/core/lib/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}))
const mockApp: { dashboard?: { homeRoute?: unknown } } = {}
jest.mock('@nextsparkjs/core/lib/config', () => ({ APP_CONFIG_MERGED: mockApp }))
jest.mock('@nextsparkjs/core/lib/middleware', () => ({
  hasProjectMiddleware: () => false,
  executeProjectMiddleware: jest.fn(),
  getProjectAppConfig: jest.fn(() => undefined),
}))

import { auth } from '@nextsparkjs/core/lib/auth'
import { NextRequest } from 'next/server'
import { proxy } from '@nextsparkjs/core/proxy'

type Redirect = { type?: string; redirectUrl?: string }
const mockedGetSession = auth.api.getSession as unknown as jest.Mock

function makeRequest(path: string) {
  const request = new NextRequest(`http://localhost:3000${path}`, { method: 'GET' }) as unknown as NextRequest
  ;(request as unknown as { headers: Headers }).headers = new Headers({ cookie: '' })
  return request
}

async function deniedLocation(role: string, path = '/superadmin/users') {
  mockedGetSession.mockResolvedValue({ user: { id: 'user-1', email: 'u@example.com', role } })
  const response = (await proxy(makeRequest(path))) as unknown as Redirect
  expect(response.type).toBe('redirect')
  return response.redirectUrl as string
}

beforeEach(() => {
  mockedGetSession.mockReset()
  delete mockApp.dashboard
})

describe('proxy access-denied redirect', () => {
  test('without the option it goes to /dashboard with the error', async () => {
    expect(await deniedLocation('member')).toContain('/dashboard?error=access_denied')
  })

  test('a string landing route replaces /dashboard', async () => {
    mockApp.dashboard = { homeRoute: '/dashboard/tasks' }
    expect(await deniedLocation('member')).toContain('/dashboard/tasks?error=access_denied')
  })

  test('a map follows the role, with default for the rest', async () => {
    mockApp.dashboard = { homeRoute: { default: '/dashboard/tasks', admin: '/dashboard/team' } }
    expect(await deniedLocation('admin', '/devtools/config')).toContain('/dashboard/team?error=access_denied')
    expect(await deniedLocation('member', '/devtools/config')).toContain('/dashboard/tasks?error=access_denied')
  })

  test('a landing route inside a closed area does not loop', async () => {
    mockApp.dashboard = { homeRoute: '/superadmin' }
    const location = await deniedLocation('member')
    expect(location).toContain('/dashboard?error=access_denied')
    expect(location).not.toContain('/superadmin')
  })

  test('a landing route that leaves the app is ignored', async () => {
    mockApp.dashboard = { homeRoute: 'https://evil.example/x' }
    const location = await deniedLocation('member')
    expect(location).toContain('/dashboard?error=access_denied')
    expect(location).not.toContain('evil.example')
  })
})
