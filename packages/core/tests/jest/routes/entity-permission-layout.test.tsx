/**
 * EntityPermissionLayout checks the entity permission of the verified session's user in the team that session chose,
 * with a pass-through proxy and forged identity headers alike: the headers name no one.
 */
import React from 'react'

const redirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
const contextHasPermission = jest.fn()
const getDashboardPermissionContext = jest.fn()
let requestHeaders = new Headers()

jest.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))
jest.mock('next/headers', () => ({ headers: async () => requestHeaders }))
jest.mock('@nextsparkjs/core/lib/permissions/init', () => ({ isValidPermission: () => true }))
jest.mock('@nextsparkjs/core/lib/auth/request-session', () => ({
  getDashboardPermissionContext: () => getDashboardPermissionContext(),
  contextHasPermission: (...args: unknown[]) => contextHasPermission(...args),
}))

import { EntityPermissionLayout } from '../../../src/routes/_internal/entity-permission-layout'

const CONTEXT = { userId: 'real-user', teamId: 'real-team', teamRole: 'member', appRole: 'member' }
const render = () => EntityPermissionLayout({ entity: 'tasks', children: 'secret' }) as Promise<React.ReactElement>

beforeEach(() => {
  redirect.mockClear()
  contextHasPermission.mockReset()
  getDashboardPermissionContext.mockReset()
  // A pass-through proxy forwarding forged identity headers
  requestHeaders = new Headers({ 'x-user-id': 'victim-user', 'x-active-team-id': 'victim-team', 'x-pathname': '/dashboard/tasks/create' })
})

it("checks the session user's permission in the session's team, not the forged header's", async () => {
  getDashboardPermissionContext.mockResolvedValue(CONTEXT)
  contextHasPermission.mockReturnValue(false)
  await expect(render()).rejects.toThrow('NEXT_REDIRECT:/dashboard/permission-denied?entity=tasks&action=create')
  expect(contextHasPermission).toHaveBeenCalledWith(CONTEXT, 'tasks.create')
})

it('a forged x-user-id without a session is not a user: no permission is checked for it', async () => {
  getDashboardPermissionContext.mockResolvedValue({ userId: null, teamId: null, teamRole: null, appRole: null })
  await render()
  expect(contextHasPermission).not.toHaveBeenCalled()
})

it('renders the page when the session user has the permission', async () => {
  getDashboardPermissionContext.mockResolvedValue(CONTEXT)
  contextHasPermission.mockReturnValue(true)
  const element = await render()
  expect(element.props.children).toBe('secret')
})
