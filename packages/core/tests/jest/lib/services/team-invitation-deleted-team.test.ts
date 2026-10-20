/**
 * Creating an invitation for a team that was deleted meanwhile (#314): no pending row is left behind.
 */
const mockQueryOneWithRLS = jest.fn()
const mockMutateWithRLS = jest.fn()

jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: (...args: unknown[]) => mockQueryOneWithRLS(...args),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
}))
jest.mock('@/core/lib/api/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true, resetTime: 0 }) }))
jest.mock('@/core/lib/services/membership.service', () => ({
  MembershipService: {
    get: jest.fn().mockResolvedValue({ role: 'owner', canPerformAction: () => ({ allowed: true }) }),
  },
}))
jest.mock('@/core/lib/email/factory', () => ({ EmailFactory: { getInstance: () => ({ send: jest.fn().mockResolvedValue({ success: true }) }) } }))
jest.mock('@/core/lib/email/send', () => ({ sendTeamInvitationEmail: jest.fn().mockResolvedValue({ subject: 's', html: 'h' }) }))

import { TeamInvitationService } from '@/core/lib/services/team-invitation.service'

const params = {
  teamId: 'team-1',
  actor: { id: 'owner-1', email: 'o@example.test' },
  input: { email: 'new@example.test', role: 'member' },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockQueryOneWithRLS.mockImplementation(async (sql: string) => (sql.includes('FROM "teams"') ? { id: 'team-1', name: 'Acme' } : null))
})

test('inserts only into an active team, under a share lock, and answers 404 when the team was deleted meanwhile', async () => {
  mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })

  const result = await TeamInvitationService.create(params)

  expect(result).toMatchObject({ success: false, status: 404, code: 'TEAM_NOT_FOUND' })
  expect(String(mockMutateWithRLS.mock.calls[0][0])).toMatch(/"deletedAt" IS NULL\s+FOR SHARE/)
})

test('an active team gets its invitation', async () => {
  mockMutateWithRLS.mockResolvedValue({ rows: [{ id: 'inv-1', token: 't' }], rowCount: 1 })

  const result = await TeamInvitationService.create(params)

  expect(result).toMatchObject({ success: true })
})
