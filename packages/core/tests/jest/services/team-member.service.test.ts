/**
 * Unit Tests - TeamMemberService
 *
 * Tests all TeamMemberService methods for team membership management,
 * including adding/removing members, role management, and permission checks.
 */

import { TeamMemberService } from '@/core/lib/services/team-member.service'
import { queryOneWithRLS, queryWithRLS, mutateWithRLS, getServiceTransactionClient } from '@/core/lib/db'
import type { TeamMember } from '@/core/lib/teams/types'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
  getServiceTransactionClient: jest.fn(),
}))

// Mock TeamService
jest.mock('@/core/lib/services/team.service', () => ({
  TeamService: {
    getGlobal: jest.fn(),
  },
}))

import { TeamService } from '@/core/lib/services/team.service'

const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>
const mockTeamService = TeamService as jest.Mocked<typeof TeamService>

// Sample member data
const mockMember: TeamMember = {
  id: 'member-123',
  teamId: 'team-456',
  userId: 'user-789',
  role: 'member',
  invitedBy: 'user-000',
  joinedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockMemberWithUser = {
  ...mockMember,
  userName: 'John Doe',
  userEmail: 'john@test.com',
  userImage: null,
}

describe('TeamMemberService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================
  // QUERIES
  // ===========================================

  describe('getByTeamAndUser', () => {
    it('returns member when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockMember)

      const result = await TeamMemberService.getByTeamAndUser('team-456', 'user-789')

      expect(result).toEqual(mockMember)
      expect(mockQueryOneWithRLS).toHaveBeenCalledTimes(1)
      const [sql, params, rlsUserId] = mockQueryOneWithRLS.mock.calls[0]
      expect(sql).toMatch(/FROM "team_members" tm/)
      expect(params).toEqual(['team-456', 'user-789'])
      expect(rlsUserId).toBe('user-789')
    })

    it('TM_088: only resolves memberships of active (non soft-deleted) teams', async () => {
      // Team deletion is a soft delete (UPDATE teams SET "deletedAt"), which never
      // fires ON DELETE CASCADE, so team_members rows outlive the team. The lookup
      // must join teams and exclude soft-deleted ones (issue #88).
      mockQueryOneWithRLS.mockResolvedValue(null)

      await TeamMemberService.getByTeamAndUser('team-456', 'user-789')

      const [sql] = mockQueryOneWithRLS.mock.calls[0]
      const normalized = (sql as string).replace(/\s+/g, ' ')
      expect(normalized).toContain('INNER JOIN "teams" t ON t.id = tm."teamId"')
      expect(normalized).toContain('t."deletedAt" IS NULL')
    })

    it('returns null when not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await TeamMemberService.getByTeamAndUser('team-456', 'non-existent')

      expect(result).toBeNull()
    })

    it('returns null for empty parameters', async () => {
      const result = await TeamMemberService.getByTeamAndUser('', 'user-789')

      expect(result).toBeNull()
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })
  })

  describe('listByTeam', () => {
    it('returns members with user details', async () => {
      mockQueryWithRLS.mockResolvedValue([mockMemberWithUser])

      const result = await TeamMemberService.listByTeam('team-456', 'user-789')

      expect(result).toHaveLength(1)
      expect(result[0].userName).toBe('John Doe')
    })

    it('throws error for empty teamId', async () => {
      await expect(
        TeamMemberService.listByTeam('', 'user-789')
      ).rejects.toThrow('Team ID is required')
    })
  })

  describe('getRole', () => {
    it('returns role when member exists', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ role: 'admin' })

      const result = await TeamMemberService.getRole('team-456', 'user-789')

      expect(result).toBe('admin')
    })

    it('returns null when member does not exist', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await TeamMemberService.getRole('team-456', 'non-existent')

      expect(result).toBeNull()
    })

    it('TM_088: only resolves roles in active (non soft-deleted) teams', async () => {
      // Same gap as getByTeamAndUser: team_members rows outlive teams."deletedAt" (issue #88)
      mockQueryOneWithRLS.mockResolvedValue(null)

      await TeamMemberService.getRole('team-456', 'user-789')

      const [sql, params, rlsUserId] = mockQueryOneWithRLS.mock.calls[0]
      const normalized = (sql as string).replace(/\s+/g, ' ')
      expect(normalized).toContain('INNER JOIN "teams" t ON t.id = tm."teamId"')
      expect(normalized).toContain('t."deletedAt" IS NULL')
      expect(params).toEqual(['team-456', 'user-789'])
      expect(rlsUserId).toBe('user-789')
    })
  })

  // ===========================================
  // MUTATIONS
  // ===========================================

  describe('add', () => {
    it('adds member to team', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null) // Not already a member
      mockMutateWithRLS.mockResolvedValue({ rows: [mockMember], rowCount: 1 })

      const result = await TeamMemberService.add('team-456', 'user-789', 'member')

      expect(result).toEqual(mockMember)
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "team_members"'),
        ['team-456', 'user-789', 'member', null],
        'user-789',
        { service: true } // bootstrap/membership insert runs on the service pool (bypass)
      )
    })

    it('adds member with invitedBy', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)
      mockMutateWithRLS.mockResolvedValue({ rows: [mockMember], rowCount: 1 })

      await TeamMemberService.add('team-456', 'user-789', 'member', { invitedBy: 'user-000' })

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.any(String),
        ['team-456', 'user-789', 'member', 'user-000'],
        'user-789',
        { service: true } // bootstrap/membership insert runs on the service pool (bypass)
      )
    })

    it('throws error when already a member', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockMember)

      await expect(
        TeamMemberService.add('team-456', 'user-789', 'member')
      ).rejects.toThrow('User is already a member of this team')
    })

    it('throws error for empty parameters', async () => {
      await expect(TeamMemberService.add('', 'user-789', 'member')).rejects.toThrow('Team ID is required')
      await expect(TeamMemberService.add('team-456', '', 'member')).rejects.toThrow('User ID is required')
    })
  })

  describe('addToGlobal', () => {
    it('adds user to global team', async () => {
      mockTeamService.getGlobal.mockResolvedValue({ id: 'global-team' } as any)
      mockQueryOneWithRLS.mockResolvedValue(null) // Not already a member
      mockMutateWithRLS.mockResolvedValue({ rows: [mockMember], rowCount: 1 })

      await TeamMemberService.addToGlobal('user-789', 'member', 'inviter-id')

      expect(mockTeamService.getGlobal).toHaveBeenCalled()
    })

    it('throws error when no global team exists', async () => {
      mockTeamService.getGlobal.mockResolvedValue(null)

      await expect(
        TeamMemberService.addToGlobal('user-789')
      ).rejects.toThrow('No global team exists')
    })

    it('does nothing when already a member', async () => {
      mockTeamService.getGlobal.mockResolvedValue({ id: 'global-team' } as any)
      mockQueryOneWithRLS.mockResolvedValue(mockMember)

      await TeamMemberService.addToGlobal('user-789')

      expect(mockMutateWithRLS).not.toHaveBeenCalled()
    })
  })

  describe('transferOwnership', () => {
    // One service transaction: lock the team, promote the target, demote the owner, move teams.ownerId
    const tx = { query: jest.fn(), queryOne: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
    beforeEach(() => {
      Object.values(tx).forEach(fn => fn.mockReset())
      ;(getServiceTransactionClient as jest.Mock).mockResolvedValue(tx)
    })

    it('transfers ownership in one service transaction: the old owner becomes admin', async () => {
      tx.queryOne.mockResolvedValue({ ownerId: 'current-owner-id' })
      tx.query
        .mockResolvedValueOnce([{ ...mockMember, userId: 'new-owner-id', role: 'owner' }])
        .mockResolvedValueOnce([{ ...mockMember, userId: 'current-owner-id', role: 'admin' }])
        .mockResolvedValueOnce([])

      const result = await TeamMemberService.transferOwnership('team-456', 'new-owner-id', 'current-owner-id')

      expect(result.previousOwner.role).toBe('admin')
      expect(result.newOwner.role).toBe('owner')
      expect(tx.queryOne.mock.calls[0][0]).toMatch(/FOR UPDATE/)
      expect(tx.query.mock.calls[2]).toEqual([expect.stringMatching(/UPDATE "teams" SET "ownerId" = \$1/), ['new-owner-id', 'team-456']])
      expect(tx.commit).toHaveBeenCalledTimes(1)
      expect(mockMutateWithRLS).not.toHaveBeenCalled()
    })

    it('refuses a caller who does not own the team, and changes nothing', async () => {
      tx.queryOne.mockResolvedValue({ ownerId: 'someone-else' })

      await expect(
        TeamMemberService.transferOwnership('team-456', 'new-owner-id', 'not-owner-id')
      ).rejects.toMatchObject({ code: 'NOT_OWNER', message: 'Only the current owner can transfer ownership' })
      expect(tx.query).not.toHaveBeenCalled()
      expect(tx.rollback).toHaveBeenCalledTimes(1)
    })

    it('refuses a new owner who is not a member of the team, and rolls back', async () => {
      tx.queryOne.mockResolvedValue({ ownerId: 'current-owner-id' })
      tx.query.mockResolvedValueOnce([])

      await expect(
        TeamMemberService.transferOwnership('team-456', 'new-owner-id', 'current-owner-id')
      ).rejects.toMatchObject({ code: 'NOT_A_MEMBER', message: 'New owner must be an existing team member' })
      expect(tx.query).toHaveBeenCalledTimes(1)
      expect(tx.rollback).toHaveBeenCalledTimes(1)
      expect(tx.commit).not.toHaveBeenCalled()
    })

    it('refuses a transfer to the current owner, after checking the caller owns the team', async () => {
      tx.queryOne.mockResolvedValue({ ownerId: 'same-id' })
      await expect(
        TeamMemberService.transferOwnership('team-456', 'same-id', 'same-id')
      ).rejects.toMatchObject({ code: 'SAME_OWNER' })
      expect(tx.query).not.toHaveBeenCalled()

      // someone who does not own the team, naming themself, is told they do not own it
      tx.queryOne.mockResolvedValue({ ownerId: 'owner-id' })
      await expect(
        TeamMemberService.transferOwnership('team-456', 'member-id', 'member-id')
      ).rejects.toMatchObject({ code: 'NOT_OWNER' })
    })
  })

  describe('remove', () => {
    it('removes member from team', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ role: 'member' }) // Not owner
      mockQueryWithRLS.mockResolvedValue([])

      await TeamMemberService.remove('team-456', 'user-789', 'user-789')

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        'DELETE FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
        ['team-456', 'user-789'],
        'user-789'
      )
    })

    it('throws error when trying to remove owner', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ role: 'owner' })

      await expect(
        TeamMemberService.remove('team-456', 'owner-id', 'owner-id')
      ).rejects.toThrow('Cannot remove team owner. Transfer ownership first.')
    })

    it('requires the acting user', async () => {
      await expect(
        (TeamMemberService.remove as (...a: unknown[]) => Promise<void>)('team-456', 'user-789')
      ).rejects.toThrow('Actor ID is required')
      expect(mockQueryWithRLS).not.toHaveBeenCalled()
    })
  })

  describe('updateRole', () => {
    it('updates member role', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ role: 'member' })
      mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockMember, role: 'admin' }], rowCount: 1 })

      const result = await TeamMemberService.updateRole('team-456', 'user-789', 'admin', 'owner-1')

      expect(result.role).toBe('admin')
    })

    it('throws error when trying to change owner role', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ role: 'owner' })

      await expect(
        TeamMemberService.updateRole('team-456', 'owner-id', 'admin', 'owner-id')
      ).rejects.toThrow('Cannot change owner role. Transfer ownership first.')
    })
  })

  // ===========================================
  // PERMISSION CHECKS
  // ===========================================

  describe('isMember', () => {
    it('returns true when user is member', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ id: 'member-123' })

      const result = await TeamMemberService.isMember('team-456', 'user-789')

      expect(result).toBe(true)
    })

    it('returns false when user is not member', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await TeamMemberService.isMember('team-456', 'non-member')

      expect(result).toBe(false)
    })

    it('TM_088: only counts membership in active (non soft-deleted) teams', async () => {
      // Same gap as getByTeamAndUser: team_members rows outlive teams."deletedAt" (issue #88)
      mockQueryOneWithRLS.mockResolvedValue(null)

      await TeamMemberService.isMember('team-456', 'user-789')

      const [sql, params, rlsUserId] = mockQueryOneWithRLS.mock.calls[0]
      const normalized = (sql as string).replace(/\s+/g, ' ')
      expect(normalized).toContain('INNER JOIN "teams" t ON t.id = tm."teamId"')
      expect(normalized).toContain('t."deletedAt" IS NULL')
      expect(params).toEqual(['team-456', 'user-789'])
      expect(rlsUserId).toBe('user-789')
    })
  })

  describe('hasPermission', () => {
    it('returns true when user has required role', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ role: 'admin' })

      const result = await TeamMemberService.hasPermission('user-789', 'team-456', ['admin', 'owner'])

      expect(result).toBe(true)
    })

    it('returns false when user lacks required role', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ role: 'member' })

      const result = await TeamMemberService.hasPermission('user-789', 'team-456', ['admin', 'owner'])

      expect(result).toBe(false)
    })
  })

  // REMOVED IN V2: isOwner() and isAdminOrOwner() methods
  // These legacy methods were removed in favor of MembershipService pattern
  // Use MembershipService.get() + membership.hasRole() or membership.hasMinHierarchy() instead

  describe('count', () => {
    it('returns member count', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ count: '5' })

      const result = await TeamMemberService.count('team-456')

      expect(result).toBe(5)
    })

    it('returns 0 for empty teamId', async () => {
      const result = await TeamMemberService.count('')

      expect(result).toBe(0)
    })
  })

  describe('countByRole', () => {
    it('returns counts by role', async () => {
      mockQueryWithRLS.mockResolvedValue([
        { role: 'owner', count: '1' },
        { role: 'admin', count: '2' },
        { role: 'member', count: '5' },
      ])

      const result = await TeamMemberService.countByRole('team-456')

      expect(result).toEqual({ owner: 1, admin: 2, member: 5 })
    })
  })

  // ===========================================
  // FILTERING QUERIES
  // ===========================================

  describe('listByUser', () => {
    it('returns all memberships for user', async () => {
      mockQueryWithRLS.mockResolvedValue([
        { ...mockMember, teamName: 'Team A', teamSlug: 'team-a' },
        { ...mockMember, teamName: 'Team B', teamSlug: 'team-b' },
      ])

      const result = await TeamMemberService.listByUser('user-789')

      expect(result).toHaveLength(2)
      expect(result[0].teamName).toBe('Team A')
    })

    it('throws error for empty userId', async () => {
      await expect(TeamMemberService.listByUser('')).rejects.toThrow('User ID is required')
    })
  })

  describe('listByRole', () => {
    it('returns members with specified role', async () => {
      mockQueryWithRLS.mockResolvedValue([mockMemberWithUser])

      const result = await TeamMemberService.listByRole('team-456', 'admin', 'user-789')

      expect(result).toHaveLength(1)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('role = $2'),
        ['team-456', 'admin'],
        'user-789'
      )
    })
  })

  describe('search', () => {
    it('searches members by name or email', async () => {
      mockQueryWithRLS.mockResolvedValue([mockMemberWithUser])

      const result = await TeamMemberService.search('team-456', 'john', 'user-789')

      expect(result).toHaveLength(1)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        ['team-456', '%john%'],
        'user-789'
      )
    })

    it('returns all members when search is empty', async () => {
      mockQueryWithRLS.mockResolvedValue([mockMemberWithUser])

      await TeamMemberService.search('team-456', '', 'user-789')

      // Should call listByTeam internally
      expect(mockQueryWithRLS).toHaveBeenCalled()
    })
  })

  describe('getRecentlyJoined', () => {
    it('returns recently joined members', async () => {
      mockQueryWithRLS.mockResolvedValue([mockMemberWithUser])

      const result = await TeamMemberService.getRecentlyJoined('team-456', 5, 'user-789')

      expect(result).toHaveLength(1)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['team-456', 5],
        'user-789'
      )
    })
  })

  describe('listInvitedBy', () => {
    it('returns members invited by user', async () => {
      mockQueryWithRLS.mockResolvedValue([mockMemberWithUser])

      const result = await TeamMemberService.listInvitedBy('team-456', 'inviter-id', 'user-789')

      expect(result).toHaveLength(1)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"invitedBy" = $2'),
        ['team-456', 'inviter-id'],
        'user-789'
      )
    })
  })
})

describe('TeamMemberService writes run as the actor', () => {
  beforeEach(() => jest.clearAllMocks())

  it('remove deletes under the RLS context of the user removing the member', async () => {
    mockQueryOneWithRLS.mockResolvedValue({ role: 'member' })
    mockQueryWithRLS.mockResolvedValue([])

    await TeamMemberService.remove('team-456', 'user-789', 'owner-1')

    expect(mockQueryWithRLS).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM "team_members"/), ['team-456', 'user-789'], 'owner-1')
  })

  it('updateRole updates under the RLS context of the user changing the role', async () => {
    mockQueryOneWithRLS.mockResolvedValue({ role: 'member' })
    mockMutateWithRLS.mockResolvedValue({ rows: [{ ...mockMember, role: 'viewer' }], rowCount: 1 })

    await TeamMemberService.updateRole('team-456', 'user-789', 'viewer', 'admin-1')

    expect(mockMutateWithRLS).toHaveBeenCalledWith(expect.stringMatching(/UPDATE "team_members"/), ['team-456', 'user-789', 'viewer'], 'admin-1')
  })
})
