/**
 * The superadmin users table offers the developer role only to a developer: only a developer grants it.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

let role = 'superadmin'
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { role } }, isPending: false }) }))
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
