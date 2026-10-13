/**
 * Nobody acts on another superadmin (the API answers 403), so no viewer is offered "Revoke Admin" on a superadmin row.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

let role = 'superadmin'
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'me', role } }, isPending: false }) }))
jest.mock('@/core/lib/role-helpers', () => ({ useRoleTranslations: () => (r: string) => r }))
jest.mock('@/core/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return Object.fromEntries(['DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuTrigger'].map(n => [n, Pass]))
})

import { SuperAdminsTable } from '@/core/components/users/tables/SuperAdminsTable'

const admin = (id: string) => ({ id, email: `${id}@x`, firstName: id, lastName: '', role: 'superadmin', createdAt: '2026-10-13T00:00:00Z' })

it.each(['superadmin', 'developer'])('as a %s, "Revoke Admin" is not offered on another superadmin', (r) => {
  role = r
  render(<SuperAdminsTable superadmins={[admin('me'), admin('other')] as never} currentUserId="me" />)
  expect(screen.queryAllByText('Revoke Admin')).toHaveLength(0)
})
