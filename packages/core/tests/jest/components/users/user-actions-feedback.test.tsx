/**
 * The actions on a user say what they do (verb buttons), keep their dialog open with a saving state until the API
 * answers (a failure shows in the dialog), and end in a toast that names the user and offers Undo where the API can take
 * the action back (#514).
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mockMutate = jest.fn()
const mockToast = jest.fn()
let mockPending = false
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'viewer', role: 'developer' } }, isPending: false }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next-intl', () => jest.requireActual('../../__mocks__/next-intl.js'))
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: mockMutate, isPending: mockPending }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))
jest.mock('@/core/hooks/useToast', () => ({ useToast: () => ({ toast: mockToast }) }))
jest.mock('@/core/lib/role-helpers', () => ({ useRoleTranslations: () => (r: string) => `<${r}>` }))
jest.mock('@/core/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const Item = ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <div role="menuitem" onClick={onClick}>{children}</div>
  const rest = ['DropdownMenu', 'DropdownMenuContent', 'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuTrigger',
    'DropdownMenuSub', 'DropdownMenuSubTrigger', 'DropdownMenuSubContent', 'DropdownMenuRadioGroup', 'DropdownMenuRadioItem']
  return { DropdownMenuItem: Item, ...Object.fromEntries(rest.map(name => [name, Pass])) }
})

import { UsersTable } from '@/core/components/users/tables/UsersTable'
import { undoRequest } from '@/core/components/users/tables/UserActions'

const user = (over = {}) => ({ id: 'u1', email: 'blake@x', firstName: 'Blake', lastName: 'Burton', fullName: 'Blake Burton', role: 'member', emailVerified: false, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z', ...over })

const open = (menuLabel: string, over = {}) => {
  render(<UsersTable users={[user(over)] as never} />)
  fireEvent.click(screen.getByRole('menuitem', { name: menuLabel }))
}
const confirmWith = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }))
const callbacks = () => mockMutate.mock.calls[0][1] as { onSuccess: (data: unknown) => void; onError: (e: Error) => void }

beforeEach(() => { mockMutate.mockClear(); mockToast.mockClear(); mockPending = false })

it.each([
  ['Suspend User', 'Suspend user', {}],
  ['Verify Email', 'Verify email', {}],
  ['Delete User', 'Delete user', {}],
  ['Unsuspend User', 'Unsuspend user', { role: 'suspended' }],
] as const)('the %s dialog confirms with the verb "%s", not a generic Confirm', (menu, verb, over) => {
  open(menu, over)
  expect(screen.getByRole('button', { name: verb })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()
})

it('keeps the dialog open, with its buttons disabled, while the request runs', () => {
  mockPending = true
  open('Suspend User')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Suspend user' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
})

it('does not close the dialog when confirming: it closes when the API answers', () => {
  open('Suspend User')
  confirmWith('Suspend user')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  act(() => callbacks().onSuccess({ revoked: { sessions: 2, apiKeys: 1 } }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('shows a failure inside the dialog, which stays open to try again', () => {
  open('Suspend User')
  confirmWith('Suspend user')
  act(() => callbacks().onError(new Error('Forbidden - Only a developer can modify a developer or superadmin account')))
  expect(screen.getByRole('alert')).toHaveTextContent('Only a developer can modify')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

describe('the toast after an action', () => {
  it('names the suspended user, counts what was closed, and undoes with an unsuspend', () => {
    open('Suspend User')
    confirmWith('Suspend user')
    act(() => callbacks().onSuccess({ revoked: { sessions: 2, apiKeys: 1 } }))
    const toast = mockToast.mock.calls[0][0]
    expect(toast.title).toBe('Blake Burton suspended')
    expect(toast.description).toBe('2 sessions closed and 1 API key deactivated.')
    expect(toast.action.label).toBe('Undo')
  })

  it('names the user that was verified or deleted, without Undo (the API cannot take them back)', () => {
    open('Verify Email')
    confirmWith('Verify email')
    act(() => callbacks().onSuccess({}))
    expect(mockToast.mock.calls[0][0]).toMatchObject({ title: 'Blake Burton verified', description: 'blake@x is now marked as verified.' })
    expect(mockToast.mock.calls[0][0].action).toBeUndefined()
  })

  it('the unsuspend toast says the role the user came back as, as the API answered it', () => {
    open('Unsuspend User', { role: 'suspended', roleBeforeSuspension: 'member' })
    confirmWith('Unsuspend user')
    act(() => callbacks().onSuccess({ role: 'developer' }))
    expect(mockToast.mock.calls[0][0]).toMatchObject({ title: 'Blake Burton unsuspended', description: 'Back as <developer>.' })
  })
})

describe('undoRequest', () => {
  const u = { id: 'u1', role: 'developer', email: 'x', fullName: 'X' } as never
  it('reverses what the API can reverse and nothing else', () => {
    expect(undoRequest({ type: 'suspend', user: u })).toEqual({ userId: 'u1', type: 'unsuspend' })
    expect(undoRequest({ type: 'unsuspend', user: u })).toEqual({ userId: 'u1', type: 'suspend' })
    expect(undoRequest({ type: 'change-role', user: u })).toEqual({ userId: 'u1', type: 'change-role', role: 'developer' })
    expect(undoRequest({ type: 'change-role', user: { ...u as object, role: 'member' } as never })).toEqual({ userId: 'u1', type: 'change-role', role: 'member' })
    // the API never assigns superadmin (400): there is no Undo to offer for a superadmin's role change
    expect(undoRequest({ type: 'change-role', user: { ...u as object, role: 'superadmin' } as never })).toBeNull()
    expect(undoRequest({ type: 'verify-email', user: u })).toBeNull()
    expect(undoRequest({ type: 'delete', user: u })).toBeNull()
  })
})
