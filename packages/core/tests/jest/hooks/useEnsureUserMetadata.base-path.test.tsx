/**
 * The hook a signed-in dashboard runs on mount asks for the profile under the
 * app's base path (#198).
 *
 * It runs right after any sign-in, including the Google and OTP flows that
 * land on `/base/dashboard`: useEnsureUserMetadata creates the default
 * preference blocks for an account that has none. Asking for `/api/user/profile`
 * under a base path gets a 404, so the metadata is never created, with the
 * session perfectly valid. (The account's theme is no longer looked up after
 * hydration: the areas read it from the account theme cookie, #495, #510.)
 */
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEnsureUserMetadata } from '@/core/hooks/useEnsureUserMetadata'

jest.mock('@/core/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'user-1' } } }) },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH
const fetchMock = jest.fn()

function urlsFetched(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url))
}

beforeEach(() => {
  process.env.__NEXT_ROUTER_BASEPATH = '/base'
  fetchMock.mockReset()
  localStorage.clear()
  sessionStorage.clear()
  global.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
})

function respond(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body })
}

/** The app under a base path: only prefixed paths are served, the rest 404s. */
function serveUnderBasePath(profile: unknown) {
  fetchMock.mockImplementation((url: string) => {
    const path = String(url)
    if (!path.startsWith('/base/')) return respond({ error: 'Not found' }, 404)
    if (path.startsWith('/base/api/user/profile')) return respond(profile)
    if (path.startsWith('/base/api/internal/user-metadata')) return respond({ success: true })
    return respond({ error: 'Not found' }, 404)
  })
}

function renderHookInQueryClient(useHook: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Probe() {
    useHook()
    return null
  }
  return render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  )
}

describe('useEnsureUserMetadata under a base path', () => {
  test('reads the profile and creates the missing defaults under the base path', async () => {
    serveUnderBasePath({ id: 'user-1', meta: {} })

    renderHookInQueryClient(() => useEnsureUserMetadata())

    await waitFor(() => {
      expect(urlsFetched()).toContain('/base/api/user/profile?includeMeta=true')
    })
    await waitFor(() => {
      expect(urlsFetched()).toContain('/base/api/internal/user-metadata')
    })
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).includes('internal/user-metadata'))!
    expect(JSON.parse(String(init.body))).toEqual({
      userId: 'user-1',
      metadata: expect.objectContaining({ uiPreferences: expect.any(Object) }),
    })
  })
})
