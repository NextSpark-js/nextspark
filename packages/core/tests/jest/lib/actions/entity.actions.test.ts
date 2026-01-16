/**
 * Unit Tests - Entity Server Actions
 *
 * Tests all entity server actions for CRUD operations.
 * These tests mock the GenericEntityService, auth, and permissions.
 */

import {
  createEntity,
  updateEntity,
  deleteEntity,
  getEntity,
  listEntities,
  deleteEntities,
  entityExists,
  countEntities,
} from '@/core/lib/actions/entity.actions'
import { GenericEntityService } from '@/core/lib/services/generic-entity.service'
import { entityRegistry } from '@/core/lib/entities/registry'

// Mock GenericEntityService
jest.mock('@/core/lib/services/generic-entity.service', () => ({
  GenericEntityService: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    getById: jest.fn(),
    list: jest.fn(),
    exists: jest.fn(),
    count: jest.fn(),
  },
}))

// Mock entity registry
jest.mock('@/core/lib/entities/registry', () => ({
  entityRegistry: {
    get: jest.fn(),
  },
}))

// Mock Next.js cache functions
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
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

// Mock permissions
const mockCheckPermission = jest.fn()
jest.mock('@/core/lib/permissions/check', () => ({
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
}))

const mockGenericEntityService = GenericEntityService as jest.Mocked<typeof GenericEntityService>
const mockEntityRegistry = entityRegistry as jest.Mocked<typeof entityRegistry>

// ===========================================
// MOCK DATA
// ===========================================

const mockEntityConfig = {
  slug: 'test_entities',
  tableName: 'test_entities',
  enabled: true,
  names: { singular: 'Test Entity', plural: 'Test Entities' },
  icon: {},
  fields: [
    { name: 'title', type: 'text' },
    { name: 'status', type: 'select' },
  ],
  access: { public: false, api: true },
  ui: { dashboard: { showInMenu: true }, features: {} },
}

const mockEntity = {
  id: 'entity-123',
  userId: 'user-456',
  teamId: 'team-789',
  title: 'Test Entity',
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockSession = {
  user: { id: 'user-456', email: 'test@example.com' },
  session: { id: 'session-123' },
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function setupAuthenticatedUser() {
  mockHeaders.mockReturnValue(new Headers())
  mockCookies.mockReturnValue({
    get: jest.fn().mockReturnValue({ value: 'team-789' }),
  })
  mockGetTypedSession.mockResolvedValue(mockSession)
  mockCheckPermission.mockResolvedValue(true)
}

function setupUnauthenticatedUser() {
  mockHeaders.mockReturnValue(new Headers())
  mockCookies.mockReturnValue({
    get: jest.fn().mockReturnValue(undefined),
  })
  mockGetTypedSession.mockResolvedValue(null)
}

function setupNoTeamSelected() {
  mockHeaders.mockReturnValue(new Headers())
  mockCookies.mockReturnValue({
    get: jest.fn().mockReturnValue(undefined),
  })
  mockGetTypedSession.mockResolvedValue(mockSession)
}

function setupPermissionDenied() {
  mockHeaders.mockReturnValue(new Headers())
  mockCookies.mockReturnValue({
    get: jest.fn().mockReturnValue({ value: 'team-789' }),
  })
  mockGetTypedSession.mockResolvedValue(mockSession)
  mockCheckPermission.mockResolvedValue(false)
}

// ===========================================
// TESTS
// ===========================================

describe('Entity Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEntityRegistry.get.mockReturnValue(mockEntityConfig as any)
    setupAuthenticatedUser()
  })

  // ===========================================
  // Authentication Tests
  // ===========================================

  describe('authentication', () => {
    it('returns error when user is not authenticated', async () => {
      setupUnauthenticatedUser()

      const result = await createEntity('test_entities', { title: 'Test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Authentication required')
      }
    })

    it('returns error when no team is selected', async () => {
      setupNoTeamSelected()

      const result = await createEntity('test_entities', { title: 'Test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('No active team selected')
      }
    })
  })

  // ===========================================
  // Permission Tests
  // ===========================================

  describe('permissions', () => {
    it('returns error when user lacks create permission', async () => {
      setupPermissionDenied()

      const result = await createEntity('test_entities', { title: 'Test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Permission denied')
      }
      expect(mockCheckPermission).toHaveBeenCalledWith('user-456', 'team-789', 'test_entities.create')
    })

    it('returns error when user lacks update permission', async () => {
      setupPermissionDenied()

      const result = await updateEntity('test_entities', 'entity-123', { title: 'Updated' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Permission denied')
      }
      expect(mockCheckPermission).toHaveBeenCalledWith('user-456', 'team-789', 'test_entities.update')
    })

    it('returns error when user lacks delete permission', async () => {
      setupPermissionDenied()

      const result = await deleteEntity('test_entities', 'entity-123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Permission denied')
      }
      expect(mockCheckPermission).toHaveBeenCalledWith('user-456', 'team-789', 'test_entities.delete')
    })

    it('returns error when user lacks read permission', async () => {
      setupPermissionDenied()

      const result = await getEntity('test_entities', 'entity-123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Permission denied')
      }
      expect(mockCheckPermission).toHaveBeenCalledWith('user-456', 'team-789', 'test_entities.read')
    })

    it('returns error when user lacks list permission', async () => {
      setupPermissionDenied()

      const result = await listEntities('test_entities')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Permission denied')
      }
      expect(mockCheckPermission).toHaveBeenCalledWith('user-456', 'team-789', 'test_entities.list')
    })
  })

  // ===========================================
  // createEntity
  // ===========================================

  describe('createEntity', () => {
    it('creates entity successfully', async () => {
      mockGenericEntityService.create.mockResolvedValue(mockEntity)

      const result = await createEntity('test_entities', {
        title: 'New Entity',
        status: 'draft',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockEntity)
      }
      expect(mockGenericEntityService.create).toHaveBeenCalledWith(
        'test_entities',
        'user-456',
        'team-789',
        { title: 'New Entity', status: 'draft' }
      )
    })

    it('returns error when entity not found in registry', async () => {
      mockEntityRegistry.get.mockReturnValue(undefined)

      const result = await createEntity('unknown', { title: 'Test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not found in registry')
      }
    })

    it('handles service errors gracefully', async () => {
      mockGenericEntityService.create.mockRejectedValue(new Error('Database error'))

      const result = await createEntity('test_entities', { title: 'Test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Database error')
      }
    })

    it('revalidates default path after creation', async () => {
      const { revalidatePath } = require('next/cache')
      mockGenericEntityService.create.mockResolvedValue(mockEntity)

      await createEntity('test_entities', { title: 'Test' })

      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/test_entities')
    })

    it('revalidates custom paths when provided', async () => {
      const { revalidatePath } = require('next/cache')
      mockGenericEntityService.create.mockResolvedValue(mockEntity)

      await createEntity('test_entities', { title: 'Test' }, {
        revalidatePaths: ['/custom/path', '/another/path'],
      })

      expect(revalidatePath).toHaveBeenCalledWith('/custom/path')
      expect(revalidatePath).toHaveBeenCalledWith('/another/path')
    })

    it('revalidates tags when provided', async () => {
      const { revalidateTag } = require('next/cache')
      mockGenericEntityService.create.mockResolvedValue(mockEntity)

      await createEntity('test_entities', { title: 'Test' }, {
        revalidateTags: ['entity-list', 'stats'],
      })

      expect(revalidateTag).toHaveBeenCalledWith('entity-list')
      expect(revalidateTag).toHaveBeenCalledWith('stats')
    })
  })

  // ===========================================
  // updateEntity
  // ===========================================

  describe('updateEntity', () => {
    it('updates entity successfully', async () => {
      mockGenericEntityService.update.mockResolvedValue({ ...mockEntity, title: 'Updated' })

      const result = await updateEntity('test_entities', 'entity-123', {
        title: 'Updated',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Updated')
      }
    })

    it('returns error when id is empty', async () => {
      const result = await updateEntity('test_entities', '', { title: 'Test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Entity ID is required')
      }
    })

    it('returns error when entity not found in registry', async () => {
      mockEntityRegistry.get.mockReturnValue(undefined)

      const result = await updateEntity('unknown', 'entity-123', { title: 'Test' })

      expect(result.success).toBe(false)
    })

    it('revalidates entity detail path', async () => {
      const { revalidatePath } = require('next/cache')
      mockGenericEntityService.update.mockResolvedValue(mockEntity)

      await updateEntity('test_entities', 'entity-123', { title: 'Test' })

      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/test_entities')
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/test_entities/entity-123')
    })
  })

  // ===========================================
  // deleteEntity
  // ===========================================

  describe('deleteEntity', () => {
    it('deletes entity successfully', async () => {
      mockGenericEntityService.delete.mockResolvedValue(true)

      const result = await deleteEntity('test_entities', 'entity-123')

      expect(result.success).toBe(true)
    })

    it('returns error when entity not found', async () => {
      mockGenericEntityService.delete.mockResolvedValue(false)

      const result = await deleteEntity('test_entities', 'non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not found')
      }
    })

    it('returns error when id is empty', async () => {
      const result = await deleteEntity('test_entities', '')

      expect(result.success).toBe(false)
    })

    it('revalidates path after deletion', async () => {
      const { revalidatePath } = require('next/cache')
      mockGenericEntityService.delete.mockResolvedValue(true)

      await deleteEntity('test_entities', 'entity-123')

      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/test_entities')
    })
  })

  // ===========================================
  // getEntity
  // ===========================================

  describe('getEntity', () => {
    it('returns entity when found', async () => {
      mockGenericEntityService.getById.mockResolvedValue(mockEntity)

      const result = await getEntity('test_entities', 'entity-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockEntity)
      }
    })

    it('returns null when entity not found', async () => {
      mockGenericEntityService.getById.mockResolvedValue(null)

      const result = await getEntity('test_entities', 'non-existent')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeNull()
      }
    })

    it('returns error when id is empty', async () => {
      const result = await getEntity('test_entities', '')

      expect(result.success).toBe(false)
    })
  })

  // ===========================================
  // listEntities
  // ===========================================

  describe('listEntities', () => {
    it('returns paginated list', async () => {
      mockGenericEntityService.list.mockResolvedValue({
        data: [mockEntity],
        total: 1,
        limit: 20,
        offset: 0,
      })

      const result = await listEntities('test_entities')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toHaveLength(1)
        expect(result.data.total).toBe(1)
      }
    })

    it('passes options to service with teamId from cookies', async () => {
      mockGenericEntityService.list.mockResolvedValue({
        data: [],
        total: 0,
        limit: 10,
        offset: 20,
      })

      await listEntities('test_entities', {
        limit: 10,
        offset: 20,
        where: { status: 'active' },
      })

      expect(mockGenericEntityService.list).toHaveBeenCalledWith('test_entities', 'user-456', {
        limit: 10,
        offset: 20,
        where: { status: 'active' },
        teamId: 'team-789',
      })
    })
  })

  // ===========================================
  // deleteEntities (batch)
  // ===========================================

  describe('deleteEntities', () => {
    it('deletes multiple entities using deleteMany', async () => {
      mockGenericEntityService.deleteMany.mockResolvedValue(3)

      const result = await deleteEntities('test_entities', ['id1', 'id2', 'id3'])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.deletedCount).toBe(3)
      }
      // Note: teamId is now included for cross-team access prevention
      expect(mockGenericEntityService.deleteMany).toHaveBeenCalledWith(
        'test_entities',
        ['id1', 'id2', 'id3'],
        'user-456',
        { executeHooks: true, teamId: 'team-789' }
      )
    })

    it('returns error when ids array is empty', async () => {
      const result = await deleteEntities('test_entities', [])

      expect(result.success).toBe(false)
    })

    it('revalidates after batch delete', async () => {
      const { revalidatePath } = require('next/cache')
      mockGenericEntityService.deleteMany.mockResolvedValue(1)

      await deleteEntities('test_entities', ['id1'])

      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/test_entities')
    })
  })

  // ===========================================
  // entityExists
  // ===========================================

  describe('entityExists', () => {
    it('returns true when entity exists', async () => {
      mockGenericEntityService.exists.mockResolvedValue(true)

      const result = await entityExists('test_entities', 'entity-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(true)
      }
    })

    it('returns false when entity does not exist', async () => {
      mockGenericEntityService.exists.mockResolvedValue(false)

      const result = await entityExists('test_entities', 'non-existent')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(false)
      }
    })

    it('returns error when id is empty', async () => {
      const result = await entityExists('test_entities', '')

      expect(result.success).toBe(false)
    })
  })

  // ===========================================
  // countEntities
  // ===========================================

  describe('countEntities', () => {
    it('returns count', async () => {
      mockGenericEntityService.count.mockResolvedValue(42)

      const result = await countEntities('test_entities')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(42)
      }
    })

    it('returns count with filters', async () => {
      mockGenericEntityService.count.mockResolvedValue(10)

      const result = await countEntities('test_entities', { status: 'active' })

      expect(result.success).toBe(true)
      // Note: countEntities now includes teamId in where for security (prevents cross-team data access)
      expect(mockGenericEntityService.count).toHaveBeenCalledWith(
        'test_entities',
        'user-456',
        { status: 'active', teamId: 'team-789' }
      )
    })

    it('returns error when entity not in registry', async () => {
      mockEntityRegistry.get.mockReturnValue(undefined)

      const result = await countEntities('unknown')

      expect(result.success).toBe(false)
    })
  })

  // ===========================================
  // Error handling
  // ===========================================

  describe('error handling', () => {
    it('handles non-Error exceptions', async () => {
      mockGenericEntityService.create.mockRejectedValue('String error')

      const result = await createEntity('test_entities', { title: 'Test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Unknown error')
      }
    })

    it('logs errors to console', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockGenericEntityService.create.mockRejectedValue(new Error('Test error'))

      await createEntity('test_entities', { title: 'Test' })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[createEntity]'),
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })
})
