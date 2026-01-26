/**
 * Unit Tests - User Server Actions
 *
 * Tests all user server actions for profile management.
 * These tests mock UserService, auth, and Next.js functions.
 */

import {
  updateProfile,
  updateAvatar,
  deleteAccount,
} from '@/core/lib/actions/user.actions'
import { UserService } from '@/core/lib/services/user.service'

// Mock UserService
jest.mock('@/core/lib/services/user.service', () => ({
  UserService: {
    updateUser: jest.fn(),
    deleteAllUserMetas: jest.fn(),
  },
}))

// Mock TeamService (for deleteAccount)
jest.mock('@/core/lib/services/team.service', () => ({
  TeamService: {
    getByOwnerId: jest.fn(),
  },
}))

// Mock db module (for deleteAccount)
jest.mock('@/core/lib/db', () => ({
  mutateWithRLS: jest.fn(),
}))

// Mock Next.js cache functions
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// Mock Next.js headers
const mockHeaders = jest.fn()
jest.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

// Mock auth
const mockGetTypedSession = jest.fn()
jest.mock('@/core/lib/auth', () => ({
  getTypedSession: (headers: unknown) => mockGetTypedSession(headers),
}))

const mockUserService = UserService as jest.Mocked<typeof UserService>

// ===========================================
// MOCK DATA
// ===========================================

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  image: 'https://example.com/avatar.jpg',
  country: 'US',
  timezone: 'America/New_York',
  language: 'en',
  role: 'user' as const,
  emailVerified: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const mockSession = {
  user: { id: 'user-123', email: 'test@example.com' },
  session: { id: 'session-123' },
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function setupAuthenticatedUser() {
  mockHeaders.mockReturnValue(new Headers())
  mockGetTypedSession.mockResolvedValue(mockSession)
}

function setupUnauthenticatedUser() {
  mockHeaders.mockReturnValue(new Headers())
  mockGetTypedSession.mockResolvedValue(null)
}

// ===========================================
// TESTS
// ===========================================

describe('User Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupAuthenticatedUser()
  })

  // ===========================================
  // Authentication Tests
  // ===========================================

  describe('authentication', () => {
    it('updateProfile returns error when user is not authenticated', async () => {
      setupUnauthenticatedUser()

      const result = await updateProfile({ firstName: 'John' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Authentication required')
      }
    })

    it('updateAvatar returns error when user is not authenticated', async () => {
      setupUnauthenticatedUser()
      const formData = new FormData()
      formData.append('avatar', 'https://example.com/new-avatar.jpg')

      const result = await updateAvatar(formData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Authentication required')
      }
    })

    it('deleteAccount returns error when user is not authenticated', async () => {
      setupUnauthenticatedUser()

      const result = await deleteAccount()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Authentication required')
      }
    })
  })

  // ===========================================
  // updateProfile
  // ===========================================

  describe('updateProfile', () => {
    it('updates profile successfully', async () => {
      const updatedUser = { ...mockUser, firstName: 'John', lastName: 'Doe' }
      mockUserService.updateUser.mockResolvedValue(updatedUser)

      const result = await updateProfile({
        firstName: 'John',
        lastName: 'Doe',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.firstName).toBe('John')
        expect(result.data.lastName).toBe('Doe')
      }
      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        'user-123',
        { firstName: 'John', lastName: 'Doe' },
        'user-123'
      )
    })

    it('returns error when no fields provided', async () => {
      const result = await updateProfile({})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('No fields provided for update')
      }
    })

    it('filters to allowed fields only', async () => {
      const updatedUser = { ...mockUser, firstName: 'John' }
      mockUserService.updateUser.mockResolvedValue(updatedUser)

      await updateProfile({
        firstName: 'John',
        // @ts-expect-error - Testing that invalid fields are ignored
        invalidField: 'should be ignored',
      })

      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        'user-123',
        { firstName: 'John' },
        'user-123'
      )
    })

    it('revalidates profile paths after update', async () => {
      const { revalidatePath } = require('next/cache')
      mockUserService.updateUser.mockResolvedValue(mockUser)

      await updateProfile({ firstName: 'John' })

      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings')
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/profile')
    })

    it('handles service errors gracefully', async () => {
      mockUserService.updateUser.mockRejectedValue(new Error('Database error'))

      const result = await updateProfile({ firstName: 'John' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Database error')
      }
    })

    it('updates all allowed fields', async () => {
      const updatedUser = {
        ...mockUser,
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        country: 'UK',
        timezone: 'Europe/London',
        language: 'es',
      }
      mockUserService.updateUser.mockResolvedValue(updatedUser)

      const result = await updateProfile({
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        country: 'UK',
        timezone: 'Europe/London',
        language: 'es',
      })

      expect(result.success).toBe(true)
      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        'user-123',
        {
          firstName: 'John',
          lastName: 'Doe',
          name: 'John Doe',
          country: 'UK',
          timezone: 'Europe/London',
          language: 'es',
        },
        'user-123'
      )
    })
  })

  // ===========================================
  // updateAvatar
  // ===========================================

  describe('updateAvatar', () => {
    it('updates avatar successfully with URL', async () => {
      const updatedUser = { ...mockUser, image: 'https://example.com/new-avatar.jpg' }
      mockUserService.updateUser.mockResolvedValue(updatedUser)

      const formData = new FormData()
      formData.append('avatar', 'https://example.com/new-avatar.jpg')

      const result = await updateAvatar(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.image).toBe('https://example.com/new-avatar.jpg')
      }
      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        'user-123',
        { image: 'https://example.com/new-avatar.jpg' },
        'user-123'
      )
    })

    it('accepts "image" field in FormData', async () => {
      const updatedUser = { ...mockUser, image: 'https://example.com/avatar.png' }
      mockUserService.updateUser.mockResolvedValue(updatedUser)

      const formData = new FormData()
      formData.append('image', 'https://example.com/avatar.png')

      const result = await updateAvatar(formData)

      expect(result.success).toBe(true)
    })

    it('accepts relative URL paths', async () => {
      const updatedUser = { ...mockUser, image: '/uploads/avatar.jpg' }
      mockUserService.updateUser.mockResolvedValue(updatedUser)

      const formData = new FormData()
      formData.append('avatar', '/uploads/avatar.jpg')

      const result = await updateAvatar(formData)

      expect(result.success).toBe(true)
    })

    it('returns error when avatar is missing', async () => {
      const formData = new FormData()

      const result = await updateAvatar(formData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Avatar image is required')
      }
    })

    it('returns error for invalid URL format', async () => {
      const formData = new FormData()
      formData.append('avatar', 'not-a-valid-url')

      const result = await updateAvatar(formData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Invalid image URL format')
      }
    })

    it('revalidates paths after avatar update', async () => {
      const { revalidatePath } = require('next/cache')
      mockUserService.updateUser.mockResolvedValue(mockUser)

      const formData = new FormData()
      formData.append('avatar', 'https://example.com/avatar.jpg')

      await updateAvatar(formData)

      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings')
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/profile')
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
    })
  })

  // ===========================================
  // deleteAccount
  // ===========================================

  describe('deleteAccount', () => {
    it('deletes account successfully when user owns no teams', async () => {
      const { TeamService } = require('@/core/lib/services/team.service')
      const { mutateWithRLS } = require('@/core/lib/db')

      TeamService.getByOwnerId.mockResolvedValue([])
      mockUserService.deleteAllUserMetas.mockResolvedValue(undefined)
      mutateWithRLS.mockResolvedValue({ rowCount: 1 })

      const result = await deleteAccount()

      expect(result.success).toBe(true)
      expect(TeamService.getByOwnerId).toHaveBeenCalledWith('user-123')
      expect(mockUserService.deleteAllUserMetas).toHaveBeenCalledWith('user-123', 'user-123')
      expect(mutateWithRLS).toHaveBeenCalledWith(
        'DELETE FROM "users" WHERE id = $1',
        ['user-123'],
        'user-123'
      )
    })

    it('returns error when user owns teams', async () => {
      const { TeamService } = require('@/core/lib/services/team.service')

      TeamService.getByOwnerId.mockResolvedValue([{ id: 'team-1', name: 'My Team' }])

      const result = await deleteAccount()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Cannot delete account while owning teams')
      }
    })

    it('returns error when user not found in database', async () => {
      const { TeamService } = require('@/core/lib/services/team.service')
      const { mutateWithRLS } = require('@/core/lib/db')

      TeamService.getByOwnerId.mockResolvedValue([])
      mockUserService.deleteAllUserMetas.mockResolvedValue(undefined)
      mutateWithRLS.mockResolvedValue({ rowCount: 0 })

      const result = await deleteAccount()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('User not found')
      }
    })

    it('revalidates root path after deletion', async () => {
      const { revalidatePath } = require('next/cache')
      const { TeamService } = require('@/core/lib/services/team.service')
      const { mutateWithRLS } = require('@/core/lib/db')

      TeamService.getByOwnerId.mockResolvedValue([])
      mockUserService.deleteAllUserMetas.mockResolvedValue(undefined)
      mutateWithRLS.mockResolvedValue({ rowCount: 1 })

      await deleteAccount()

      expect(revalidatePath).toHaveBeenCalledWith('/')
    })

    it('handles errors gracefully', async () => {
      const { TeamService } = require('@/core/lib/services/team.service')

      TeamService.getByOwnerId.mockRejectedValue(new Error('Database error'))

      const result = await deleteAccount()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Database error')
      }
    })
  })

  // ===========================================
  // Error handling
  // ===========================================

  describe('error handling', () => {
    it('handles non-Error exceptions', async () => {
      mockUserService.updateUser.mockRejectedValue('String error')

      const result = await updateProfile({ firstName: 'John' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Failed to update profile')
      }
    })

    it('logs errors to console', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockUserService.updateUser.mockRejectedValue(new Error('Test error'))

      await updateProfile({ firstName: 'John' })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[updateProfile]'),
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })
})
