/**
 * Generic Entity Service
 *
 * Provides generic CRUD operations for any entity by slug.
 * Unlike BaseEntityService (which is abstract and extended per-entity),
 * this service allows operations on any registered entity dynamically.
 *
 * Used by Server Actions to perform entity operations without
 * needing entity-specific service classes.
 *
 * @example
 * ```typescript
 * // Create a school record
 * const school = await GenericEntityService.create('schools', userId, teamId, {
 *   name: 'MIT',
 *   status: 'active'
 * })
 *
 * // List campaigns with filtering
 * const result = await GenericEntityService.list('campaigns', userId, {
 *   where: { status: 'active' },
 *   limit: 20
 * })
 * ```
 */

import { queryWithRLS, queryOneWithRLS, mutateWithRLS } from '../db'
import { entityRegistry } from '../entities/registry'
import { executeBeforeHooks, executeAfterHooks } from '../entities/hooks'
import type { EntityConfig, EntityField, HookContext, TeamRole } from '../entities/types'

// ============================================
// TYPES
// ============================================

export interface GenericListOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
  where?: Record<string, unknown>
  search?: string
  teamId?: string
}

export interface GenericListResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

// System fields that are always included in queries
const SYSTEM_FIELDS = ['id', 'userId', 'teamId', 'createdAt', 'updatedAt']

// Default pagination values
const DEFAULT_LIMIT = 20
const DEFAULT_ORDER_BY = 'createdAt'
const DEFAULT_ORDER_DIR = 'desc'

// SQL identifier validation regex - prevents SQL injection in table/field names
const SAFE_SQL_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/

// ============================================
// VALIDATION TYPES
// ============================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate that a SQL identifier (table name, field name) is safe
 * Prevents SQL injection through malicious identifier names
 */
function validateSqlIdentifier(name: string, type: string): void {
  if (!name || !SAFE_SQL_IDENTIFIER.test(name)) {
    throw new Error(`Invalid ${type} name: "${name}" contains unsafe characters`)
  }
}

/**
 * Get the database table name for an entity (with validation)
 */
function getTableName(entityConfig: EntityConfig): string {
  const tableName = entityConfig.tableName || entityConfig.slug
  validateSqlIdentifier(tableName, 'table')
  return tableName
}

/**
 * Get field names from EntityConfig.fields (with validation)
 */
function getFieldNames(entityConfig: EntityConfig): string[] {
  if (!entityConfig.fields || !Array.isArray(entityConfig.fields)) {
    return []
  }
  return entityConfig.fields.map((field: EntityField) => {
    validateSqlIdentifier(field.name, 'field')
    return field.name
  })
}

/**
 * Get searchable field names from EntityConfig.fields
 */
function getSearchableFields(entityConfig: EntityConfig): string[] {
  if (!entityConfig.fields || !Array.isArray(entityConfig.fields)) {
    return []
  }
  return entityConfig.fields
    .filter((field: EntityField) => field.api?.searchable === true)
    .map((field: EntityField) => field.name)
}

/**
 * Quote a field name if needed (for camelCase or snake_case)
 */
function quoteField(field: string): string {
  return field.includes('_') || /[A-Z]/.test(field) ? `"${field}"` : field
}

/**
 * Build SELECT clause with all fields
 */
function buildSelectClause(fieldNames: string[]): string {
  const allFields = [...SYSTEM_FIELDS, ...fieldNames]
  return allFields.map(f => quoteField(f)).join(', ')
}

/**
 * Build WHERE clause from conditions
 * @param where - Filter conditions object
 * @param validFields - Array of valid field names (for SQL injection prevention)
 * @param startIndex - Starting parameter index
 */
function buildWhereClause(
  where: Record<string, unknown>,
  validFields: string[],
  startIndex: number = 1
): { clause: string; params: unknown[]; nextIndex: number } {
  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = startIndex

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue

    // SECURITY: Validate that the key is a valid field to prevent SQL injection
    if (!validFields.includes(key)) {
      throw new Error(`Invalid filter field: "${key}"`)
    }

    const quotedKey = quoteField(key)

    if (value === null) {
      conditions.push(`${quotedKey} IS NULL`)
    } else if (Array.isArray(value)) {
      conditions.push(`${quotedKey} = ANY($${paramIndex})`)
      params.push(value)
      paramIndex++
    } else {
      conditions.push(`${quotedKey} = $${paramIndex}`)
      params.push(value)
      paramIndex++
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    nextIndex: paramIndex,
  }
}

/**
 * Build search condition for text search
 */
function buildSearchCondition(
  search: string,
  searchableFields: string[],
  paramIndex: number
): { condition: string; param: string } | null {
  if (!search || searchableFields.length === 0) {
    return null
  }

  const searchConditions = searchableFields
    .map(f => `${quoteField(f)} ILIKE $${paramIndex}`)
    .join(' OR ')

  return {
    condition: `(${searchConditions})`,
    param: `%${search}%`,
  }
}

/**
 * Map database row to entity (null -> undefined conversion)
 */
function mapRowToEntity<T>(row: Record<string, unknown>): T {
  const entity: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    entity[key] = value === null ? undefined : value
  }
  return entity as T
}

/**
 * Validate field type matches expected type
 */
function validateFieldType(field: EntityField, value: unknown): string | null {
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'url':
    case 'markdown':
    case 'richtext':
    case 'code':
    case 'phone':
      if (typeof value !== 'string') {
        return `Field "${field.name}" must be a string`
      }
      break
    case 'number':
    case 'range':
    case 'rating':
      if (typeof value !== 'number') {
        return `Field "${field.name}" must be a number`
      }
      break
    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Field "${field.name}" must be a boolean`
      }
      break
    case 'select':
    case 'radio':
    case 'buttongroup':
      if (field.options && !field.options.some(opt => opt.value === value)) {
        return `Field "${field.name}" has invalid option value`
      }
      break
    case 'multiselect':
    case 'tags':
      if (!Array.isArray(value)) {
        return `Field "${field.name}" must be an array`
      }
      if (field.options) {
        const invalidValues = (value as unknown[]).filter(
          v => !field.options!.some(opt => opt.value === v)
        )
        if (invalidValues.length > 0) {
          return `Field "${field.name}" contains invalid option values`
        }
      }
      break
    case 'date':
    case 'datetime':
      if (typeof value !== 'string' && !(value instanceof Date)) {
        return `Field "${field.name}" must be a date string or Date object`
      }
      break
    case 'json':
      // JSON can be any type, no validation needed
      break
  }
  return null
}

/**
 * Validate entity data against the entity configuration schema
 *
 * Validates field types, required fields, and selection options.
 * Can be used to pre-validate data before calling create/update actions.
 *
 * @param entityConfig - Entity configuration with field definitions
 * @param data - Data to validate
 * @param isUpdate - If true, required fields are not enforced (partial update)
 * @returns Validation result with { valid: boolean, errors: string[] }
 *
 * @example
 * ```typescript
 * import { entityRegistry } from '@nextsparkjs/core/entities'
 * import { validateEntityData } from '@nextsparkjs/core/services'
 *
 * const config = entityRegistry.get('schools')
 * const result = validateEntityData(config, formData, false)
 *
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors)
 * }
 * ```
 */
export function validateEntityData(
  entityConfig: EntityConfig,
  data: Record<string, unknown>,
  isUpdate: boolean = false
): ValidationResult {
  const errors: string[] = []

  for (const field of entityConfig.fields) {
    const value = data[field.name]

    // 1. Validate required fields (only on create, not update)
    if (!isUpdate && field.required && (value === undefined || value === null || value === '')) {
      errors.push(`Field "${field.name}" is required`)
      continue
    }

    // Skip further validation if value is not provided
    if (value === undefined || value === null) {
      continue
    }

    // 2. Validate with Zod schema if defined
    if (field.validation) {
      try {
        const result = field.validation.safeParse(value)
        if (!result.success) {
          const zodError = result.error.errors[0]
          errors.push(`Field "${field.name}": ${zodError?.message || 'Invalid value'}`)
          continue
        }
      } catch {
        // If Zod validation throws, continue with type validation
      }
    }

    // 3. Validate basic types
    const typeError = validateFieldType(field, value)
    if (typeError) {
      errors.push(typeError)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Create a hook context with minimal required fields
 * The actual role/permissions checking is done at the Server Action level
 */
function createHookContext(
  entitySlug: string,
  operation: 'create' | 'update' | 'delete' | 'read' | 'query',
  userId: string,
  data?: unknown,
  previousData?: unknown,
  role: TeamRole = 'member'
): HookContext {
  return {
    entityName: entitySlug,
    operation,
    data,
    previousData,
    user: { id: userId, role },
  }
}

// ============================================
// GENERIC ENTITY SERVICE
// ============================================

export class GenericEntityService {
  /**
   * Get entity by ID
   *
   * @param entitySlug - The entity type slug (e.g., 'campaigns', 'schools')
   * @param id - Entity ID
   * @param userId - Current user ID for RLS
   * @param teamId - Team ID for team isolation (prevents cross-team access)
   * @returns Entity or null if not found
   */
  static async getById<T = unknown>(
    entitySlug: string,
    id: string,
    userId: string,
    teamId?: string
  ): Promise<T | null> {
    if (!id?.trim()) {
      throw new Error('Entity ID is required')
    }
    if (!userId?.trim()) {
      throw new Error('User ID is required for authentication')
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      throw new Error(`Entity "${entitySlug}" not found in registry`)
    }

    const tableName = getTableName(entityConfig)
    const fieldNames = getFieldNames(entityConfig)
    const selectClause = buildSelectClause(fieldNames)

    // SECURITY: Filter by teamId to prevent cross-team access for multi-team users
    const whereClause = teamId
      ? `WHERE id = $1 AND "teamId" = $2`
      : `WHERE id = $1`
    const params = teamId ? [id, teamId] : [id]

    const row = await queryOneWithRLS<Record<string, unknown>>(
      `SELECT ${selectClause} FROM ${tableName} ${whereClause}`,
      params,
      userId
    )

    return row ? mapRowToEntity<T>(row) : null
  }

  /**
   * List entities with pagination, filtering, and search
   *
   * @param entitySlug - The entity type slug
   * @param userId - Current user ID for RLS
   * @param options - List options (limit, offset, where, search, orderBy)
   * @returns Paginated result with data and total count
   */
  static async list<T = unknown>(
    entitySlug: string,
    userId: string,
    options: GenericListOptions = {}
  ): Promise<GenericListResult<T>> {
    if (!userId?.trim()) {
      throw new Error('User ID is required for authentication')
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      throw new Error(`Entity "${entitySlug}" not found in registry`)
    }

    const tableName = getTableName(entityConfig)
    const fieldNames = getFieldNames(entityConfig)
    const searchableFields = getSearchableFields(entityConfig)
    const selectClause = buildSelectClause(fieldNames)
    const allFields = [...SYSTEM_FIELDS, ...fieldNames]

    const {
      limit = DEFAULT_LIMIT,
      offset = 0,
      orderBy = DEFAULT_ORDER_BY,
      orderDir = DEFAULT_ORDER_DIR,
      where = {},
      search,
      teamId,
    } = options

    // Add teamId to where if provided
    const effectiveWhere = teamId ? { ...where, teamId } : where

    // Build WHERE clause (pass valid fields for SQL injection prevention)
    const { clause: whereClause, params, nextIndex } = buildWhereClause(effectiveWhere, allFields)

    // Add search condition if provided
    let fullWhereClause = whereClause
    const allParams = [...params]
    let paramIdx = nextIndex

    if (search) {
      const searchResult = buildSearchCondition(search, searchableFields, paramIdx)
      if (searchResult) {
        const connector = whereClause ? ' AND ' : 'WHERE '
        fullWhereClause = `${whereClause}${connector}${searchResult.condition}`
        allParams.push(searchResult.param)
        paramIdx++
      }
    }

    // Validate orderBy to prevent SQL injection
    const validOrderBy = allFields.includes(orderBy) ? orderBy : DEFAULT_ORDER_BY
    const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
    const orderColumn = quoteField(validOrderBy)

    // Get total count
    const countResult = await queryWithRLS<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM ${tableName} ${fullWhereClause}`,
      allParams,
      userId
    )
    const total = parseInt(countResult[0]?.count || '0', 10)

    // Get data
    const limitIdx = paramIdx
    const offsetIdx = paramIdx + 1
    const rows = await queryWithRLS<Record<string, unknown>>(
      `SELECT ${selectClause}
       FROM ${tableName}
       ${fullWhereClause}
       ORDER BY ${orderColumn} ${validOrderDir}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...allParams, limit, offset],
      userId
    )

    return {
      data: rows.map(row => mapRowToEntity<T>(row)),
      total,
      limit,
      offset,
    }
  }

  /**
   * Create a new entity
   *
   * @param entitySlug - The entity type slug
   * @param userId - Current user ID for RLS and ownership
   * @param teamId - Team ID for team isolation
   * @param data - Entity data
   * @returns Created entity
   */
  static async create<T = unknown>(
    entitySlug: string,
    userId: string,
    teamId: string,
    data: Record<string, unknown>
  ): Promise<T> {
    if (!userId?.trim()) {
      throw new Error('User ID is required')
    }
    if (!teamId?.trim()) {
      throw new Error('Team ID is required')
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      throw new Error(`Entity "${entitySlug}" not found in registry`)
    }

    // Execute beforeCreate hooks (can modify data or cancel operation)
    const beforeContext = createHookContext(entitySlug, 'create', userId, data)
    const beforeResult = await executeBeforeHooks(entitySlug, 'create', beforeContext)
    if (!beforeResult.continue) {
      throw new Error(beforeResult.error || 'Operation cancelled by hook')
    }

    // Use potentially modified data from hooks
    const finalData = (beforeResult.data as Record<string, unknown>) ?? data

    // Validate data against entity schema
    const validation = validateEntityData(entityConfig, finalData, false)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }

    const tableName = getTableName(entityConfig)
    const fieldNames = getFieldNames(entityConfig)
    const selectClause = buildSelectClause(fieldNames)

    // Build INSERT statement
    const fields: string[] = ['userId', 'teamId']
    const values: unknown[] = [userId, teamId]
    const placeholders: string[] = ['$1', '$2']
    let paramIndex = 3

    for (const field of fieldNames) {
      if (field in finalData && finalData[field] !== undefined) {
        fields.push(field)
        values.push(finalData[field])
        placeholders.push(`$${paramIndex}`)
        paramIndex++
      }
    }

    const quotedFields = fields.map(f => quoteField(f)).join(', ')

    const result = await mutateWithRLS<Record<string, unknown>>(
      `INSERT INTO ${tableName} (${quotedFields})
       VALUES (${placeholders.join(', ')})
       RETURNING ${selectClause}`,
      values,
      userId
    )

    if (!result.rows[0]) {
      throw new Error('Failed to create entity')
    }

    const createdEntity = mapRowToEntity<T>(result.rows[0])

    // Execute afterCreate hooks (fire-and-forget, don't block response)
    const afterContext = createHookContext(entitySlug, 'create', userId, createdEntity)
    executeAfterHooks(entitySlug, 'create', afterContext).catch(err => {
      console.error(`[GenericEntityService] afterCreate hook error for ${entitySlug}:`, err)
    })

    return createdEntity
  }

  /**
   * Update an existing entity
   *
   * @param entitySlug - The entity type slug
   * @param id - Entity ID
   * @param userId - Current user ID for RLS
   * @param data - Fields to update
   * @param teamId - Team ID for team isolation (prevents cross-team access)
   * @returns Updated entity
   */
  static async update<T = unknown>(
    entitySlug: string,
    id: string,
    userId: string,
    data: Record<string, unknown>,
    teamId?: string
  ): Promise<T> {
    if (!id?.trim()) {
      throw new Error('Entity ID is required')
    }
    if (!userId?.trim()) {
      throw new Error('User ID is required')
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      throw new Error(`Entity "${entitySlug}" not found in registry`)
    }

    const tableName = getTableName(entityConfig)
    const fieldNames = getFieldNames(entityConfig)
    const selectClause = buildSelectClause(fieldNames)

    // SECURITY: Filter by teamId to prevent cross-team access for multi-team users
    const fetchWhereClause = teamId
      ? `WHERE id = $1 AND "teamId" = $2`
      : `WHERE id = $1`
    const fetchParams = teamId ? [id, teamId] : [id]

    // Fetch current entity for previousData in hooks
    const currentEntity = await queryOneWithRLS<Record<string, unknown>>(
      `SELECT ${selectClause} FROM ${tableName} ${fetchWhereClause}`,
      fetchParams,
      userId
    )

    if (!currentEntity) {
      throw new Error('Entity not found or not authorized')
    }

    // Execute beforeUpdate hooks (can modify data or cancel operation)
    const beforeContext = createHookContext(entitySlug, 'update', userId, data, currentEntity)
    const beforeResult = await executeBeforeHooks(entitySlug, 'update', beforeContext)
    if (!beforeResult.continue) {
      throw new Error(beforeResult.error || 'Operation cancelled by hook')
    }

    // Use potentially modified data from hooks
    const finalData = (beforeResult.data as Record<string, unknown>) ?? data

    // Validate data against entity schema (isUpdate=true allows partial data)
    const validation = validateEntityData(entityConfig, finalData, true)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }

    // Build UPDATE statement
    const setClauses: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    for (const field of fieldNames) {
      if (field in finalData) {
        setClauses.push(`${quoteField(field)} = $${paramIndex}`)
        values.push(finalData[field])
        paramIndex++
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No fields to update')
    }

    // Add updatedAt
    setClauses.push(`"updatedAt" = now()`)

    // Add id parameter (and teamId if provided)
    values.push(id)
    const idParamIndex = paramIndex
    paramIndex++

    let updateWhereClause = `WHERE id = $${idParamIndex}`
    if (teamId) {
      values.push(teamId)
      updateWhereClause += ` AND "teamId" = $${paramIndex}`
    }

    const result = await mutateWithRLS<Record<string, unknown>>(
      `UPDATE ${tableName}
       SET ${setClauses.join(', ')}
       ${updateWhereClause}
       RETURNING ${selectClause}`,
      values,
      userId
    )

    if (!result.rows[0]) {
      throw new Error('Update failed')
    }

    const updatedEntity = mapRowToEntity<T>(result.rows[0])

    // Execute afterUpdate hooks (fire-and-forget)
    const afterContext = createHookContext(entitySlug, 'update', userId, updatedEntity, currentEntity)
    executeAfterHooks(entitySlug, 'update', afterContext).catch(err => {
      console.error(`[GenericEntityService] afterUpdate hook error for ${entitySlug}:`, err)
    })

    return updatedEntity
  }

  /**
   * Delete an entity
   *
   * @param entitySlug - The entity type slug
   * @param id - Entity ID
   * @param userId - Current user ID for RLS
   * @param teamId - Team ID for team isolation (prevents cross-team access)
   * @returns true if deleted, false if not found
   */
  static async delete(
    entitySlug: string,
    id: string,
    userId: string,
    teamId?: string
  ): Promise<boolean> {
    if (!id?.trim()) {
      throw new Error('Entity ID is required')
    }
    if (!userId?.trim()) {
      throw new Error('User ID is required')
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      throw new Error(`Entity "${entitySlug}" not found in registry`)
    }

    const tableName = getTableName(entityConfig)
    const fieldNames = getFieldNames(entityConfig)
    const selectClause = buildSelectClause(fieldNames)

    // SECURITY: Filter by teamId to prevent cross-team access for multi-team users
    const whereClause = teamId
      ? `WHERE id = $1 AND "teamId" = $2`
      : `WHERE id = $1`
    const params = teamId ? [id, teamId] : [id]

    // Fetch entity before delete for hooks (previousData)
    const entityToDelete = await queryOneWithRLS<Record<string, unknown>>(
      `SELECT ${selectClause} FROM ${tableName} ${whereClause}`,
      params,
      userId
    )

    if (!entityToDelete) {
      return false // Entity not found or not accessible
    }

    // Execute beforeDelete hooks (can cancel operation)
    const beforeContext = createHookContext(entitySlug, 'delete', userId, undefined, entityToDelete)
    const beforeResult = await executeBeforeHooks(entitySlug, 'delete', beforeContext)
    if (!beforeResult.continue) {
      throw new Error(beforeResult.error || 'Operation cancelled by hook')
    }

    const result = await mutateWithRLS(
      `DELETE FROM ${tableName} ${whereClause}`,
      params,
      userId
    )

    const deleted = result.rowCount > 0

    if (deleted) {
      // Execute afterDelete hooks (fire-and-forget)
      const afterContext = createHookContext(entitySlug, 'delete', userId, undefined, entityToDelete)
      executeAfterHooks(entitySlug, 'delete', afterContext).catch(err => {
        console.error(`[GenericEntityService] afterDelete hook error for ${entitySlug}:`, err)
      })
    }

    return deleted
  }

  /**
   * Check if an entity exists
   *
   * @param entitySlug - The entity type slug
   * @param id - Entity ID
   * @param userId - Current user ID for RLS
   * @param teamId - Team ID for team isolation (prevents cross-team access)
   * @returns true if exists and accessible
   */
  static async exists(
    entitySlug: string,
    id: string,
    userId: string,
    teamId?: string
  ): Promise<boolean> {
    if (!id?.trim() || !userId?.trim()) {
      return false
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      return false
    }

    const tableName = getTableName(entityConfig)

    // SECURITY: Filter by teamId to prevent cross-team access for multi-team users
    const whereClause = teamId
      ? `WHERE id = $1 AND "teamId" = $2`
      : `WHERE id = $1`
    const params = teamId ? [id, teamId] : [id]

    const result = await queryOneWithRLS<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ${tableName} ${whereClause}) as exists`,
      params,
      userId
    )

    return result?.exists ?? false
  }

  /**
   * Count entities with optional filtering
   *
   * @param entitySlug - The entity type slug
   * @param userId - Current user ID for RLS
   * @param where - Filter conditions
   * @returns Count of matching entities
   */
  static async count(
    entitySlug: string,
    userId: string,
    where: Record<string, unknown> = {}
  ): Promise<number> {
    if (!userId?.trim()) {
      throw new Error('User ID is required')
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      throw new Error(`Entity "${entitySlug}" not found in registry`)
    }

    const tableName = getTableName(entityConfig)
    const fieldNames = getFieldNames(entityConfig)
    const allFields = [...SYSTEM_FIELDS, ...fieldNames]

    // Build WHERE clause (pass valid fields for SQL injection prevention)
    const { clause, params } = buildWhereClause(where, allFields)

    const result = await queryWithRLS<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM ${tableName} ${clause}`,
      params,
      userId
    )

    return parseInt(result[0]?.count || '0', 10)
  }

  /**
   * Delete multiple entities in a single query (batch operation)
   *
   * More efficient than calling delete() in a loop.
   *
   * @param entitySlug - The entity type slug
   * @param ids - Array of entity IDs to delete
   * @param userId - Current user ID for RLS
   * @param options - Optional configuration
   * @param options.executeHooks - If true, executes hooks for each entity (less efficient). Default: false
   * @param options.teamId - Team ID for team isolation (prevents cross-team access)
   * @returns Number of entities deleted
   *
   * @note When executeHooks is false (default), uses a single atomic DELETE query.
   * When executeHooks is true, deletes are performed sequentially and are NOT transactional.
   * If one delete fails mid-batch, previous deletes remain committed.
   */
  static async deleteMany(
    entitySlug: string,
    ids: string[],
    userId: string,
    options: { executeHooks?: boolean; teamId?: string } = {}
  ): Promise<number> {
    if (!ids?.length) {
      throw new Error('At least one ID is required')
    }
    if (!userId?.trim()) {
      throw new Error('User ID is required')
    }

    const entityConfig = entityRegistry.get(entitySlug)
    if (!entityConfig) {
      throw new Error(`Entity "${entitySlug}" not found in registry`)
    }

    const tableName = getTableName(entityConfig)
    const { executeHooks, teamId } = options

    // If hooks are enabled, use individual deletes to respect hooks
    if (executeHooks) {
      let deletedCount = 0
      for (const id of ids) {
        const deleted = await GenericEntityService.delete(entitySlug, id, userId, teamId)
        if (deleted) deletedCount++
      }
      return deletedCount
    }

    // SECURITY: Filter by teamId to prevent cross-team access for multi-team users
    const whereClause = teamId
      ? `WHERE id = ANY($1) AND "teamId" = $2`
      : `WHERE id = ANY($1)`
    const params = teamId ? [ids, teamId] : [ids]

    // Single query to delete all matching entities (no hooks)
    const result = await mutateWithRLS(
      `DELETE FROM ${tableName} ${whereClause}`,
      params,
      userId
    )

    return result.rowCount
  }
}
