/**
 * The superadmin users table offers the developer role only to a developer: only a developer grants it.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

let role = 'superadmin'
let viewerId = 'viewer'
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: viewerId, role } }, isPending: false }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
// the table reads its texts from the English catalog
jest.mock('next-intl', () => jest.requireActual('../../__mocks__/next-intl.js'))
jest.mock('@tanstack/react-query', () => ({ useMutation: () => ({ mutate: jest.fn(), isPending: false }), useQueryClient: () => ({}) }))
jest.mock('@/core/hooks/useToast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@/core/lib/role-helpers', () => ({ useRoleTranslations: () => (r: string) => r }))
jest.mock('@/core/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return Object.fromEntries(['DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuTrigger',
    'DropdownMenuSub', 'DropdownMenuSubTrigger', 'DropdownMenuSubContent', 'DropdownMenuRadioGroup', 'DropdownMenuRadioItem'].map(name => [name, Pass]))
})

import { UsersTable } from '@/core/components/users/tables/UsersTable'

const user = (id: string, r: string) => ({ id, email: `${id}@x`, firstName: id, lastName: '', role: r, emailVerified: true, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' })

it.each([['developer', 1], ['superadmin', 0]] as const)('as a %s, the developer role is offered for a member: %i', (r, offered) => {
  role = r
  render(<UsersTable users={[user('m', 'member')] as never} />)
  expect(screen.queryAllByText('Developer')).toHaveLength(offered)
})

// A superadmin has no role to give (member is the only one, and superadmin is never assigned through the API): the row
// says that only a developer changes roles, not a Change Role submenu with only the current role in it (#433)
it.each([['superadmin', false], ['developer', true]] as const)('as a %s, a member row offers Change Role: %s', (r, offered) => {
  role = r
  render(<UsersTable users={[user('m', 'member')] as never} />)
  expect(screen.queryAllByText('Change Role')).toHaveLength(offered ? 1 : 0)
  expect(screen.queryAllByText('Only a developer can change roles')).toHaveLength(offered ? 0 : 1)
})

describe('actions on a row follow the API rule (canActOnUser)', () => {
  const menu = ['Verify Email', 'Suspend User', 'Delete User']
  const unverified = (id: string, r: string) => ({ ...user(id, r), emailVerified: false })

  it.each([
    ['superadmin', 'member', true],
    ['developer', 'member', true],
    ['developer', 'developer', true],
    ['superadmin', 'developer', false],
    ['superadmin', 'superadmin', false],
    ['developer', 'superadmin', true],
  ] as const)('as a %s, the actions on a %s are shown: %s', (r, target, shown) => {
    role = r
    render(<UsersTable users={[unverified('t', target)] as never} />)
    for (const label of menu) expect(screen.queryAllByText(label)).toHaveLength(shown ? 1 : 0)
    expect(screen.queryAllByText('Only a developer can modify this account')).toHaveLength(shown ? 0 : 1)
    expect(screen.queryAllByText('You cannot change your own account here')).toHaveLength(0)
    expect(screen.getAllByText('View Profile')).toHaveLength(1)
  })

  it.each(['superadmin', 'developer'])('as a %s, a suspended member has no Change Role (the API answers 400), but unsuspend, verify and delete', (r) => {
    role = r
    render(<UsersTable users={[unverified('s', 'suspended')] as never} />)
    expect(screen.queryAllByText('Change Role')).toHaveLength(0)
    expect(screen.queryAllByText('Developer')).toHaveLength(0)
    for (const label of ['Unsuspend User', 'Verify Email', 'Delete User']) expect(screen.getAllByText(label)).toHaveLength(1)
    expect(screen.queryAllByText('Suspend User')).toHaveLength(0)
  })

  it('shows no actions on the viewer own row', () => {
    role = 'developer'
    viewerId = 'me'
    render(<UsersTable users={[user('me', 'developer')] as never} />)
    expect(screen.queryAllByText('Delete User')).toHaveLength(0)
    expect(screen.getByText('You cannot change your own account here')).toBeTruthy()
    expect(screen.queryAllByText('Only a developer can modify this account')).toHaveLength(0)
    viewerId = 'viewer'
  })
})
