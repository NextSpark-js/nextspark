/**
 * The superadmin users table offers the developer role only to a developer: only a developer grants it.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

let role = 'superadmin'
let viewerId = 'viewer'
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: viewerId, role } }, isPending: false }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
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

describe('actions on a row follow the API rule (canActOnUser)', () => {
  const menu = ['Change Role', 'Verify Email', 'Suspend User', 'Delete User']
  const unverified = (id: string, r: string) => ({ ...user(id, r), emailVerified: false })

  it.each([
    ['superadmin', 'member', true],
    ['developer', 'member', true],
    ['developer', 'developer', true],
    ['superadmin', 'developer', false],
    ['superadmin', 'superadmin', false],
    ['developer', 'superadmin', false],
  ] as const)('as a %s, the actions on a %s are shown: %s', (r, target, shown) => {
    role = r
    render(<UsersTable users={[unverified('t', target)] as never} />)
    for (const label of menu) expect(screen.queryAllByText(label)).toHaveLength(shown ? 1 : 0)
    expect(screen.queryAllByText('restrictedTarget')).toHaveLength(shown ? 0 : 1)
    expect(screen.getAllByText('View Profile')).toHaveLength(1)
  })

  it('offers unsuspend on a suspended member to a superadmin', () => {
    role = 'superadmin'
    render(<UsersTable users={[user('s', 'suspended')] as never} />)
    expect(screen.getByText('Unsuspend User')).toBeTruthy()
  })

  it('shows no actions on the viewer own row', () => {
    role = 'developer'
    viewerId = 'me'
    render(<UsersTable users={[user('me', 'developer')] as never} />)
    expect(screen.queryAllByText('Delete User')).toHaveLength(0)
    expect(screen.getByText('restrictedTarget')).toBeTruthy()
    viewerId = 'viewer'
  })
})
