/**
 * The hooks a signed-in dashboard runs on mount ask for the profile under the
 * app's base path (#198).
 *
 * Both run right after any sign-in, including the Google and OTP flows that
 * land on `/base/dashboard`: useEnsureUserMetadata creates the default
 * preference blocks for an account that has none, and useAccountPreferencesSync
 * applies the theme saved to the account. Asking for `/api/user/profile` under
 * a base path gets a 404, so the metadata is never created and the theme never
 * restored, with the session perfectly valid.
 */
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEnsureUserMetadata } from '@/core/hooks/useEnsureUserMetadata'
import { useAccountPreferencesSync } from '@/core/hooks/useAccountPreferencesSync'

jest.mock('@/core/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'user-1' } } }) },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

const setTheme = jest.fn()
jest.mock('next-themes', () => ({
  useTheme: () => ({ setTheme, forcedTheme: undefined }),
}))

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH
const fetchMock = jest.fn()

function urlsFetched(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url))
}

beforeEach(() => {
  process.env.__NEXT_ROUTER_BASEPATH = '/base'
  fetchMock.mockReset()
  setTheme.mockReset()
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

describe('useAccountPreferencesSync under a base path', () => {
  test('reads the account theme under the base path and applies it', async () => {
    serveUnderBasePath({ id: 'user-1', meta: { uiPreferences: { theme: 'dark' } } })

    let applyPreferences: ((result: unknown) => void) | undefined
    renderHookInQueryClient(() => {
      applyPreferences = useAccountPreferencesSync() as unknown as (result: unknown) => void
    })

    applyPreferences!({ data: { user: { id: 'user-1' } } })

    await waitFor(() => {
      expect(urlsFetched()).toContain('/base/api/user/profile?includeMeta=true')
    })
    await waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith('dark')
    })
  })
})
