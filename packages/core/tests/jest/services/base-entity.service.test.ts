/**
 * Unit Tests - BaseEntityService
 *
 * Tests all BaseEntityService methods for entity CRUD operations.
 * Uses a concrete test implementation to test the abstract base class.
 */

import { BaseEntityService } from '@/core/lib/services/base-entity.service'
import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@/core/lib/db'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>

// ===========================================
// TEST ENTITY TYPES
// ===========================================

interface TestEntity {
  id: string
  userId: string
  teamId: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

interface CreateTestEntity {
  title: string
  description?: string
  status?: 'draft' | 'active' | 'archived'
}

interface UpdateTestEntity {
  title?: string
  description?: string
  status?: 'draft' | 'active' | 'archived'
}

// ===========================================
// TEST SERVICE IMPLEMENTATION
// ===========================================

class TestEntityService extends BaseEntityService<TestEntity, CreateTestEntity, UpdateTestEntity> {
  constructor() {
    super({
      tableName: 'test_entities',
      fields: ['title', 'description', 'status'],
      searchableFields: ['title', 'description'],
      defaultOrderBy: 'createdAt',
      defaultOrderDir: 'desc',
      defaultLimit: 20,
    })
  }
}

// ===========================================
// MOCK DATA
// ===========================================

const mockEntity: TestEntity = {
  id: 'entity-123',
  userId: 'user-456',
  teamId: 'team-789',
  title: 'Test Entity',
  description: 'A test description',
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockEntityRow = {
  id: 'entity-123',
  userId: 'user-456',
  teamId: 'team-789',
  title: 'Test Entity',
  description: 'A test description',
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

// ===========================================
// TESTS
// ===========================================

describe('BaseEntityService', () => {
  let service: TestEntityService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new TestEntityService()
  })

  // ===========================================
  // getById
  // ===========================================

  describe('getById', () => {
    it('returns entity when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockEntityRow)

      const result = await service.getById('entity-123', 'user-456')

      expect(result).toEqual(mockEntity)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('FROM test_entities'),
        ['entity-123'],
        'user-456'
      )
    })

    it('returns null when entity not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await service.getById('non-existent', 'user-456')

      expect(result).toBeNull()
    })

    it('converts null values to undefined', async () => {
      mockQueryOneWithRLS.mockResolvedValue({
        ...mockEntityRow,
        description: null,
      })

      const result = await service.getById('entity-123', 'user-456')

      expect(result?.description).toBeUndefined()
    })

    it('throws error for empty id', async () => {
      await expect(service.getById('', 'user-456')).rejects.toThrow('Entity ID is required')
      await expect(service.getById('  ', 'user-456')).rejects.toThrow('Entity ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(service.getById('entity-123', '')).rejects.toThrow(
        'User ID is required for authentication'
      )
    })
  })

  // ===========================================
  // list
  // ===========================================

  describe('list', () => {
    it('returns paginated results with default options', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '2' }]) // Count query
        .mockResolvedValueOnce([mockEntityRow, { ...mockEntityRow, id: 'entity-456' }]) // Data query

      const result = await service.list('user-456')

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.limit).toBe(20)
      expect(result.offset).toBe(0)
    })

    it('applies pagination options', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '100' }])
        .mockResolvedValueOnce([mockEntityRow])

      const result = await service.list('user-456', { limit: 10, offset: 20 })

      expect(result.limit).toBe(10)
      expect(result.offset).toBe(20)
      expect(mockQueryWithRLS).toHaveBeenLastCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [10, 20],
        'user-456'
      )
    })

    it('applies where filters', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await service.list('user-456', { where: { status: 'active' } })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        expect.arrayContaining(['active']),
        'user-456'
      )
    })

    it('applies multiple where filters', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await service.list('user-456', { where: { status: 'active', title: 'Test' } })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['active', 'Test']),
        'user-456'
      )
    })

    it('handles null values in where clause', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await service.list('user-456', { where: { description: null } })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('IS NULL'),
        expect.any(Array),
        'user-456'
      )
    })

    it('handles array values in where clause', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await service.list('user-456', { where: { status: ['active', 'draft'] } })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('= ANY($1)'),
        expect.arrayContaining([['active', 'draft']]),
        'user-456'
      )
    })

    it('applies search filter', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await service.list('user-456', { search: 'test' })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%test%']),
        'user-456'
      )
    })

    it('applies ordering', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await service.list('user-456', { orderBy: 'title', orderDir: 'asc' })

      expect(mockQueryWithRLS).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY title ASC'),
        expect.any(Array),
        'user-456'
      )
    })

    it('uses default ordering for invalid orderBy field', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await service.list('user-456', { orderBy: 'invalid_field' as any })

      expect(mockQueryWithRLS).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY "createdAt" DESC'),
        expect.any(Array),
        'user-456'
      )
    })

    it('throws error for empty userId', async () => {
      await expect(service.list('')).rejects.toThrow('User ID is required for authentication')
    })
  })

  // ===========================================
  // query
  // ===========================================

  describe('query', () => {
    it('returns data without pagination info', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([mockEntityRow, { ...mockEntityRow, id: 'entity-456' }])

      const result = await service.query('user-456', { where: { status: 'active' } })

      expect(result).toHaveLength(2)
      expect(Array.isArray(result)).toBe(true)
    })

    it('passes options to list method', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await service.query('user-456', { limit: 5, where: { status: 'active' } })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        expect.any(Array),
        'user-456'
      )
    })
  })

  // ===========================================
  // create
  // ===========================================

  describe('create', () => {
    it('creates entity with all fields', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [mockEntityRow],
        rowCount: 1,
      })

      const result = await service.create('user-456', 'team-789', {
        title: 'New Entity',
        description: 'A description',
        status: 'draft',
      })

      expect(result).toEqual(mockEntity)
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_entities'),
        expect.arrayContaining(['user-456', 'team-789', 'New Entity', 'A description', 'draft']),
        'user-456'
      )
    })

    it('creates entity with minimal fields', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [mockEntityRow],
        rowCount: 1,
      })

      await service.create('user-456', 'team-789', { title: 'Minimal Entity' })

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_entities'),
        expect.arrayContaining(['user-456', 'team-789', 'Minimal Entity']),
        'user-456'
      )
    })

    it('ignores undefined fields in VALUES clause', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [mockEntityRow],
        rowCount: 1,
      })

      await service.create('user-456', 'team-789', {
        title: 'Test',
        description: undefined,
      })

      // Should only include userId, teamId, and title in VALUES (3 params)
      // description is undefined so it should be excluded from insert fields
      const call = mockMutateWithRLS.mock.calls[0]
      const query = call[0] as string
      const params = call[1] as unknown[]

      // Only 3 values: userId, teamId, title
      expect(params).toHaveLength(3)
      expect(params).toEqual(['user-456', 'team-789', 'Test'])
      // VALUES clause should have $1, $2, $3 only
      expect(query).toContain('VALUES ($1, $2, $3)')
    })

    it('throws error for empty userId', async () => {
      await expect(
        service.create('', 'team-789', { title: 'Test' })
      ).rejects.toThrow('User ID is required')
    })

    it('throws error for empty teamId', async () => {
      await expect(
        service.create('user-456', '', { title: 'Test' })
      ).rejects.toThrow('Team ID is required')
    })

    it('throws error when insert fails', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 0,
      })

      await expect(
        service.create('user-456', 'team-789', { title: 'Test' })
      ).rejects.toThrow('Failed to create entity')
    })
  })

  // ===========================================
  // update
  // ===========================================

  describe('update', () => {
    it('updates single field', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [{ ...mockEntityRow, title: 'Updated Title' }],
        rowCount: 1,
      })

      const result = await service.update('entity-123', 'user-456', {
        title: 'Updated Title',
      })

      expect(result.title).toBe('Updated Title')
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_entities'),
        expect.arrayContaining(['Updated Title', 'entity-123']),
        'user-456'
      )
    })

    it('updates multiple fields', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [{ ...mockEntityRow, title: 'New Title', status: 'archived' }],
        rowCount: 1,
      })

      await service.update('entity-123', 'user-456', {
        title: 'New Title',
        status: 'archived',
      })

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('SET'),
        expect.arrayContaining(['New Title', 'archived']),
        'user-456'
      )
    })

    it('automatically updates updatedAt', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [mockEntityRow],
        rowCount: 1,
      })

      await service.update('entity-123', 'user-456', { title: 'Test' })

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"updatedAt" = now()'),
        expect.any(Array),
        'user-456'
      )
    })

    it('throws error for empty id', async () => {
      await expect(
        service.update('', 'user-456', { title: 'Test' })
      ).rejects.toThrow('Entity ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(
        service.update('entity-123', '', { title: 'Test' })
      ).rejects.toThrow('User ID is required')
    })

    it('throws error when no fields to update', async () => {
      await expect(
        service.update('entity-123', 'user-456', {})
      ).rejects.toThrow('No fields to update')
    })

    it('throws error when entity not found', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 0,
      })

      await expect(
        service.update('non-existent', 'user-456', { title: 'Test' })
      ).rejects.toThrow('Entity not found or not authorized')
    })
  })

  // ===========================================
  // delete
  // ===========================================

  describe('delete', () => {
    it('deletes entity and returns true', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 1,
      })

      const result = await service.delete('entity-123', 'user-456')

      expect(result).toBe(true)
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        'DELETE FROM test_entities WHERE id = $1',
        ['entity-123'],
        'user-456'
      )
    })

    it('returns false when entity not found', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 0,
      })

      const result = await service.delete('non-existent', 'user-456')

      expect(result).toBe(false)
    })

    it('throws error for empty id', async () => {
      await expect(service.delete('', 'user-456')).rejects.toThrow('Entity ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(service.delete('entity-123', '')).rejects.toThrow('User ID is required')
    })
  })

  // ===========================================
  // exists
  // ===========================================

  describe('exists', () => {
    it('returns true when entity exists', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ exists: true })

      const result = await service.exists('entity-123', 'user-456')

      expect(result).toBe(true)
    })

    it('returns false when entity does not exist', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ exists: false })

      const result = await service.exists('non-existent', 'user-456')

      expect(result).toBe(false)
    })

    it('returns false for empty id', async () => {
      const result = await service.exists('', 'user-456')

      expect(result).toBe(false)
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })

    it('returns false for empty userId', async () => {
      const result = await service.exists('entity-123', '')

      expect(result).toBe(false)
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })

    it('returns false when query returns null', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await service.exists('entity-123', 'user-456')

      expect(result).toBe(false)
    })
  })

  // ===========================================
  // count
  // ===========================================

  describe('count', () => {
    it('returns count without filters', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '42' }])

      const result = await service.count('user-456')

      expect(result).toBe(42)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        [],
        'user-456'
      )
    })

    it('returns count with filters', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '10' }])

      const result = await service.count('user-456', { status: 'active' })

      expect(result).toBe(10)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['active'],
        'user-456'
      )
    })

    it('returns 0 when no results', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      const result = await service.count('user-456')

      expect(result).toBe(0)
    })

    it('throws error for empty userId', async () => {
      await expect(service.count('')).rejects.toThrow('User ID is required')
    })
  })

  // ===========================================
  // EDGE CASES
  // ===========================================

  describe('edge cases', () => {
    it('handles camelCase field names correctly', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await service.list('user-456', { orderBy: 'createdAt' })

      expect(mockQueryWithRLS).toHaveBeenLastCalledWith(
        expect.stringContaining('"createdAt"'),
        expect.any(Array),
        'user-456'
      )
    })

    it('service without searchable fields ignores search', async () => {
      class NoSearchService extends BaseEntityService<TestEntity, CreateTestEntity, UpdateTestEntity> {
        constructor() {
          super({
            tableName: 'test_entities',
            fields: ['title', 'description', 'status'],
            // No searchableFields
          })
        }
      }

      const noSearchService = new NoSearchService()
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await noSearchService.list('user-456', { search: 'test' })

      // Should not include ILIKE in query
      expect(mockQueryWithRLS).not.toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.any(Array),
        'user-456'
      )
    })

    it('handles database errors gracefully', async () => {
      mockQueryOneWithRLS.mockRejectedValue(new Error('Database connection failed'))

      await expect(service.getById('entity-123', 'user-456')).rejects.toThrow(
        'Database connection failed'
      )
    })
  })
})
