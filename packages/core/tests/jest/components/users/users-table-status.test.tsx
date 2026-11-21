/**
 * The users table tells the account (Active or Suspended) from the email (verified or pending), and the Role column
 * always shows the role the user has, or comes back with when suspended (#515).
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'

jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'viewer', role: 'developer' } }, isPending: false }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next-intl', () => jest.requireActual('../../__mocks__/next-intl.js'))
jest.mock('@tanstack/react-query', () => ({ useMutation: () => ({ mutate: jest.fn(), isPending: false }), useQueryClient: () => ({}) }))
jest.mock('@/core/hooks/useToast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@/core/components/users/tables/UserActions', () => ({ useUserActions: () => ({ dialog: null }), UserActionsMenu: () => null }))

import { UsersTable } from '@/core/components/users/tables/UsersTable'

const user = (id: string, over = {}) => ({ id, email: `${id}@x`, firstName: id, lastName: '', fullName: id, role: 'member', emailVerified: true, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z', ...over })
const cells = (id: string) => within(screen.getByText(id, { selector: '.font-medium' }).closest('tr')!).getAllByRole('cell')

it('a suspended developer shows Developer as the role and Suspended as the status', () => {
  render(<UsersTable users={[user('s', { role: 'suspended', roleBeforeSuspension: 'developer' })] as never} />)
  const [, , role, status] = cells('s')
  expect(role).toHaveTextContent('Developer')
  expect(role).not.toHaveTextContent('Suspended')
  expect(status).toHaveTextContent('Suspended')
  expect(status).not.toHaveTextContent('Active')
})

it('a suspended user stored before the role was kept comes back as a member', () => {
  render(<UsersTable users={[user('s', { role: 'suspended', roleBeforeSuspension: null })] as never} />)
  expect(cells('s')[2]).toHaveTextContent('Member')
})

it('an active member is Active, with the email verification apart', () => {
  render(<UsersTable users={[user('a'), user('p', { emailVerified: false })] as never} />)
  expect(cells('a')[3]).toHaveTextContent('Active')
  expect(cells('a')[3]).toHaveTextContent('Verified')
  expect(cells('p')[3]).toHaveTextContent('Active')
  expect(cells('p')[3]).toHaveTextContent('Pending')
})

it('a suspended user whose email is pending shows both', () => {
  render(<UsersTable users={[user('s', { role: 'suspended', emailVerified: false })] as never} />)
  expect(cells('s')[3]).toHaveTextContent('Suspended')
  expect(cells('s')[3]).toHaveTextContent('Pending')
})
