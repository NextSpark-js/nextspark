/**
 * Users and teams link to each other: the Users table has a Teams column (the first teams linked, the rest counted),
 * the Teams table links the owner to their user page and has a Plan column (#521).
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'

jest.mock('next-intl', () => jest.requireActual('../../__mocks__/next-intl.js'))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'viewer', role: 'developer' } }, isPending: false }) }))
jest.mock('@/core/components/users/tables/UserActions', () => ({ useUserActions: () => ({ dialog: null }), UserActionsMenu: () => null }))

import { UsersTable } from '@/core/components/users/tables/UsersTable'
import { TeamsTable } from '@/core/components/superadmin/tables/TeamsTable'

const user = (id: string, over = {}) => ({ id, email: `${id}@x`, firstName: id, lastName: '', fullName: id, role: 'member', emailVerified: true, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z', ...over })
const row = (id: string) => within(screen.getByText(id, { selector: 'a' }).closest('tr')!)

describe('Users: Teams column', () => {
  it('links the first teams to their page and counts the rest', () => {
    render(<UsersTable users={[user('u', { teamCount: 5, teams: [{ id: 't1', name: 'Acme' }, { id: 't2', name: 'Beta' }, { id: 't3', name: 'Gamma' }] })] as never} />)
    expect(row('u').getByRole('link', { name: 'Acme' })).toHaveAttribute('href', '/superadmin/teams/t1')
    expect(row('u').getByRole('link', { name: 'Beta' })).toHaveAttribute('href', '/superadmin/teams/t2')
    expect(row('u').queryByRole('link', { name: 'Gamma' })).toBeNull()
    expect(row('u').getByRole('link', { name: '+3 more' })).toHaveAttribute('href', '/superadmin/users/u')
  })

  it('shows a dash for a user in no team and no "more" when every team is shown', () => {
    render(<UsersTable users={[user('none', { teamCount: 0, teams: [] }), user('one', { teamCount: 1, teams: [{ id: 't1', name: 'Acme' }] })] as never} />)
    expect(row('none').getByText('—')).toBeInTheDocument()
    expect(row('one').queryByText(/more/)).toBeNull()
  })
})

describe('Teams: Plan column and owner link', () => {
  const team = (id: string, over = {}) => ({ id, name: `Team ${id}`, owner: { id: 'o1', name: 'Olive Owner', email: 'o@x' }, memberCount: 2, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z', ...over })

  it('shows the plan of the newest subscription, its status when it is not active, or No plan', () => {
    render(<TeamsTable teams={[team('a', { plan: { name: 'Pro', slug: 'pro', status: 'active' } }), team('b', { plan: { name: 'Pro', slug: 'pro', status: 'past_due' } }), team('c', { plan: null })] as never} />)
    expect(row('Team a').getByText('Pro')).toBeInTheDocument()
    expect(row('Team a').queryByText('active')).toBeNull()
    expect(row('Team b').getByText('Past Due')).toBeInTheDocument()
    expect(row('Team b').queryByText('past_due')).toBeNull()
    expect(row('Team c').getByText('No plan')).toBeInTheDocument()
  })

  it('links the owner to their user page and the team to its own', () => {
    render(<TeamsTable teams={[team('a')] as never} />)
    expect(row('Team a').getByRole('link', { name: 'Olive Owner' })).toHaveAttribute('href', '/superadmin/users/o1')
    expect(row('Team a').getByRole('link', { name: 'Team a' })).toHaveAttribute('href', '/superadmin/teams/a')
  })
})
