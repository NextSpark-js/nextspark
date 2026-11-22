/**
 * /superadmin/users/[userId]: the header has the actions menu of the users table (and its dialogs), the Active or
 * Suspended status next to the role the user has, and their last session (#520).
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mockPush = jest.fn()
const mockRefetch = jest.fn()
const mockMutate = jest.fn()
let mockUser: Record<string, unknown>
jest.mock('next/navigation', () => ({ useParams: () => ({ userId: 'u1' }), useRouter: () => ({ push: mockPush }) }))
jest.mock('next-intl', () => jest.requireActual('../__mocks__/next-intl.js'))
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { user: mockUser, teams: [], userMetas: [], stats: { totalTeams: 0, ownedTeams: 0 }, metadata: { requestedBy: 'sa', requestedAt: '2026-11-10T12:00:00Z', source: 'superadmin-api' } },
    isLoading: false, error: null, refetch: mockRefetch,
  }),
  useMutation: () => ({ mutate: mockMutate, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))
jest.mock('@nextsparkjs/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'viewer', role: 'developer' } }, isPending: false }) }))
jest.mock('@nextsparkjs/core/hooks/useToast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@nextsparkjs/core/lib/role-helpers', () => ({ useRoleTranslations: () => (r: string) => `<${r}>` }))
jest.mock('@nextsparkjs/core/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const Item = ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <div role="menuitem" onClick={onClick}>{children}</div>
  const rest = ['DropdownMenu', 'DropdownMenuContent', 'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuTrigger',
    'DropdownMenuSub', 'DropdownMenuSubTrigger', 'DropdownMenuSubContent', 'DropdownMenuRadioGroup', 'DropdownMenuRadioItem']
  return { DropdownMenuItem: Item, ...Object.fromEntries(rest.map(name => [name, Pass])) }
})
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))

import UserDetailPage from '../../../src/routes/superadmin/users/[userId]/page'

const base = { id: 'u1', firstName: 'Blake', lastName: 'Burton', fullName: 'Blake Burton', email: 'blake@x', role: 'member', emailVerified: true, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z', lastSessionAt: null }

beforeEach(() => { mockPush.mockClear(); mockRefetch.mockClear(); mockMutate.mockClear(); mockUser = base })

it('has the actions of the table in the header, without View Profile (this is the profile)', () => {
  render(<UserDetailPage />)
  for (const label of ['Change Role', 'Suspend User', 'Delete User']) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
  expect(screen.queryByText('View Profile')).toBeNull()
})

it('a suspended developer shows Developer and Suspended, and offers Unsuspend instead of Suspend', () => {
  mockUser = { ...base, role: 'suspended', roleBeforeSuspension: 'developer' }
  render(<UserDetailPage />)
  expect(screen.getByText('Developer')).toBeInTheDocument()
  expect(screen.getByText('Suspended')).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Unsuspend User' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Suspend User' })).toBeNull()
})

it('shows the last session, or says there is none', () => {
  const { unmount } = render(<UserDetailPage />)
  expect(document.querySelector('[data-cy="superadmin-user-last-session"]')).toHaveTextContent('No session on record')
  unmount()
  mockUser = { ...base, lastSessionAt: '2026-11-09T15:30:00Z' }
  render(<UserDetailPage />)
  expect(document.querySelector('[data-cy="superadmin-user-last-session"]')).not.toHaveTextContent('No session on record')
  expect(document.querySelector('[data-cy="superadmin-user-last-session"]')).toHaveTextContent('2026')
})

it('after a delete goes back to the list, and after any other action reloads the user', () => {
  render(<UserDetailPage />)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete User' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete user' }))
  act(() => (mockMutate.mock.calls[0][1] as { onSuccess: (d: unknown) => void }).onSuccess({}))
  expect(mockPush).toHaveBeenCalledWith('/superadmin/users')
  expect(mockRefetch).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('menuitem', { name: 'Suspend User' }))
  fireEvent.click(screen.getByRole('button', { name: 'Suspend user' }))
  act(() => (mockMutate.mock.calls[1][1] as { onSuccess: (d: unknown) => void }).onSuccess({}))
  expect(mockRefetch).toHaveBeenCalledTimes(1)
})
