/**
 * Changing a user's role asks for confirmation like suspend, unsuspend, verify and delete do, and granting the developer
 * role (which outranks superadmin) is confirmed with a destructive button (#513).
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockMutate = jest.fn()
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'viewer', role: 'developer' } }, isPending: false }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next-intl', () => jest.requireActual('../../__mocks__/next-intl.js'))
jest.mock('@tanstack/react-query', () => ({ useMutation: () => ({ mutate: mockMutate, isPending: false }), useQueryClient: () => ({}) }))
jest.mock('@/core/hooks/useToast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@/core/lib/role-helpers', () => ({ useRoleTranslations: () => (r: string) => `<${r}>` }))
jest.mock('@/core/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const Item = ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <div onClick={onClick}>{children}</div>
  // a radio group tells its items how to report the value
  const Group = ({ children, onValueChange }: { children?: React.ReactNode; onValueChange?: (v: string) => void }) => (
    <div>{React.Children.map(children, c => React.cloneElement(c as React.ReactElement<{ onPick?: (v: string) => void }>, { onPick: onValueChange }))}</div>
  )
  const Radio = ({ children, value, onPick }: { children?: React.ReactNode; value: string; onPick?: (v: string) => void }) => (
    <div role="menuitemradio" onClick={() => onPick?.(value)}>{children}</div>
  )
  const rest = ['DropdownMenu', 'DropdownMenuContent', 'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuTrigger',
    'DropdownMenuSub', 'DropdownMenuSubTrigger', 'DropdownMenuSubContent']
  return { DropdownMenuItem: Item, DropdownMenuRadioGroup: Group, DropdownMenuRadioItem: Radio, ...Object.fromEntries(rest.map(name => [name, Pass])) }
})

import { UsersTable } from '@/core/components/users/tables/UsersTable'

const member = { id: 'm', email: 'm@x', firstName: 'Blake', lastName: 'Burton', fullName: 'Blake Burton', role: 'member', emailVerified: true, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' }

beforeEach(() => mockMutate.mockClear())

it('picking a role opens a confirmation and changes nothing until it is confirmed', () => {
  render(<UsersTable users={[member] as never} />)
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Developer' }))
  expect(mockMutate).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toHaveTextContent('Change Blake Burton from <member> to <developer>?')
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(mockMutate).toHaveBeenCalledTimes(1)
  expect(mockMutate.mock.calls[0][0]).toEqual({ userId: 'm', type: 'change-role', role: 'developer' })
})

it('cancelling the dialog changes nothing', () => {
  render(<UsersTable users={[member] as never} />)
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Developer' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(mockMutate).not.toHaveBeenCalled()
})

it('granting developer warns and uses the destructive button; going back to member does not', () => {
  const { rerender } = render(<UsersTable users={[member] as never} />)
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Developer' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('outranks superadmins')
  expect(screen.getByRole('button', { name: 'Confirm' }).className).toContain('bg-destructive')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

  rerender(<UsersTable users={[{ ...member, role: 'developer' }] as never} />)
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Member' }))
  expect(screen.getByRole('dialog')).not.toHaveTextContent('outranks')
  expect(screen.getByRole('button', { name: 'Confirm' }).className).not.toContain('bg-destructive')
})

it('picking the role the user already has opens nothing', () => {
  render(<UsersTable users={[member] as never} />)
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Member' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})
