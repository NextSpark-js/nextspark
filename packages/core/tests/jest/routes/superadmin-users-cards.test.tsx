/**
 * /superadmin/users: the summary cards show the totals of all users whatever the search says ("1 of 85 match" when it
 * narrows), and Work Teams is the real count, linked to Teams (#516).
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const data = {
  regularUsers: [], superadmins: [],
  counts: {
    total: 85, regularUsers: 83, superadmins: 2, matching: { total: 1, regularUsers: 1, superadmins: 0 }, workTeams: 6, teams: 7,
    byRole: { member: 70, developer: 13 }, statusDistribution: { active: 82, suspended: 3, verified: 80, unverified: 5 }, teamRoleDistribution: {},
  },
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
  filters: { search: '', role: '', status: '', tab: 'users' },
  metadata: { requestedBy: 'sa', requestedAt: '2026-11-10T12:00:00Z', source: 'superadmin-api' },
}

// the screens keep their state in the URL (#519)
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }), usePathname: () => '/area', useSearchParams: () => new URLSearchParams() }))
jest.mock('next-intl', () => jest.requireActual('../__mocks__/next-intl.js'))
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data, isLoading: false, error: null, refetch: jest.fn() }) }))
jest.mock('@nextsparkjs/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'sa' } } }) }))
jest.mock('@nextsparkjs/core/components/users/tables/UsersTable', () => ({ UsersTable: () => null }))
jest.mock('@nextsparkjs/core/components/users/tables/SuperAdminsTable', () => ({ SuperAdminsTable: () => null }))
jest.mock('@nextsparkjs/core/components/superadmin/filters', () => ({
  SearchInput: ({ onChange }: { onChange: (v: string) => void }) => <button onClick={() => onChange('zzz')}>search</button>,
  PaginationControls: () => null,
  FilterDropdown: () => null,
}))
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))

import UsersPage from '../../../src/routes/superadmin/users/page'

const card = (title: string) => screen.getByText(title).parentElement!.parentElement as HTMLElement

it('shows the totals of all users and the real number of work teams, linked to Teams', () => {
  render(<UsersPage />)
  expect(card('Total Users')).toHaveTextContent('85')
  expect(card('Superadmins')).toHaveTextContent('2')
  expect(card('Work Teams')).toHaveTextContent('6')
  expect(screen.getByText('Work Teams').closest('a')).toHaveAttribute('href', '/superadmin/teams')
})

it('keeps the totals when the search narrows the list, and says how many match', () => {
  render(<UsersPage />)
  fireEvent.click(screen.getByText('search'))
  expect(card('Total Users')).toHaveTextContent('85')
  expect(card('Total Users')).toHaveTextContent('1 of 85 match')
  expect(card('Superadmins')).toHaveTextContent('0 of 2 match')
})
