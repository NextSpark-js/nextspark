/**
 * Unit Tests - GenericEntityService
 *
 * Tests all GenericEntityService methods for generic entity CRUD operations.
 * Unlike BaseEntityService, GenericEntityService operates on any entity by slug.
 */

import { GenericEntityService, validateEntityData } from '@/core/lib/services/generic-entity.service'
import { queryOneWithRLS, queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import { entityRegistry } from '@/core/lib/entities/registry'

// Mock database functions
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

// Mock entity registry
jest.mock('@/core/lib/entities/registry', () => ({
  entityRegistry: {
    get: jest.fn(),
  },
}))

// Mock hooks
jest.mock('@/core/lib/entities/hooks', () => ({
  executeBeforeHooks: jest.fn().mockResolvedValue({ continue: true }),
  executeAfterHooks: jest.fn().mockResolvedValue(undefined),
}))

const mockQueryOneWithRLS = queryOneWithRLS as jest.MockedFunction<typeof queryOneWithRLS>
const mockQueryWithRLS = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockMutateWithRLS = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>
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
    { name: 'title', type: 'text', api: { searchable: true } },
    { name: 'description', type: 'textarea', api: { searchable: true } },
    { name: 'status', type: 'select', api: { searchable: false } },
  ],
  access: { public: false, api: true },
  ui: { dashboard: { showInMenu: true }, features: {} },
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

describe('GenericEntityService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEntityRegistry.get.mockReturnValue(mockEntityConfig as any)
  })

  // ===========================================
  // getById
  // ===========================================

  describe('getById', () => {
    it('returns entity when found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(mockEntityRow)

      const result = await GenericEntityService.getById('test_entities', 'entity-123', 'user-456')

      expect(result).toEqual(mockEntityRow)
      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('FROM test_entities'),
        ['entity-123'],
        'user-456'
      )
    })

    it('returns null when entity not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await GenericEntityService.getById('test_entities', 'non-existent', 'user-456')

      expect(result).toBeNull()
    })

    it('converts null values to undefined', async () => {
      mockQueryOneWithRLS.mockResolvedValue({
        ...mockEntityRow,
        description: null,
      })

      const result = await GenericEntityService.getById<typeof mockEntityRow>(
        'test_entities',
        'entity-123',
        'user-456'
      )

      expect(result?.description).toBeUndefined()
    })

    it('throws error for empty id', async () => {
      await expect(
        GenericEntityService.getById('test_entities', '', 'user-456')
      ).rejects.toThrow('Entity ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(
        GenericEntityService.getById('test_entities', 'entity-123', '')
      ).rejects.toThrow('User ID is required for authentication')
    })

    it('throws error for unknown entity slug', async () => {
      mockEntityRegistry.get.mockReturnValue(undefined)

      await expect(
        GenericEntityService.getById('unknown_entity', 'entity-123', 'user-456')
      ).rejects.toThrow('Entity "unknown_entity" not found in registry')
    })
  })

  // ===========================================
  // list
  // ===========================================

  describe('list', () => {
    it('returns paginated results with default options', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([mockEntityRow, { ...mockEntityRow, id: 'entity-456' }])

      const result = await GenericEntityService.list('test_entities', 'user-456')

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.limit).toBe(20)
      expect(result.offset).toBe(0)
    })

    it('applies pagination options', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '100' }])
        .mockResolvedValueOnce([mockEntityRow])

      const result = await GenericEntityService.list('test_entities', 'user-456', {
        limit: 10,
        offset: 20,
      })

      expect(result.limit).toBe(10)
      expect(result.offset).toBe(20)
    })

    it('applies where filters', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await GenericEntityService.list('test_entities', 'user-456', {
        where: { status: 'active' },
      })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        expect.arrayContaining(['active']),
        'user-456'
      )
    })

    it('applies teamId filter', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await GenericEntityService.list('test_entities', 'user-456', {
        teamId: 'team-789',
      })

      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"teamId" = $1'),
        expect.arrayContaining(['team-789']),
        'user-456'
      )
    })

    it('applies search filter', async () => {
      mockQueryWithRLS
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([mockEntityRow])

      await GenericEntityService.list('test_entities', 'user-456', { search: 'test' })

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

      await GenericEntityService.list('test_entities', 'user-456', {
        orderBy: 'title',
        orderDir: 'asc',
      })

      expect(mockQueryWithRLS).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY title ASC'),
        expect.any(Array),
        'user-456'
      )
    })

    it('throws error for empty userId', async () => {
      await expect(GenericEntityService.list('test_entities', '')).rejects.toThrow(
        'User ID is required for authentication'
      )
    })

    it('throws error for unknown entity slug', async () => {
      mockEntityRegistry.get.mockReturnValue(undefined)

      await expect(
        GenericEntityService.list('unknown_entity', 'user-456')
      ).rejects.toThrow('Entity "unknown_entity" not found in registry')
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

      const result = await GenericEntityService.create('test_entities', 'user-456', 'team-789', {
        title: 'New Entity',
        description: 'A description',
        status: 'draft',
      })

      expect(result).toEqual(mockEntityRow)
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

      await GenericEntityService.create('test_entities', 'user-456', 'team-789', {
        title: 'Minimal Entity',
      })

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_entities'),
        expect.arrayContaining(['user-456', 'team-789', 'Minimal Entity']),
        'user-456'
      )
    })

    it('throws error for empty userId', async () => {
      await expect(
        GenericEntityService.create('test_entities', '', 'team-789', { title: 'Test' })
      ).rejects.toThrow('User ID is required')
    })

    it('throws error for empty teamId', async () => {
      await expect(
        GenericEntityService.create('test_entities', 'user-456', '', { title: 'Test' })
      ).rejects.toThrow('Team ID is required')
    })

    it('throws error when insert fails', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 0,
      })

      await expect(
        GenericEntityService.create('test_entities', 'user-456', 'team-789', { title: 'Test' })
      ).rejects.toThrow('Failed to create entity')
    })

    it('throws error for unknown entity slug', async () => {
      mockEntityRegistry.get.mockReturnValue(undefined)

      await expect(
        GenericEntityService.create('unknown_entity', 'user-456', 'team-789', { title: 'Test' })
      ).rejects.toThrow('Entity "unknown_entity" not found in registry')
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

      const result = await GenericEntityService.update(
        'test_entities',
        'entity-123',
        'user-456',
        { title: 'Updated Title' }
      )

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

      await GenericEntityService.update('test_entities', 'entity-123', 'user-456', {
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

      await GenericEntityService.update('test_entities', 'entity-123', 'user-456', {
        title: 'Test',
      })

      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('"updatedAt" = now()'),
        expect.any(Array),
        'user-456'
      )
    })

    it('throws error for empty id', async () => {
      await expect(
        GenericEntityService.update('test_entities', '', 'user-456', { title: 'Test' })
      ).rejects.toThrow('Entity ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(
        GenericEntityService.update('test_entities', 'entity-123', '', { title: 'Test' })
      ).rejects.toThrow('User ID is required')
    })

    it('throws error when no fields to update', async () => {
      await expect(
        GenericEntityService.update('test_entities', 'entity-123', 'user-456', {})
      ).rejects.toThrow('No fields to update')
    })

    it('throws error when entity not found', async () => {
      mockQueryOneWithRLS.mockResolvedValue(null) // Entity not found before update

      await expect(
        GenericEntityService.update('test_entities', 'non-existent', 'user-456', { title: 'Test' })
      ).rejects.toThrow('Entity not found or not authorized')
    })
  })

  // ===========================================
  // delete
  // ===========================================

  describe('delete', () => {
    it('deletes entity and returns true', async () => {
      // First SELECT to get entity for hooks
      mockQueryOneWithRLS.mockResolvedValue(mockEntityRow)
      // Then DELETE
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 1,
      })

      const result = await GenericEntityService.delete('test_entities', 'entity-123', 'user-456')

      expect(result).toBe(true)
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        'DELETE FROM test_entities WHERE id = $1',
        ['entity-123'],
        'user-456'
      )
    })

    it('returns false when entity not found', async () => {
      // SELECT returns null - entity not found
      mockQueryOneWithRLS.mockResolvedValue(null)

      const result = await GenericEntityService.delete('test_entities', 'non-existent', 'user-456')

      expect(result).toBe(false)
    })

    it('throws error for empty id', async () => {
      await expect(
        GenericEntityService.delete('test_entities', '', 'user-456')
      ).rejects.toThrow('Entity ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(
        GenericEntityService.delete('test_entities', 'entity-123', '')
      ).rejects.toThrow('User ID is required')
    })
  })

  // ===========================================
  // exists
  // ===========================================

  describe('exists', () => {
    it('returns true when entity exists', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ exists: true })

      const result = await GenericEntityService.exists('test_entities', 'entity-123', 'user-456')

      expect(result).toBe(true)
    })

    it('returns false when entity does not exist', async () => {
      mockQueryOneWithRLS.mockResolvedValue({ exists: false })

      const result = await GenericEntityService.exists('test_entities', 'non-existent', 'user-456')

      expect(result).toBe(false)
    })

    it('returns false for empty id', async () => {
      const result = await GenericEntityService.exists('test_entities', '', 'user-456')

      expect(result).toBe(false)
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })

    it('returns false for empty userId', async () => {
      const result = await GenericEntityService.exists('test_entities', 'entity-123', '')

      expect(result).toBe(false)
      expect(mockQueryOneWithRLS).not.toHaveBeenCalled()
    })

    it('returns false for unknown entity', async () => {
      mockEntityRegistry.get.mockReturnValue(undefined)

      const result = await GenericEntityService.exists('unknown_entity', 'entity-123', 'user-456')

      expect(result).toBe(false)
    })
  })

  // ===========================================
  // count
  // ===========================================

  describe('count', () => {
    it('returns count without filters', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '42' }])

      const result = await GenericEntityService.count('test_entities', 'user-456')

      expect(result).toBe(42)
    })

    it('returns count with filters', async () => {
      mockQueryWithRLS.mockResolvedValue([{ count: '10' }])

      const result = await GenericEntityService.count('test_entities', 'user-456', {
        status: 'active',
      })

      expect(result).toBe(10)
      expect(mockQueryWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['active'],
        'user-456'
      )
    })

    it('returns 0 when no results', async () => {
      mockQueryWithRLS.mockResolvedValue([])

      const result = await GenericEntityService.count('test_entities', 'user-456')

      expect(result).toBe(0)
    })

    it('throws error for empty userId', async () => {
      await expect(GenericEntityService.count('test_entities', '')).rejects.toThrow(
        'User ID is required'
      )
    })
  })

  // ===========================================
  // Entity config edge cases
  // ===========================================

  describe('entity config edge cases', () => {
    it('uses slug as tableName when tableName not specified', async () => {
      mockEntityRegistry.get.mockReturnValue({
        ...mockEntityConfig,
        tableName: undefined,
      } as any)
      mockQueryOneWithRLS.mockResolvedValue(mockEntityRow)

      await GenericEntityService.getById('test_entities', 'entity-123', 'user-456')

      expect(mockQueryOneWithRLS).toHaveBeenCalledWith(
        expect.stringContaining('FROM test_entities'),
        expect.any(Array),
        'user-456'
      )
    })

    it('handles entity config with empty fields array', async () => {
      mockEntityRegistry.get.mockReturnValue({
        ...mockEntityConfig,
        fields: [],
      } as any)
      mockQueryOneWithRLS.mockResolvedValue({
        id: 'entity-123',
        userId: 'user-456',
        teamId: 'team-789',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      })

      const result = await GenericEntityService.getById('test_entities', 'entity-123', 'user-456')

      expect(result).toBeDefined()
    })

    it('handles entity config with undefined fields', async () => {
      mockEntityRegistry.get.mockReturnValue({
        ...mockEntityConfig,
        fields: undefined,
      } as any)
      mockQueryOneWithRLS.mockResolvedValue({
        id: 'entity-123',
        userId: 'user-456',
        teamId: 'team-789',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      })

      const result = await GenericEntityService.getById('test_entities', 'entity-123', 'user-456')

      expect(result).toBeDefined()
    })
  })

  // ===========================================
  // deleteMany
  // ===========================================

  describe('deleteMany', () => {
    it('deletes multiple entities in single query', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 3,
      })

      const result = await GenericEntityService.deleteMany(
        'test_entities',
        ['id1', 'id2', 'id3'],
        'user-456'
      )

      expect(result).toBe(3)
      expect(mockMutateWithRLS).toHaveBeenCalledWith(
        'DELETE FROM test_entities WHERE id = ANY($1)',
        [['id1', 'id2', 'id3']],
        'user-456'
      )
    })

    it('returns 0 when no entities deleted', async () => {
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 0,
      })

      const result = await GenericEntityService.deleteMany(
        'test_entities',
        ['non-existent'],
        'user-456'
      )

      expect(result).toBe(0)
    })

    it('throws error for empty ids array', async () => {
      await expect(
        GenericEntityService.deleteMany('test_entities', [], 'user-456')
      ).rejects.toThrow('At least one ID is required')
    })

    it('throws error for empty userId', async () => {
      await expect(
        GenericEntityService.deleteMany('test_entities', ['id1'], '')
      ).rejects.toThrow('User ID is required')
    })

    it('throws error for unknown entity slug', async () => {
      mockEntityRegistry.get.mockReturnValue(undefined)

      await expect(
        GenericEntityService.deleteMany('unknown', ['id1'], 'user-456')
      ).rejects.toThrow('Entity "unknown" not found in registry')
    })

    it('uses individual deletes when executeHooks is true', async () => {
      // Setup mocks for individual delete (which calls getById first for hooks)
      mockQueryOneWithRLS.mockResolvedValue(mockEntityRow)
      mockMutateWithRLS.mockResolvedValue({
        rows: [],
        rowCount: 1,
      })

      const result = await GenericEntityService.deleteMany(
        'test_entities',
        ['id1', 'id2'],
        'user-456',
        { executeHooks: true }
      )

      expect(result).toBe(2)
      // Individual deletes should be called (via delete method which does SELECT first)
      expect(mockQueryOneWithRLS).toHaveBeenCalledTimes(2)
    })
  })

  // ===========================================
  // SQL Identifier Validation
  // ===========================================

  describe('SQL identifier validation', () => {
    it('rejects table names with invalid characters', async () => {
      mockEntityRegistry.get.mockReturnValue({
        ...mockEntityConfig,
        tableName: 'test; DROP TABLE users;--',
      } as any)

      await expect(
        GenericEntityService.getById('test_entities', 'entity-123', 'user-456')
      ).rejects.toThrow('Invalid table name')
    })

    it('rejects table names starting with numbers', async () => {
      mockEntityRegistry.get.mockReturnValue({
        ...mockEntityConfig,
        tableName: '123table',
      } as any)

      await expect(
        GenericEntityService.getById('test_entities', 'entity-123', 'user-456')
      ).rejects.toThrow('Invalid table name')
    })

    it('accepts valid table names with underscores', async () => {
      mockEntityRegistry.get.mockReturnValue({
        ...mockEntityConfig,
        tableName: 'valid_table_name',
      } as any)
      mockQueryOneWithRLS.mockResolvedValue(mockEntityRow)

      const result = await GenericEntityService.getById('test_entities', 'entity-123', 'user-456')

      expect(result).toBeDefined()
    })

    it('rejects field names with invalid characters', async () => {
      mockEntityRegistry.get.mockReturnValue({
        ...mockEntityConfig,
        fields: [
          { name: 'valid_field', type: 'text' },
          { name: 'invalid-field', type: 'text' }, // Hyphen is invalid
        ],
      } as any)

      await expect(
        GenericEntityService.getById('test_entities', 'entity-123', 'user-456')
      ).rejects.toThrow('Invalid field name')
    })
  })
})

// ===========================================
// validateEntityData (exported function)
// ===========================================

describe('validateEntityData', () => {
  const entityConfig = {
    slug: 'test',
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'count', type: 'number', required: false },
      { name: 'status', type: 'select', options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ]},
      { name: 'enabled', type: 'boolean' },
      { name: 'tags', type: 'multiselect', options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ]},
    ],
  } as any

  it('returns valid for correct data', () => {
    const result = validateEntityData(entityConfig, {
      title: 'Test Title',
      count: 42,
      status: 'active',
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('validates required fields on create', () => {
    const result = validateEntityData(entityConfig, {
      count: 42,
    }, false)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Field "title" is required')
  })

  it('skips required validation on update', () => {
    const result = validateEntityData(entityConfig, {
      count: 42,
    }, true)

    expect(result.valid).toBe(true)
  })

  it('validates number type', () => {
    const result = validateEntityData(entityConfig, {
      title: 'Test',
      count: 'not a number',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('"count"'))).toBe(true)
  })

  it('validates boolean type', () => {
    const result = validateEntityData(entityConfig, {
      title: 'Test',
      enabled: 'not a boolean',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('"enabled"'))).toBe(true)
  })

  it('validates select option values', () => {
    const result = validateEntityData(entityConfig, {
      title: 'Test',
      status: 'invalid_status',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('invalid option'))).toBe(true)
  })

  it('validates multiselect arrays', () => {
    const result = validateEntityData(entityConfig, {
      title: 'Test',
      tags: 'not an array',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('must be an array'))).toBe(true)
  })

  it('validates multiselect option values', () => {
    const result = validateEntityData(entityConfig, {
      title: 'Test',
      tags: ['a', 'invalid'],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('invalid option values'))).toBe(true)
  })

  it('skips validation for undefined/null values', () => {
    const result = validateEntityData(entityConfig, {
      title: 'Test',
      count: undefined,
      status: null,
    })

    expect(result.valid).toBe(true)
  })
})
