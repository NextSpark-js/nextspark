/**
 * @jest-environment jsdom
 *
 * #574: the list keeps the server's rows behind the skeleton until the team is ready, and relies on the team never being
 * ready on the server or while hydrating: then the server HTML and the hydration render agree (rows' date cells depend on
 * the time zone of whoever renders). This drives the real TeamProvider, useTeam and useAuth through renderToString and a
 * real hydrateRoot, and records the team's readiness in every render: false on the server and in the hydration render,
 * even when the session is already in the browser's store.
 *
 * The auth client is the one module replaced: Better Auth's client is ESM that this Jest setup does not load. The stand-in
 * keeps the contract of Better Auth's React store (its server snapshot is the store's initial, pending value), which
 * tests/node/session-server-snapshot.test.ts pins on the real client. (Run with NODE_OPTIONS=--experimental-vm-modules
 * and the mock removed, this file passes against the real client too.)
 */
import React, { useLayoutEffect, useRef } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockListEntityData = jest.fn()
const CONFIG = {
  slug: 'pages',
  enabled: true,
  names: { singular: 'Page', plural: 'Pages' },
  access: {},
  ui: { dashboard: { filters: [], columns: [] }, features: { bulkOperations: false } },
  fields: [],
}

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/pages' }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }))
jest.mock('@/core/hooks/useEntityConfig', () => ({ useEntityConfig: () => ({ config: CONFIG, isLoading: false, error: null }) }))
jest.mock('@/core/hooks/useUrlFilters', () => ({ useUrlFilters: () => ({ filters: {}, setFilter: jest.fn() }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/lib/api/entities', () => ({
  listEntityData: (...args: unknown[]) => mockListEntityData(...args),
  deleteEntityData: jest.fn(),
  duplicateEntityData: jest.fn(),
}))
jest.mock('@/core/components/entities/EntityTable', () => ({
  EntityTable: ({ data, loading }: { data: Array<{ title: string }>; loading: boolean }) => (
    <div data-testid="table">{loading ? 'SKELETON' : data.length ? data.map(row => row.title).join(',') : 'EMPTY'}</div>
  ),
}))
jest.mock('@/core/components/entities/EntityBulkActions', () => ({ EntityBulkActions: () => null }))
jest.mock('@/core/components/shared/SearchInput', () => ({ SearchInput: () => null }))
jest.mock('@/core/components/shared/MultiSelectFilter', () => ({ MultiSelectFilter: () => null }))
jest.mock('@/core/components/teams/TeamSwitchModal', () => ({ TeamSwitchModal: () => null }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
// Better Auth's React store contract: useSyncExternalStore(subscribe, get, () => store.init), init = pending, no data
jest.mock('@/core/lib/auth-client', () => {
  const { useSyncExternalStore } = jest.requireActual('react')
  const init = { data: null, error: null, isPending: true, isRefetching: false }
  let value: unknown = init
  const listeners = new Set<() => void>()
  const set = (next: unknown) => { value = next; listeners.forEach(listener => listener()) }
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) }
  const getSession = async () => {
    const response = await fetch('http://localhost/api/auth/get-session')
    const data = await response.json()
    set({ data, error: null, isPending: false, isRefetching: false })
    return { data, error: null }
  }
  return {
    authClient: {
      // The real hook starts the session request when it mounts
      useSession: () => {
        const { useEffect } = jest.requireActual('react')
        useEffect(() => { if ((value as { isPending: boolean }).isPending) void getSession() }, [])
        return useSyncExternalStore(subscribe, () => value, () => init)
      },
      getSession,
    },
  }
})

const fetchCalls: string[] = []
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }))
// Before the imports: Better Auth's client keeps the fetch it finds when it is created
global.fetch = ((input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input)
  fetchCalls.push(url)
  if (url.includes('/api/auth/get-session')) return json(SESSION)
  if (url.includes('/api/v1/teams/switch')) return json({ success: true })
  if (url.includes('/api/v1/teams')) return json({ data: [TEAM], info: { hasNextPage: false } })
  return json({})
}) as unknown as typeof fetch

import { TeamProvider } from '@/core/contexts/TeamContext'
import { useTeam } from '@/core/hooks/useTeam'
import { authClient } from '@/core/lib/auth-client'
import { EntityListWrapper } from '@/core/components/entities/wrappers/EntityListWrapper'

const SESSION = {
  session: { id: 's1', userId: 'u1', token: 't', expiresAt: '2099-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  user: { id: 'u1', email: 'u1@example.test', name: 'U', emailVerified: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
}
const TEAM = { id: 'team-1', name: 'Team 1', slug: 'team-1', userRole: 'owner', joinedAt: '2026-01-01T00:00:00Z' }
let reads = 0
// A new key per test: the list shows a page once per document (its module remembers the keys)
const page = () => ({ key: `read-${++reads}`, teamId: 'team-1', data: [{ id: 'p1', title: 'Home' }, { id: 'p2', title: 'About' }] })

/** Every render's readiness, tagged with where it ran: the server, the hydration render (before the first commit), or after. */
const readiness: string[] = []
let phase = 'server'
function ReadinessProbe() {
  const { isReady, teamId } = useTeam()
  const committed = useRef(false)
  readiness.push(`${phase === 'server' ? 'server' : committed.current ? 'after' : 'hydration'}:${isReady}:${teamId ?? '-'}`)
  useLayoutEffect(() => { committed.current = true })
  return null
}


const tree = (client: QueryClient, initialPage: ReturnType<typeof page>) => (
  <QueryClientProvider client={client}>
    <TeamProvider>
      <ReadinessProbe />
      <EntityListWrapper entityType="pages" initialPage={initialPage} />
    </TeamProvider>
  </QueryClientProvider>
)

beforeEach(() => {
  readiness.length = 0
  localStorage.clear()
  mockListEntityData.mockReset().mockResolvedValue({ data: [] })
  fetchCalls.length = 0
})

async function serverThenHydrate({ sessionAlreadyInStore }: { sessionAlreadyInStore: boolean }) {
  phase = 'server'
  const initialPage = page()
  const html = renderToString(tree(new QueryClient({ defaultOptions: { queries: { retry: false } } }), initialPage))
  if (sessionAlreadyInStore) {
    // The browser's session store answered before this part of the page hydrates (a boundary that streams in late)
    await act(async () => { await authClient.getSession() })
  }
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  const errors: unknown[] = []
  let root!: ReturnType<typeof hydrateRoot>
  phase = 'client'
  await act(async () => {
    root = hydrateRoot(container, tree(new QueryClient({ defaultOptions: { queries: { retry: false } } }), initialPage), {
      onRecoverableError: error => errors.push(error),
    })
  })
  return { html, container, errors, cleanup: () => { act(() => root.unmount()); container.remove() } }
}

test.each([false, true])('no team is known on the server nor while hydrating (session already in the store: %s)', async sessionAlreadyInStore => {
  const view = await serverThenHydrate({ sessionAlreadyInStore })
  try {
  expect(view.html).toContain('SKELETON')
  expect(view.html).not.toContain('Home')
  const server = readiness.filter(entry => entry.startsWith('server:'))
  const hydration = readiness.filter(entry => entry.startsWith('hydration:'))
  expect(server.length).toBeGreaterThan(0)
  expect(hydration.length).toBeGreaterThan(0)
  // Neither ready nor with a team (the list's rows wait for the team they were read in)
  expect([...server, ...hydration].every(entry => entry.endsWith(':false:-'))).toBe(true)
  expect(view.errors).toEqual([])
  // Then the session and the teams arrive: the team is ready, the rows show, and the list was never requested
  await waitFor(() => expect(view.container.querySelector('[data-testid="table"]')?.textContent).toBe('Home,About'))
  expect(readiness.at(-1)).toBe('after:true:team-1')
  expect(view.errors).toEqual([])
  expect(mockListEntityData).not.toHaveBeenCalled()
  expect(fetchCalls.some(url => url.includes('/api/auth/get-session'))).toBe(true)
  } finally {
    view.cleanup()
  }
})
