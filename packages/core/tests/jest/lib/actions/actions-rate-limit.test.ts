/**
 * The Server Actions that write are limited per signed-in user, in the tiers of their REST twins.
 */

const mockCheck = jest.fn()
jest.mock('@/core/lib/api/rate-limit', () => ({ checkDistributedRateLimit: (...args: unknown[]) => mockCheck(...args) }))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }))
jest.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/core/lib/auth/authorization-session', () => ({
  getAuthorizationSession: async () => ({ user: { id: 'user-1', email: 'u@example.com' }, session: { id: 'sess-1' } }),
}))
const mockUpdateUser = jest.fn()
jest.mock('@/core/lib/services/user.service', () => ({
  UserService: { updateUser: (...args: unknown[]) => mockUpdateUser(...args), anonymizeAccount: jest.fn() },
}))
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: {} }))
jest.mock('@/core/lib/services/team-member.service', () => ({
  TeamMemberService: { transferOwnership: jest.fn(), hasPermission: jest.fn().mockResolvedValue(true), getRole: jest.fn() },
}))
jest.mock('@/core/lib/services/team-invitation.service', () => ({ TeamInvitationService: { create: jest.fn() } }))
jest.mock('@/core/lib/services/generic-entity.service', () => ({
  GenericEntityService: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
}))
jest.mock('@/core/lib/entities/registry', () => ({ entityRegistry: { get: () => ({ slug: 'tasks' }) } }))
jest.mock('@/core/lib/permissions/check', () => ({ checkPermission: jest.fn().mockResolvedValue(true) }))
jest.mock('@/core/lib/teams/active-team-cookie', () => ({
  ACTIVE_TEAM_COOKIE: 'activeTeamId',
  activeTeamIdForSession: () => 'team-1',
}))
jest.mock('@/core/lib/db', () => ({ query: jest.fn(), queryWithRLS: jest.fn(), mutateWithRLS: jest.fn() }))

import { updateProfile, deleteAccount } from '@/core/lib/actions/user.actions'
import { transferTeamOwnership, removeMember } from '@/core/lib/actions/team.actions'
import { createEntity, deleteEntities } from '@/core/lib/actions/entity.actions'
import { MAX_BATCH_DELETE_IDS } from '@/core/lib/actions/types'
import { GenericEntityService } from '@/core/lib/services/generic-entity.service'
import { TeamMemberService } from '@/core/lib/services/team-member.service'

const limited = { allowed: false, remaining: 0, resetTime: Date.now() + 1000, limit: 50 }
const free = { allowed: true, remaining: 49, resetTime: Date.now() + 1000, limit: 50 }

beforeEach(() => {
  jest.clearAllMocks()
  mockCheck.mockResolvedValue(free)
})

describe('Server Actions rate limit', () => {
  test.each([
    ['updateProfile', () => updateProfile({ firstName: 'A' }), 'write'],
    ['createEntity', () => createEntity('tasks', { title: 't' }), 'write'],
    ['removeMember', () => removeMember('team-1', 'user-2'), 'write'],
    ['transferTeamOwnership', () => transferTeamOwnership('team-1', 'user-2'), 'strict'],
    ['deleteAccount', () => deleteAccount(), 'strict'],
  ])('%s answers a fixed error and writes nothing when the user is over its limit', async (_name, call, tier) => {
    mockCheck.mockResolvedValue(limited)

    const result = await call()

    expect(result).toEqual({ success: false, error: 'Too many requests. Please try again later.' })
    expect(mockCheck).toHaveBeenCalledWith(`${tier}:user:user-1`, tier)
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(GenericEntityService.create).not.toHaveBeenCalled()
    expect(TeamMemberService.transferOwnership).not.toHaveBeenCalled()
  })

  test('a user under the limit goes through', async () => {
    mockUpdateUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com' })

    expect((await updateProfile({ firstName: 'A' })).success).toBe(true)
  })
})

describe('deleteEntities id cap', () => {
  test('refuses more than the cap before touching the service', async () => {
    const ids = Array.from({ length: MAX_BATCH_DELETE_IDS + 1 }, (_, i) => `id-${i}`)

    const result = await deleteEntities('tasks', ids)

    expect(result).toEqual({ success: false, error: `At most ${MAX_BATCH_DELETE_IDS} IDs can be deleted per call` })
    expect(GenericEntityService.deleteMany).not.toHaveBeenCalled()
  })

  test('takes a list at the cap', async () => {
    ;(GenericEntityService.deleteMany as jest.Mock).mockResolvedValue(MAX_BATCH_DELETE_IDS)
    const ids = Array.from({ length: MAX_BATCH_DELETE_IDS }, (_, i) => `id-${i}`)

    expect((await deleteEntities('tasks', ids)).success).toBe(true)
  })
})
