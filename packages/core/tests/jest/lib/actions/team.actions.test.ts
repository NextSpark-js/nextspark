/**
 * Unit Tests - Team Server Actions
 *
 * Tests all team server actions for team management.
 * These tests mock TeamService, TeamMemberService, and auth.
 */

import {
  updateTeam,
  inviteMember,
  removeMember,
  updateMemberRole,
} from '@/core/lib/actions/team.actions'
import { TeamService } from '@/core/lib/services/team.service'
import { TeamMemberService } from '@/core/lib/services/team-member.service'

// Mock TeamService
jest.mock('@/core/lib/services/team.service', () => ({
  TeamService: {
    update: jest.fn(),
    isSlugAvailable: jest.fn(),
  },
}))

// Mock TeamMemberService
jest.mock('@/core/lib/services/team-member.service', () => ({
  TeamMemberService: {
    hasPermission: jest.fn(),
    getRole: jest.fn(),
    getByTeamAndUser: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    updateRole: jest.fn(),
  },
}))

// Mock UserService (for inviteMember)
jest.mock('@/core/lib/services/user.service', () => ({
  UserService: {
    getUserByEmail: jest.fn(),
  },
}))

// Mock Next.js cache functions
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// Mock Next.js headers and cookies
const mockHeaders = jest.fn()
const mockCookies = jest.fn()
jest.mock('next/headers', () => ({
  headers: () => mockHeaders(),
  cookies: () => mockCookies(),
}))

// Mock auth
const mockGetTypedSession = jest.fn()
jest.mock('@/core/lib/auth', () => ({
  getTypedSession: (headers: unknown) => mockGetTypedSession(headers),
}))

const mockTeamService = TeamService as jest.Mocked<typeof TeamService>
const mockTeamMemberService = TeamMemberService as jest.Mocked<typeof TeamMemberService>

// ===========================================
// MOCK DATA
// ===========================================

const mockTeam = {
  id: 'team-123',
  name: 'Test Team',
  slug: 'test-team',
  description: 'A test team',
  ownerId: 'user-456',
  avatarUrl: null,
  settings: {},
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockMember = {
  id: 'member-789',
  teamId: 'team-123',
  userId: 'user-789',
  role: 'member' as const,
  invitedBy: 'user-456',
  joinedAt: '2024-01-01T00:00:00Z',
}

const mockSession = {
  user: { id: 'user-456', email: 'owner@example.com' },
  session: { id: 'session-123' },
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function setupAuthenticatedOwner() {
  mockHeaders.mockReturnValue(new Headers())
  mockCookies.mockReturnValue({
    get: jest.fn().mockReturnValue({ value: 'team-123' }),
  })
  mockGetTypedSession.mockResolvedValue(mockSession)
  mockTeamMemberService.hasPermission.mockResolvedValue(true)
  mockTeamMemberService.getRole.mockResolvedValue('owner')
}

function setupAuthenticatedAdmin() {
  mockHeaders.mockReturnValue(new Headers())
  mockCookies.mockReturnValue({
    get: jest.fn().mockReturnValue({ value: 'team-123' }),
  })
  mockGetTypedSession.mockResolvedValue(mockSession)
  mockTeamMemberService.hasPermission.mockResolvedValue(true)
  mockTeamMemberService.getRole.mockResolvedValue('admin')
}

function setupUnauthenticatedUser() {
  mockHeaders.mockReturnValue(new Headers())
  mockGetTypedSession.mockResolvedValue(null)
}

function setupPermissionDenied() {
  mockHeaders.mockReturnValue(new Headers())
  mockGetTypedSession.mockResolvedValue(mockSession)
  mockTeamMemberService.hasPermission.mockResolvedValue(false)
}

// ===========================================
// TESTS
// ===========================================

describe('Team Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupAuthenticatedOwner()
  })

  // ===========================================
  // Authentication Tests
  // ===========================================

  describe('authentication', () => {
    it('updateTeam returns error when user is not authenticated', async () => {
      setupUnauthenticatedUser()

      const result = await updateTeam('team-123', { name: 'New Name' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Authentication required')
      }
    })

    it('inviteMember returns error when user is not authenticated', async () => {
      setupUnauthenticatedUser()

      const result = await inviteMember('team-123', 'user@example.com', 'member')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Authentication required')
      }
    })

    it('removeMember returns error when user is not authenticated', async () => {
      setupUnauthenticatedUser()

      const result = await removeMember('team-123', 'user-789')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Authentication required')
      }
    })

    it('updateMemberRole returns error when user is not authenticated', async () => {
      setupUnauthenticatedUser()

      const result = await updateMemberRole('team-123', 'user-789', 'admin')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Authentication required')
      }
    })
  })

  // ===========================================
  // Permission Tests
  // ===========================================

  describe('permissions', () => {
    it('returns error when user lacks permission to update team', async () => {
      setupPermissionDenied()

      const result = await updateTeam('team-123', { name: 'New Name' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Permission denied')
      }
    })

    it('returns error when user lacks permission to invite member', async () => {
      setupPermissionDenied()

      const result = await inviteMember('team-123', 'user@example.com', 'member')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Permission denied')
      }
    })

    it('returns error when user lacks permission to remove member', async () => {
      setupPermissionDenied()

      const result = await removeMember('team-123', 'user-789')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Permission denied')
      }
    })
  })

  // ===========================================
  // updateTeam
  // ===========================================

  describe('updateTeam', () => {
    it('updates team successfully', async () => {
      const updatedTeam = { ...mockTeam, name: 'New Team Name' }
      mockTeamService.update.mockResolvedValue(updatedTeam)
      mockTeamService.isSlugAvailable.mockResolvedValue(true)

      const result = await updateTeam('team-123', { name: 'New Team Name' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('New Team Name')
      }
      expect(mockTeamService.update).toHaveBeenCalledWith(
        'team-123',
        { name: 'New Team Name' },
        'user-456'
      )
    })

    it('returns error when team ID is missing', async () => {
      const result = await updateTeam('', { name: 'New Name' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Team ID is required')
      }
    })

    it('returns error when no fields provided', async () => {
      const result = await updateTeam('team-123', {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('No fields provided for update')
      }
    })

    it('checks slug availability when updating slug', async () => {
      mockTeamService.isSlugAvailable.mockResolvedValue(false)

      const result = await updateTeam('team-123', { slug: 'taken-slug' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Team slug is already taken')
      }
      expect(mockTeamService.isSlugAvailable).toHaveBeenCalledWith('taken-slug', 'team-123')
    })

    it('revalidates team paths after update', async () => {
      const { revalidatePath } = require('next/cache')
      mockTeamService.update.mockResolvedValue(mockTeam)

      await updateTeam('team-123', { name: 'New Name' })

      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/team')
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
    })

    it('updates all allowed fields', async () => {
      mockTeamService.update.mockResolvedValue(mockTeam)
      mockTeamService.isSlugAvailable.mockResolvedValue(true)

      await updateTeam('team-123', {
        name: 'New Name',
        slug: 'new-slug',
        description: 'New description',
        avatarUrl: 'https://example.com/avatar.jpg',
        settings: { theme: 'dark' },
      })

      expect(mockTeamService.update).toHaveBeenCalledWith(
        'team-123',
        {
          name: 'New Name',
          slug: 'new-slug',
          description: 'New description',
          avatarUrl: 'https://example.com/avatar.jpg',
          settings: { theme: 'dark' },
        },
        'user-456'
      )
    })
  })

  // ===========================================
  // inviteMember
  // ===========================================

  describe('inviteMember', () => {
    it('invites member successfully', async () => {
      const { UserService } = require('@/core/lib/services/user.service')
      UserService.getUserByEmail.mockResolvedValue({ id: 'user-789', email: 'new@example.com' })
      mockTeamMemberService.getByTeamAndUser.mockResolvedValue(null)
      mockTeamMemberService.add.mockResolvedValue(mockMember)

      const result = await inviteMember('team-123', 'new@example.com', 'member')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.memberId).toBe('member-789')
        expect(result.data.role).toBe('member')
      }
      expect(mockTeamMemberService.add).toHaveBeenCalledWith(
        'team-123',
        'user-789',
        'member',
        { invitedBy: 'user-456' }
      )
    })

    it('returns error when team ID is missing', async () => {
      const result = await inviteMember('', 'user@example.com', 'member')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Team ID is required')
      }
    })

    it('returns error when email is missing', async () => {
      const result = await inviteMember('team-123', '', 'member')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Email is required')
      }
    })

    it('returns error when trying to invite as owner', async () => {
      const result = await inviteMember('team-123', 'user@example.com', 'owner')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid role')
      }
    })

    it('returns error when user not found', async () => {
      const { UserService } = require('@/core/lib/services/user.service')
      UserService.getUserByEmail.mockResolvedValue(null)

      const result = await inviteMember('team-123', 'nonexistent@example.com', 'member')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('User not found')
      }
    })

    it('returns error when user is already a member', async () => {
      const { UserService } = require('@/core/lib/services/user.service')
      UserService.getUserByEmail.mockResolvedValue({ id: 'user-789', email: 'existing@example.com' })
      mockTeamMemberService.getByTeamAndUser.mockResolvedValue(mockMember)

      const result = await inviteMember('team-123', 'existing@example.com', 'member')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('already a member')
      }
    })

    it('revalidates team paths after invite', async () => {
      const { revalidatePath } = require('next/cache')
      const { UserService } = require('@/core/lib/services/user.service')
      UserService.getUserByEmail.mockResolvedValue({ id: 'user-789', email: 'new@example.com' })
      mockTeamMemberService.getByTeamAndUser.mockResolvedValue(null)
      mockTeamMemberService.add.mockResolvedValue(mockMember)

      await inviteMember('team-123', 'new@example.com', 'member')

      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/team')
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/team/members')
    })
  })

  // ===========================================
  // removeMember
  // ===========================================

  describe('removeMember', () => {
    it('removes member successfully', async () => {
      // The action checks target role first, then requestor role for admin check
      mockTeamMemberService.getRole
        .mockResolvedValueOnce('member') // target role (not owner, not admin)
        .mockResolvedValueOnce('owner')  // requestor role (for admin check)
      mockTeamMemberService.remove.mockResolvedValue(undefined)

      const result = await removeMember('team-123', 'user-789')

      expect(result.success).toBe(true)
      expect(mockTeamMemberService.remove).toHaveBeenCalledWith('team-123', 'user-789')
    })

    it('returns error when team ID is missing', async () => {
      const result = await removeMember('', 'user-789')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Team ID is required')
      }
    })

    it('returns error when member ID is missing', async () => {
      const result = await removeMember('team-123', '')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Member ID is required')
      }
    })

    it('returns error when trying to remove team owner', async () => {
      // The session user (user-456) is trying to remove a different user who is owner
      mockTeamMemberService.getRole
        .mockResolvedValueOnce('owner') // target role (is owner - blocked)

      const result = await removeMember('team-123', 'different-user-owner')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Cannot remove team owner')
      }
    })

    it('prevents admin from removing other admins', async () => {
      setupAuthenticatedAdmin()
      mockTeamMemberService.getRole
        .mockResolvedValueOnce('admin') // target role (is admin)
        .mockResolvedValueOnce('admin') // requestor role (also admin)

      const result = await removeMember('team-123', 'other-admin')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Admins cannot remove other admins')
      }
    })

    it('revalidates team paths after removal', async () => {
      const { revalidatePath } = require('next/cache')
      mockTeamMemberService.getRole
        .mockResolvedValueOnce('member') // target role
        .mockResolvedValueOnce('owner')  // requestor role
      mockTeamMemberService.remove.mockResolvedValue(undefined)

      await removeMember('team-123', 'user-789')

      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/team')
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/team/members')
    })
  })

  // ===========================================
  // updateMemberRole
  // ===========================================

  describe('updateMemberRole', () => {
    it('updates member role successfully', async () => {
      const updatedMember = { ...mockMember, role: 'admin' as const }
      // The action gets: 1) requestor role, 2) target current role
      mockTeamMemberService.getRole
        .mockResolvedValueOnce('owner')  // requestor role
        .mockResolvedValueOnce('member') // current target role
      mockTeamMemberService.updateRole.mockResolvedValue(updatedMember)

      const result = await updateMemberRole('team-123', 'user-789', 'admin')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.role).toBe('admin')
      }
      expect(mockTeamMemberService.updateRole).toHaveBeenCalledWith('team-123', 'user-789', 'admin')
    })

    it('returns error when team ID is missing', async () => {
      const result = await updateMemberRole('', 'user-789', 'admin')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Team ID is required')
      }
    })

    it('returns error when member ID is missing', async () => {
      const result = await updateMemberRole('team-123', '', 'admin')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Member ID is required')
      }
    })

    it('returns error when trying to set owner role', async () => {
      const result = await updateMemberRole('team-123', 'user-789', 'owner')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid role')
      }
    })

    it('returns error when trying to change owner role', async () => {
      // The action: 1) gets requestor role, 2) gets target current role
      mockTeamMemberService.getRole
        .mockResolvedValueOnce('owner') // requestor role (is owner)
        .mockResolvedValueOnce('owner') // current target role (is also owner)

      const result = await updateMemberRole('team-123', 'owner-id', 'admin')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Cannot change owner role')
      }
    })

    it('prevents non-owner from promoting to admin', async () => {
      // Setup admin requestor (not owner)
      mockHeaders.mockReturnValue(new Headers())
      mockGetTypedSession.mockResolvedValue(mockSession)
      mockTeamMemberService.hasPermission.mockResolvedValue(true)
      // The action: 1) gets requestor role, 2) gets target current role
      mockTeamMemberService.getRole
        .mockResolvedValueOnce('admin')  // requestor role (is admin, not owner)
        .mockResolvedValueOnce('member') // current target role

      const result = await updateMemberRole('team-123', 'user-789', 'admin')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Only the team owner can promote')
      }
    })

    it('allows admin to change member to viewer', async () => {
      const updatedMember = { ...mockMember, role: 'viewer' as const }
      mockHeaders.mockReturnValue(new Headers())
      mockGetTypedSession.mockResolvedValue(mockSession)
      mockTeamMemberService.hasPermission.mockResolvedValue(true)
      // The action: 1) gets requestor role, 2) gets target current role
      mockTeamMemberService.getRole
        .mockResolvedValueOnce('admin')  // requestor role
        .mockResolvedValueOnce('member') // current target role
      mockTeamMemberService.updateRole.mockResolvedValue(updatedMember)

      const result = await updateMemberRole('team-123', 'user-789', 'viewer')

      expect(result.success).toBe(true)
    })

    it('revalidates team paths after role update', async () => {
      const { revalidatePath } = require('next/cache')
      mockTeamMemberService.getRole
        .mockResolvedValueOnce('owner')  // requestor role
        .mockResolvedValueOnce('member') // target current role
      mockTeamMemberService.updateRole.mockResolvedValue(mockMember)

      await updateMemberRole('team-123', 'user-789', 'admin')

      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/team')
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/team/members')
    })
  })

  // ===========================================
  // Error handling
  // ===========================================

  describe('error handling', () => {
    it('handles non-Error exceptions', async () => {
      mockTeamService.update.mockRejectedValue('String error')

      const result = await updateTeam('team-123', { name: 'New Name' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Failed to update team')
      }
    })

    it('logs errors to console', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockTeamService.update.mockRejectedValue(new Error('Test error'))

      await updateTeam('team-123', { name: 'New Name' })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[updateTeam]'),
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })
})
