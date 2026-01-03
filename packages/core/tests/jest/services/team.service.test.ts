/**
 * Unit Tests - TeamService
 *
 * Tests all TeamService methods for team management,
 * including CRUD operations and slug management.
 */

import { TeamService } from '@/core/lib/services/team.service'
import { queryOneWithRLS, queryWithRLS, getTransactionClient } from '@/core/lib/db'
import type { Team } from '@/core/lib/teams/types'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  getTransactionClient: jest.fn(),
}))

const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockGetTransactionClient = getTransactionClient as jest.MockedFunction<typeof getTransactionClient>

// Sample team data
const mockTeam: Team = {
  id: 'team-123',
  name: 'Test Team',
  slug: 'test-team',
  description: 'A test team',
  ownerId: 'user-456',
  avatarUrl: null,
  settings: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('TeamService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================
  // QUERIES
  // ===========================================

  describe('getById', () => {
    it('returns team when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockTeam)

      const result = await TeamService.getById('team-123', 'user-456')

      expect(result).toEqual(mockTeam)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        'SELECT * FROM "teams" WHERE id = $1',
        ['team-123'],
        'user-456'
      )
    })

    it('returns null when not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await TeamService.getById('non-existent')

      expect(result).toBeNull()
    })

    it('throws error for empty teamId', async () => {
      await expect(TeamService.getById('')).rejects.toThrow('Team ID is required')
      await expect(TeamService.getById('  ')).rejects.toThrow('Team ID is required')
    })
  })

  describe('getBySlug', () => {
    it('returns team when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockTeam)

      const result = await TeamService.getBySlug('test-team')

      expect(result).toEqual(mockTeam)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        'SELECT * FROM "teams" WHERE slug = $1',
        ['test-team']
      )
    })

    it('throws error for empty slug', async () => {
      await expect(TeamService.getBySlug('')).rejects.toThrow('Team slug is required')
    })
  })

  describe('getGlobal', () => {
    it('returns first team for single-tenant mode', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockTeam)

      const result = await TeamService.getGlobal()

      expect(result).toEqual(mockTeam)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY "createdAt" ASC'),
        []
      )
    })

    it('returns null when no teams exist', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await TeamService.getGlobal()

      expect(result).toBeNull()
    })
  })

  describe('hasGlobal', () => {
    it('returns true when team exists', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockTeam)

      const result = await TeamService.hasGlobal()

      expect(result).toBe(true)
    })

    it('returns false when no team exists', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await TeamService.hasGlobal()

      expect(result).toBe(false)
    })
  })

  describe('getUserTeams', () => {
    const mockTeamsWithDetails = [
      { ...mockTeam, userRole: 'owner', joinedAt: '2024-01-01', memberCount: '3' },
      { ...mockTeam, id: 'team-456', userRole: 'member', joinedAt: '2024-02-01', memberCount: '5' },
    ]

    it('returns teams with details', async () => {
      mockQueryWithRLS.mockResolvedValue(mockTeamsWithDetails)

      const result = await TeamService.getUserTeams('user-456')

      expect(result).toHaveLength(2)
      expect(result[0].memberCount).toBe(3) // Converted from string
      expect(result[0].userRole).toBe('owner')
    })

    it('throws error for empty userId', async () => {
      await expect(TeamService.getUserTeams('')).rejects.toThrow('User ID is required')
    })
  })

  describe('getWithMemberCount', () => {
    it('returns team with member count', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockTeam, memberCount: '5' })

      const result = await TeamService.getWithMemberCount('team-123', 'user-456')

      expect(result?.memberCount).toBe(5)
    })

    it('returns null when team not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await TeamService.getWithMemberCount('non-existent', 'user-456')

      expect(result).toBeNull()
    })
  })

  describe('getOwner', () => {
    it('returns owner details', async () => {
      const mockOwner = { id: 'user-456', name: 'John', email: 'john@test.com', image: null }
      mockQueryOneWithRLS.mockResolvedValue(mockOwner)

      const result = await TeamService.getOwner('team-123')

      expect(result).toEqual(mockOwner)
    })

    it('throws error for empty teamId', async () => {
      await expect(TeamService.getOwner('')).rejects.toThrow('Team ID is required')
    })
  })

  describe('getByOwnerId', () => {
    it('returns teams owned by user', async () => {
      mockQueryWithRLS.mockResolvedValue([mockTeam])

      const result = await TeamService.getByOwnerId('user-456')

      expect(result).toHaveLength(1)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"ownerId" = $1'),
        ['user-456'],
        'user-456'
      )
    })

    it('throws error for empty userId', async () => {
      await expect(TeamService.getByOwnerId('')).rejects.toThrow('User ID is required')
    })
  })

  // ===========================================
  // MUTATIONS
  // ===========================================

  describe('create', () => {
    const mockTx = {
      query: jest.fn(),
      queryOne: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    }

    beforeEach(() => {
      mockGetTransactionClient.mockResolvedValue(mockTx as any)
    })

    it('creates team with owner membership and subscription', async () => {
      const mockUser = { id: 'user-123', email: 'test@test.com', name: 'Test User' }
      const mockFreePlan = { id: 'plan-free' }

      mockQueryOneWithRLS.mockResolvedValue(mockUser) // Get user
      mockTx.queryOne
        .mockResolvedValueOnce(mockTeam) // Create team
        .mockResolvedValueOnce(mockFreePlan) // Get free plan

      const result = await TeamService.create('user-123', 'My Team')

      expect(result).toEqual(mockTeam)
      expect(mockTx.query).toHaveBeenCalledTimes(2) // Add member + create subscription
      expect(mockTx.commit).toHaveBeenCalled()
    })

    it('throws error for empty userId', async () => {
      await expect(TeamService.create('')).rejects.toThrow('User ID is required')
    })

    it('throws error when user not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      await expect(TeamService.create('non-existent')).rejects.toThrow('User not found')
    })

    it('rolls back on failure', async () => {
      const mockUser = { id: 'user-123', email: 'test@test.com', name: 'Test User' }
      mockQueryOneWithRLS.mockResolvedValue(mockUser)
      mockTx.queryOne.mockRejectedValue(new Error('DB error'))

      await expect(TeamService.create('user-123')).rejects.toThrow('DB error')
      expect(mockTx.rollback).toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('updates team fields', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockTeam, name: 'Updated Name' })

      const result = await TeamService.update(
        'team-123',
        { name: 'Updated Name' },
        'user-456'
      )

      expect(result.name).toBe('Updated Name')
    })

    it('throws error when no fields to update', async () => {
      await expect(
        TeamService.update('team-123', {}, 'user-456')
      ).rejects.toThrow('No fields to update')
    })

    it('throws error when team not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      await expect(
        TeamService.update('non-existent', { name: 'Test' }, 'user-456')
      ).rejects.toThrow('Team not found')
    })
  })

  describe('delete', () => {
    it('deletes team when user is owner', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockTeam)
      mockQueryWithRLS.mockResolvedValue([])

      await TeamService.delete('team-123', 'user-456')

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        'DELETE FROM "teams" WHERE id = $1',
        ['team-123'],
        'user-456'
      )
    })

    it('throws error when user is not owner', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ ...mockTeam, ownerId: 'other-user' })

      await expect(
        TeamService.delete('team-123', 'user-456')
      ).rejects.toThrow('Only team owner can delete the team')
    })
  })

  // ===========================================
  // SLUG HELPERS
  // ===========================================

  describe('isSlugAvailable', () => {
    it('returns true when slug is available', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await TeamService.isSlugAvailable('new-slug')

      expect(result).toBe(true)
    })

    it('returns false when slug is taken', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ id: 'team-123' })

      const result = await TeamService.isSlugAvailable('existing-slug')

      expect(result).toBe(false)
    })

    it('returns false for empty slug', async () => {
      const result = await TeamService.isSlugAvailable('')

      expect(result).toBe(false)
    })

    it('excludes specified team from check', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      await TeamService.isSlugAvailable('my-slug', 'team-123')

      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('id != $2'),
        ['my-slug', 'team-123']
      )
    })
  })

  describe('generateSlug', () => {
    it('generates slug from base name', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null) // Slug available

      const result = await TeamService.generateSlug('My Company')

      expect(result).toBe('my-company')
    })

    it('adds number suffix when slug is taken', async () => {
      mockQueryOneWithRLS
        .mockResolvedValueOnce({ id: 'team-1' }) // my-company taken
        .mockResolvedValueOnce(null) // my-company-1 available

      const result = await TeamService.generateSlug('My Company')

      expect(result).toBe('my-company-1')
    })

    it('throws error for empty base name', async () => {
      await expect(TeamService.generateSlug('')).rejects.toThrow('Base name is required')
    })
  })

  // ===========================================
  // CONTEXT HELPERS
  // ===========================================

  describe('switchActive', () => {
    it('returns true when user is member', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ id: 'member-123' })

      const result = await TeamService.switchActive('user-456', 'team-123')

      expect(result).toBe(true)
    })

    it('throws error when user is not member', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      await expect(
        TeamService.switchActive('user-456', 'team-123')
      ).rejects.toThrow('User is not a member of this team')
    })
  })

  describe('exists', () => {
    it('returns true when team exists', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ id: 'team-123' })

      const result = await TeamService.exists('team-123')

      expect(result).toBe(true)
    })

    it('returns false when team does not exist', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await TeamService.exists('non-existent')

      expect(result).toBe(false)
    })

    it('returns false for empty teamId', async () => {
      const result = await TeamService.exists('')

      expect(result).toBe(false)
    })
  })
})
