/**
 * The dashboard's permission checks take the user from the verified session and the team from the activeTeamId cookie
 * that session wrote, never from the identity headers a proxy forwards (`x-user-id`, `x-user-email`,
 * `x-active-team-id`): a project's own proxy may pass them through as the client sent them.
 */
const getTypedSession = jest.fn()
const getDashboardMembership = jest.fn()
let requestHeaders = new Headers()
let cookieValue: string | undefined

jest.mock('next/headers', () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ get: (name: string) => (name === 'activeTeamId' && cookieValue !== undefined ? { name, value: cookieValue } : undefined) }),
}))
jest.mock('@nextsparkjs/core/lib/auth', () => ({ getTypedSession: (h: Headers) => getTypedSession(h) }))
jest.mock('@nextsparkjs/core/lib/teams/dashboard-team', () => ({ getDashboardMembership: (...args: unknown[]) => getDashboardMembership(...args) }))

import { getDashboardPermissionContext } from '@nextsparkjs/core/lib/auth/request-session'

const FORGED = { 'x-user-id': 'victim-user', 'x-user-email': 'victim@example.test', 'x-active-team-id': 'victim-team' }

beforeEach(() => {
  getTypedSession.mockReset()
  getDashboardMembership.mockReset().mockImplementation(async (_userId: string, chosen: string | null) => ({ teamId: chosen ?? 'default-team', teamRole: 'member', appRole: 'member' }))
  requestHeaders = new Headers(FORGED)
  cookieValue = undefined
})

it('ignores forged identity headers when there is no session: no user, no team, nothing looked up', async () => {
  getTypedSession.mockResolvedValue(null)
  expect(await getDashboardPermissionContext()).toEqual({ userId: null, teamId: null, teamRole: null, appRole: null })
  expect(getDashboardMembership).not.toHaveBeenCalled()
})

it("checks the session's own user, whatever x-user-id says", async () => {
  getTypedSession.mockResolvedValue({ session: { id: 'sess-1' }, user: { id: 'real-user', role: 'member' } })
  expect(await getDashboardPermissionContext()).toEqual({ userId: 'real-user', teamId: 'default-team', teamRole: 'member', appRole: 'member' })
  expect(getTypedSession).toHaveBeenCalledWith(requestHeaders)
  expect(getDashboardMembership).toHaveBeenCalledWith('real-user', null)
})

it('takes the chosen team from the cookie only when this session wrote it, never from x-active-team-id', async () => {
  getTypedSession.mockResolvedValue({ session: { id: 'sess-1' }, user: { id: 'real-user', role: 'member' } })
  cookieValue = 'sess-1:team-a'
  expect((await getDashboardPermissionContext()).teamId).toBe('team-a')
  cookieValue = 'other-session:team-b'
  expect((await getDashboardPermissionContext()).teamId).toBe('default-team')
  expect(getDashboardMembership).not.toHaveBeenCalledWith(expect.anything(), 'victim-team')
})
