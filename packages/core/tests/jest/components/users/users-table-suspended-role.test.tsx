/**
 * A suspended user's role cell shows the catalog label; a role with no display name shows its own name, and neither
 * reaches t() with undefined (#489).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'viewer', role: 'superadmin' } }, isPending: false }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
// the English catalog; its t() throws on a missing key, as next-intl reports MISSING_MESSAGE
jest.mock('next-intl', () => jest.requireActual('../../__mocks__/next-intl.js'))
jest.mock('@tanstack/react-query', () => ({ useMutation: () => ({ mutate: jest.fn(), isPending: false }), useQueryClient: () => ({}) }))
jest.mock('@/core/hooks/useToast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@/core/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const Item = ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <div onClick={onClick}>{children}</div>
  const rest = ['DropdownMenu', 'DropdownMenuContent', 'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuTrigger',
    'DropdownMenuSub', 'DropdownMenuSubTrigger', 'DropdownMenuSubContent', 'DropdownMenuRadioGroup', 'DropdownMenuRadioItem']
  return { DropdownMenuItem: Item, ...Object.fromEntries(rest.map(name => [name, Pass])) }
})

import { UsersTable } from '@/core/components/users/tables/UsersTable'
import { getRoleDisplayName } from '@/core/lib/role-helpers'

const user = (id: string, r: string) => ({ id, email: `${id}@x`, firstName: id, lastName: '', role: r, emailVerified: true, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' })

it('renders the Suspended label for a suspended user without a missing message', () => {
  render(<UsersTable users={[user('s', 'suspended'), user('m', 'member')] as never} />)
  expect(screen.getAllByText('Suspended').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Member').length).toBeGreaterThan(0)
})

it('getRoleDisplayName gives a role with no display name its own name and never calls t(undefined)', () => {
  const t = jest.fn((key: string) => `T(${key})`)
  expect(getRoleDisplayName('suspended' as never, t)).toBe('T(superadmin.usersPage.roles.suspended)')
  expect(getRoleDisplayName('custom' as never, t)).toBe('custom')
  expect(t).not.toHaveBeenCalledWith(undefined)
})
