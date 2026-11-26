/**
 * @jest-environment jsdom
 *
 * The list route reads the first page on the server (#574). The list shows it instead of requesting it again:
 * - the server HTML has the empty state; with rows it keeps the table skeleton (date cells depend on the time zone),
 *   and the rows appear once hydrated and the team is known, with no request and no hydration mismatch;
 * - a page read in another team than the one this browser acts in is not shown: the list requests its own;
 * - it is shown once: the same page again (the router cache restoring the document's payload) is requested as before.
 */
import React, { useLayoutEffect } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { EntityListFirstPage } from '@/core/lib/api/entity/list-first-page'

const mockUseTeam = jest.fn()
/** What the table showed in every commit (a layout effect runs once per commit, before the browser paints). */
const mockCommits: string[] = []
const mockListEntityData = jest.fn()

const CONFIG = {
  slug: 'pages',
  enabled: true,
  names: { singular: 'Page', plural: 'Pages' },
  access: {},
  ui: { dashboard: { filters: [], columns: [] }, features: { bulkOperations: false } },
  fields: [],
}

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/pages' }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false }) }))
jest.mock('@/core/hooks/useEntityConfig', () => ({ useEntityConfig: () => ({ config: CONFIG, isLoading: false, error: null }) }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => mockUseTeam() }))
jest.mock('@/core/hooks/useUrlFilters', () => ({ useUrlFilters: () => ({ filters: {}, setFilter: jest.fn() }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/lib/api/entities', () => ({
  listEntityData: (...args: unknown[]) => mockListEntityData(...args),
  deleteEntityData: jest.fn(),
  duplicateEntityData: jest.fn(),
}))
// What the table shows: the skeleton, the empty state or the rows
jest.mock('@/core/components/entities/EntityTable', () => ({
  EntityTable: function MockTable({ data, loading }: { data: Array<{ title: string }>; loading: boolean }) {
    const shown = loading ? 'SKELETON' : data.length ? data.map(row => row.title).join(',') : 'EMPTY'
    useLayoutEffect(() => { mockCommits.push(shown) })
    return <div data-testid="table">{shown}</div>
  },
}))
jest.mock('@/core/components/entities/EntityBulkActions', () => ({ EntityBulkActions: () => null }))
jest.mock('@/core/components/shared/SearchInput', () => ({ SearchInput: () => null }))
jest.mock('@/core/components/shared/MultiSelectFilter', () => ({ MultiSelectFilter: () => null }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import { EntityListWrapper } from '@/core/components/entities/wrappers/EntityListWrapper'

let n = 0
const page = (data: Array<Record<string, unknown>>, teamId = 'team-1'): EntityListFirstPage => ({ key: `read-${++n}`, teamId, data })
const ROWS = [{ id: 'p1', title: 'Home' }, { id: 'p2', title: 'About' }]

/**
 * Server-render the list, then hydrate that HTML as the browser does. The team is not ready in either render, as with the real
 * TeamProvider (EntityList.server-first-page.real-team.test.tsx), and becomes ready (in `teamId`) after, unless `teamId` is null.
 */
async function hydrate(initialPage: EntityListFirstPage, teamId: string | null = 'team-1') {
  mockUseTeam.mockReturnValue({ teamId: undefined, isReady: false })
  const container = document.createElement('div')
  container.innerHTML = renderToString(<EntityListWrapper entityType="pages" initialPage={initialPage} />)
  document.body.appendChild(container)
  const errors: unknown[] = []
  let root!: ReturnType<typeof hydrateRoot>
  await act(async () => {
    root = hydrateRoot(container, <EntityListWrapper entityType="pages" initialPage={initialPage} />, { onRecoverableError: error => errors.push(error) })
  })
  const table = () => container.querySelector('[data-testid="table"]')?.textContent
  const rerender = async () => act(async () => root.render(<EntityListWrapper entityType="pages" initialPage={initialPage} />))
  if (teamId) {
    mockUseTeam.mockReturnValue({ teamId, isReady: true })
    await rerender()
  }
  return { table, errors, rerender, cleanup: () => { act(() => root.unmount()); container.remove() } }
}

beforeEach(() => {
  mockCommits.length = 0
  mockListEntityData.mockReset().mockResolvedValue({ data: [{ id: 'x', title: 'Fetched' }] })
  mockUseTeam.mockReturnValue({ teamId: 'team-1', isReady: true })
})

describe('server HTML (the team is never ready on the server)', () => {
  beforeEach(() => mockUseTeam.mockReturnValue({ teamId: undefined, isReady: false }))

  test('an empty first page is the empty state', () => {
    expect(renderToString(<EntityListWrapper entityType="pages" initialPage={page([])} />)).toContain('EMPTY')
  })

  test('rows stay behind the skeleton (their date cells are formatted in the time zone of whoever renders)', () => {
    const html = renderToString(<EntityListWrapper entityType="pages" initialPage={page(ROWS)} />)
    expect(html).toContain('SKELETON')
    expect(html).not.toContain('Home')
  })

  test('without a server page it is the skeleton, as before', () => {
    expect(renderToString(<EntityListWrapper entityType="pages" />)).toContain('SKELETON')
  })
})

test('hydrating shows the rows without a request or a mismatch', async () => {
  const view = await hydrate(page(ROWS))
  expect(view.table()).toBe('Home,About')
  expect(view.errors).toEqual([])
  expect(mockListEntityData).not.toHaveBeenCalled()
  view.cleanup()
})

test('hydrating an empty page keeps the empty state, with no request', async () => {
  const view = await hydrate(page([]))
  expect(view.table()).toBe('EMPTY')
  expect(mockListEntityData).not.toHaveBeenCalled()
  view.cleanup()
})

test('rows wait for the team: skeleton until it is known, then the rows read in that team, with no request', async () => {
  const view = await hydrate(page(ROWS), null)
  expect(view.table()).toBe('SKELETON')
  expect(view.errors).toEqual([])
  mockUseTeam.mockReturnValue({ teamId: 'team-1', isReady: true })
  await view.rerender()
  expect(view.table()).toBe('Home,About')
  expect(mockListEntityData).not.toHaveBeenCalled()
  view.cleanup()
})

test('a page read in another team is replaced by the list of this team', async () => {
  const view = await hydrate(page(ROWS, 'team-2'))
  await waitFor(() => expect(view.table()).toBe('Fetched'))
  expect(mockListEntityData).toHaveBeenCalledTimes(1)
  view.cleanup()
})

test('rendered on the client (a boundary React renders again instead of hydrating), the page is shown at once with no request', async () => {
  render(<EntityListWrapper entityType="pages" initialPage={page(ROWS)} />)
  expect(screen.getByTestId('table').textContent).toBe('Home,About')
  await act(async () => {})
  expect(mockListEntityData).not.toHaveBeenCalled()
})

test('the same page again (the router cache restoring the payload on back/forward) is requested as before', async () => {
  const first = page([])
  const { unmount } = render(<EntityListWrapper entityType="pages" initialPage={first} />)
  await act(async () => {})
  unmount()
  render(<EntityListWrapper entityType="pages" initialPage={first} />)
  expect(screen.getByTestId('table').textContent).toBe('SKELETON')
  await waitFor(() => expect(screen.getByTestId('table').textContent).toBe('Fetched'))
  expect(mockListEntityData).toHaveBeenCalledTimes(1)
})

test('the placeholder (the route boundary fallback) shows the skeleton and requests nothing', async () => {
  render(<EntityListWrapper entityType="pages" placeholder />)
  await act(async () => {})
  expect(screen.getByTestId('table').textContent).toBe('SKELETON')
  expect(mockListEntityData).not.toHaveBeenCalled()
})

describe('the rows of another team are never committed, not even for one commit', () => {
  test('hydrated before the team is known, then the team turns out to be another one', async () => {
    const view = await hydrate(page(ROWS, 'team-2'))
    await waitFor(() => expect(view.table()).toBe('Fetched'))
    expect(mockCommits).not.toContain('Home,About')
    view.cleanup()
  })

  test('rendered on the client with the team already known and another one', async () => {
    render(<EntityListWrapper entityType="pages" initialPage={page(ROWS, 'team-2')} />)
    await waitFor(() => expect(screen.getByTestId('table').textContent).toBe('Fetched'))
    expect(mockCommits).not.toContain('Home,About')
  })

  test('the same team: the rows are committed with no request', async () => {
    render(<EntityListWrapper entityType="pages" initialPage={page(ROWS)} />)
    await act(async () => {})
    expect(mockCommits).toContain('Home,About')
    expect(mockListEntityData).not.toHaveBeenCalled()
  })
})
