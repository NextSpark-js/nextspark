/**
 * The superadmins table offers demote, suspend and delete on another superadmin only to a developer (canActOnUser:
 * the API answers 403 to anyone else), never on the viewer's own row, and the actions call the superadmin users route.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

let role = 'superadmin'
const mutate = jest.fn()
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'me', role } }, isPending: false }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/hooks/useToast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@tanstack/react-query', () => ({
  // run the mutation function for real, so the test sees the request
  useMutation: ({ mutationFn }: { mutationFn: (v: unknown) => Promise<unknown> }) => ({ mutate: (v: unknown) => { mutate(v); void mutationFn(v) }, isPending: false }),
}))
jest.mock('@/core/lib/role-helpers', () => ({ useRoleTranslations: () => (r: string) => r }))
jest.mock('@/core/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const Item = ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>
  return { DropdownMenu: Pass, DropdownMenuContent: Pass, DropdownMenuLabel: Pass, DropdownMenuSeparator: Pass, DropdownMenuTrigger: Pass, DropdownMenuItem: Item }
})
jest.mock('@/core/components/ui/dialog', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return { Dialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) => (open ? <div>{children}</div> : null), DialogContent: Pass, DialogDescription: Pass, DialogFooter: Pass, DialogHeader: Pass, DialogTitle: Pass }
})

import { SuperAdminsTable } from '@/core/components/users/tables/SuperAdminsTable'

const admin = (id: string) => ({ id, email: `${id}@x`, firstName: id, lastName: '', role: 'superadmin', createdAt: '2026-10-13T00:00:00Z' })
const actions = ['actions.demoteToMember', 'actions.suspendUser', 'actions.deleteUser']

beforeEach(() => {
  mutate.mockClear()
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as never
})

it('a superadmin is offered no action on another superadmin', () => {
  role = 'superadmin'
  render(<SuperAdminsTable superadmins={[admin('me'), admin('other')] as never} currentUserId="me" />)
  for (const label of actions) expect(screen.queryAllByText(label)).toHaveLength(0)
})

it('a developer is offered the three actions on the other superadmin only, not on their own row', () => {
  role = 'developer'
  render(<SuperAdminsTable superadmins={[admin('me'), admin('other')] as never} currentUserId="me" />)
  for (const label of actions) expect(screen.getAllByText(label)).toHaveLength(1)
})

it.each([
  ['actions.demoteToMember', 'PATCH', { action: 'change-role', role: 'member' }],
  ['actions.suspendUser', 'PATCH', { action: 'suspend' }],
  ['actions.deleteUser', 'DELETE', undefined],
] as const)('as a developer, %s asks for confirmation, then calls the route with %s', async (label, method, body) => {
  role = 'developer'
  render(<SuperAdminsTable superadmins={[admin('other')] as never} currentUserId="me" />)
  fireEvent.click(screen.getByText(label))
  expect(mutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('confirm.confirm'))
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
  expect(url).toContain('/api/superadmin/users/other')
  expect(init.method).toBe(method)
  expect(init.body && JSON.parse(init.body)).toEqual(body ?? undefined)
})
