/**
 * The verify-email page (apps/dev/app/(auth)/verify-email): once the token is
 * verified, it reads the session from Better Auth's get-session and creates
 * the default metadata for that user. Every call goes under the app's base
 * path.
 */
import { render, waitFor } from '@testing-library/react'

// The router is the same instance on every render, as in Next.js: the page's
// effect depends on it.
const mockRouter = { push: jest.fn() }
const mockSearchParams = new URLSearchParams('token=verify-token')

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => mockRouter,
}))

import VerifyEmailPage from '@/app/(auth)/verify-email/page'

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH
const originalFetch = global.fetch

let session: unknown
let requests: { url: string; body?: string }[]

beforeEach(() => {
  session = { session: { id: 'session-1' }, user: { id: 'user-1' } }
  requests = []
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    requests.push({ url, body: init?.body as string | undefined })
    if (url.includes('/api/auth/verify-email')) return new Response('{"status":true}', { status: 200 })
    if (url.includes('/api/auth/get-session')) return new Response(JSON.stringify(session), { status: 200 })
    if (url.includes('/api/internal/user-metadata')) return new Response('{"success":true}', { status: 200 })
    return new Response('', { status: 404 })
  }) as typeof fetch
})

afterEach(() => {
  global.fetch = originalFetch
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
})

async function renderAndSettle(expectedRequests: number) {
  render(<VerifyEmailPage />)
  await waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(expectedRequests))
  // Give a request the page should not make the chance to show up.
  await new Promise(resolve => setTimeout(resolve, 20))
}

describe('verify-email page', () => {
  test('verifies the token, reads the session and creates the default metadata for that user', async () => {
    delete process.env.__NEXT_ROUTER_BASEPATH

    await renderAndSettle(3)

    expect(requests.map(({ url }) => url)).toEqual([
      '/api/auth/verify-email?token=verify-token',
      '/api/auth/get-session',
      '/api/internal/user-metadata',
    ])
    expect(JSON.parse(requests[2].body ?? '{}')).toEqual(expect.objectContaining({
      userId: 'user-1',
      metadata: expect.objectContaining({ uiPreferences: { theme: 'light', sidebarCollapsed: false } }),
    }))
  })

  test('makes every call under the base path', async () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'

    await renderAndSettle(3)

    expect(requests.map(({ url }) => url)).toEqual([
      '/base/api/auth/verify-email?token=verify-token',
      '/base/api/auth/get-session',
      '/base/api/internal/user-metadata',
    ])
  })

  test('creates no metadata when the browser has no session', async () => {
    delete process.env.__NEXT_ROUTER_BASEPATH
    session = null

    await renderAndSettle(2)

    expect(requests.map(({ url }) => url)).toEqual([
      '/api/auth/verify-email?token=verify-token',
      '/api/auth/get-session',
    ])
  })
})
