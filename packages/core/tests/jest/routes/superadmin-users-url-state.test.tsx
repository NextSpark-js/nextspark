/**
 * /superadmin/users keeps its tab, search, filters, sort, page and page size in the URL (#519): the list is asked for
 * what the query says (a value that is not valid is the default), and a change writes the query with router.replace,
 * going back to page 1 when it narrows the list.
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mockReplace = jest.fn()
let mockSearch = ''
const mockQueryKeys: unknown[][] = []
const data = {
  regularUsers: [], superadmins: [],
  counts: { total: 1, regularUsers: 1, superadmins: 0, matching: { total: 1, regularUsers: 1, superadmins: 0 }, workTeams: 0, byRole: {}, statusDistribution: {}, teamRoleDistribution: {} },
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
  filters: { search: '', role: '', status: '', tab: 'users' },
  metadata: { requestedBy: 'sa', requestedAt: '2026-11-10T12:00:00Z', source: 'superadmin-api' },
}

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }), usePathname: () => '/superadmin/users', useSearchParams: () => new URLSearchParams(mockSearch) }))
jest.mock('next-intl', () => jest.requireActual('../__mocks__/next-intl.js'))
jest.mock('@tanstack/react-query', () => ({
  keepPreviousData: undefined,
  useQuery: (options: { queryKey: unknown[] }) => { mockQueryKeys.push(options.queryKey); return { data, isLoading: false, error: null, refetch: jest.fn() } },
}))
jest.mock('@nextsparkjs/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'sa' } } }) }))
jest.mock('@nextsparkjs/core/components/users/tables/UsersTable', () => ({
  UsersTable: ({ sort, onSortChange }: { sort: { key: string; order: string }; onSortChange: (s: unknown) => void }) => (
    <button onClick={() => onSortChange({ key: 'email', order: 'asc' })}>sort:{sort.key}:{sort.order}</button>
  ),
}))
jest.mock('@nextsparkjs/core/components/users/tables/SuperAdminsTable', () => ({ SuperAdminsTable: () => null }))
jest.mock('@nextsparkjs/core/components/superadmin/filters', () => ({
  SearchInput: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <button onClick={() => onChange('zzz')}>search:{value}</button>,
  PaginationControls: ({ onPageChange }: { onPageChange: (p: number) => void }) => <button onClick={() => onPageChange(4)}>page4</button>,
  FilterDropdown: () => null,
}))
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))

import UsersPage from '../../../src/routes/superadmin/users/page'

const lastKey = () => mockQueryKeys[mockQueryKeys.length - 1]

beforeEach(() => {
  jest.useFakeTimers()
  mockSearch = ''
  mockReplace.mockClear()
  mockQueryKeys.length = 0
})
afterEach(() => jest.useRealTimers())

it('asks for what the URL says', () => {
  mockSearch = 'tab=superadmins&search=ana&status=suspended&sort=email&order=asc&page=3&limit=50'
  render(<UsersPage />)
  // [name, search, role, status, tab, page, limit, sort]
  expect(lastKey()).toEqual(['superadmin-users', 'ana', '', 'suspended', 'superadmins', 3, 50, { key: 'email', order: 'asc' }])
  expect(screen.getByText('search:ana')).toBeTruthy()
})

it('takes the default for a value that is not valid', () => {
  mockSearch = 'tab=nope&status=zzz&sort=password&order=up&page=-2&limit=7'
  render(<UsersPage />)
  expect(lastKey()).toEqual(['superadmin-users', '', '', '', 'users', 1, 20, { key: 'createdAt', order: 'desc' }])
  act(() => { jest.advanceTimersByTime(1000) })
  expect(mockReplace).not.toHaveBeenCalled()
})

it('writes the search to the URL and goes back to page 1', () => {
  mockSearch = 'page=3'
  render(<UsersPage />)
  fireEvent.click(screen.getByText('search:'))
  act(() => { jest.advanceTimersByTime(400) })
  expect(mockReplace).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledWith('/superadmin/users?search=zzz', { scroll: false })
})

it('writes the sort and the page, and keeps the rest', () => {
  mockSearch = 'status=active'
  render(<UsersPage />)
  fireEvent.click(screen.getByText('sort:createdAt:desc'))
  act(() => { jest.advanceTimersByTime(400) })
  expect(mockReplace).toHaveBeenLastCalledWith('/superadmin/users?status=active&sort=email&order=asc', { scroll: false })
  fireEvent.click(screen.getAllByText('page4')[0])
  act(() => { jest.advanceTimersByTime(400) })
  expect(mockReplace).toHaveBeenLastCalledWith('/superadmin/users?status=active&sort=email&order=asc&page=4', { scroll: false })
})
