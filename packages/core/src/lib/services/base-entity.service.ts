/**
 * Base Entity Service
 *
 * Provides standard CRUD operations for entities with RLS support.
 * Entities extend this class and get type-safe operations out of the box.
 *
 * @example
 * ```typescript
 * export class ProductsService extends BaseEntityService<Product, CreateProduct, UpdateProduct> {
 *   constructor() {
 *     super({
 *       tableName: 'products',
 *       fields: ['title', 'description', 'status'],
 *       searchableFields: ['title'],
 *     })
 *   }
 *
 *   // Custom methods when needed
 *   async getByStatus(userId: string, status: string): Promise<Product[]> {
 *     return this.query(userId, {
 *       where: { status },
 *       orderBy: 'createdAt',
 *       orderDir: 'desc',
 *     })
 *   }
 * }
 * ```
 *
 * @module BaseEntityService
 */

import { queryWithRLS, queryOneWithRLS, mutateWithRLS } from '../db'

// ============================================
// TYPES
// ============================================

export interface ListOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
  where?: Record<string, unknown>
  search?: string
}

export interface ListResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

export interface EntityServiceConfig {
  /** Database table name (snake_case, e.g., 'products' or 'blog_posts') */
  tableName: string
  /** Entity fields that can be selected/inserted/updated (excluding system fields) */
  fields: string[]
  /** Fields that support text search (optional) */
  searchableFields?: string[]
  /** Default order by field */
  defaultOrderBy?: string
  /** Default order direction */
  defaultOrderDir?: 'asc' | 'desc'
  /** Default page size */
  defaultLimit?: number
}

// System fields that are always included
const SYSTEM_FIELDS = ['id', 'userId', 'teamId', 'createdAt', 'updatedAt']

// ============================================
// BASE SERVICE CLASS
// ============================================

export abstract class BaseEntityService<
  TEntity,
  TCreate = Partial<TEntity>,
  TUpdate = Partial<TEntity>
> {
  protected config: Required<EntityServiceConfig>

  constructor(config: EntityServiceConfig) {
    this.config = {
      searchableFields: [],
      defaultOrderBy: 'createdAt',
      defaultOrderDir: 'desc',
      defaultLimit: 20,
      ...config,
    }
  }

  // ============================================
  // PROTECTED HELPERS
  // ============================================

  /**
   * Get all selectable fields (entity fields + system fields)
   */
  protected get selectFields(): string[] {
    return [...SYSTEM_FIELDS, ...this.config.fields]
  }

  /**
   * Build SELECT clause with proper quoting
   */
  protected buildSelectClause(): string {
    return this.selectFields
      .map((f) => (f.includes('_') || /[A-Z]/.test(f) ? `"${f}"` : f))
      .join(', ')
  }

  /**
   * Quote a field name if needed
   */
  protected quoteField(field: string): string {
    return field.includes('_') || /[A-Z]/.test(field) ? `"${field}"` : field
  }

  /**
   * Build WHERE clause from conditions
   */
  protected buildWhereClause(
    where: Record<string, unknown>,
    startIndex: number = 1
  ): { clause: string; params: unknown[]; nextIndex: number } {
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = startIndex

    for (const [key, value] of Object.entries(where)) {
      if (value === undefined) continue

      const quotedKey = this.quoteField(key)

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
  protected buildSearchCondition(
    search: string,
    paramIndex: number
  ): { condition: string; param: string } | null {
    if (!search || this.config.searchableFields.length === 0) {
      return null
    }

    const searchConditions = this.config.searchableFields
      .map((f) => `${this.quoteField(f)} ILIKE $${paramIndex}`)
      .join(' OR ')

    return {
      condition: `(${searchConditions})`,
      param: `%${search}%`,
    }
  }

  /**
   * Map database row to entity (override for custom mapping)
   */
  protected mapRowToEntity(row: Record<string, unknown>): TEntity {
    // Default: direct mapping with null -> undefined conversion
    const entity: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      entity[key] = value === null ? undefined : value
    }
    return entity as TEntity
  }

  // ============================================
  // PUBLIC CRUD METHODS
  // ============================================

  /**
   * Get entity by ID
   *
   * @param id - Entity ID
   * @param userId - Current user ID for RLS
   * @returns Entity or null if not found
   */
  async getById(id: string, userId: string): Promise<TEntity | null> {
    if (!id?.trim()) {
      throw new Error('Entity ID is required')
    }
    if (!userId?.trim()) {
      throw new Error('User ID is required for authentication')
    }

    const row = await queryOneWithRLS<Record<string, unknown>>(
      `SELECT ${this.buildSelectClause()}
       FROM ${this.config.tableName}
       WHERE id = $1`,
      [id],
      userId
    )

    return row ? this.mapRowToEntity(row) : null
  }

  /**
   * List entities with pagination, filtering, and search
   *
   * @param userId - Current user ID for RLS
   * @param options - List options (limit, offset, where, search, orderBy)
   * @returns Paginated result with data and total count
   */
  async list(userId: string, options: ListOptions = {}): Promise<ListResult<TEntity>> {
    if (!userId?.trim()) {
      throw new Error('User ID is required for authentication')
    }

    const {
      limit = this.config.defaultLimit,
      offset = 0,
      orderBy = this.config.defaultOrderBy,
      orderDir = this.config.defaultOrderDir,
      where = {},
      search,
    } = options

    // Build WHERE clause
    const { clause: whereClause, params, nextIndex } = this.buildWhereClause(where)

    // Add search condition if provided
    let fullWhereClause = whereClause
    const allParams = [...params]
    let paramIdx = nextIndex

    if (search) {
      const searchResult = this.buildSearchCondition(search, paramIdx)
      if (searchResult) {
        const connector = whereClause ? ' AND ' : 'WHERE '
        fullWhereClause = `${whereClause}${connector}${searchResult.condition}`
        allParams.push(searchResult.param)
        paramIdx++
      }
    }

    // Validate orderBy to prevent SQL injection
    const validOrderBy = this.selectFields.includes(orderBy) ? orderBy : this.config.defaultOrderBy
    const validOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC'
    const orderColumn = this.quoteField(validOrderBy)

    // Get total count
    const countResult = await queryWithRLS<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM ${this.config.tableName} ${fullWhereClause}`,
      allParams,
      userId
    )
    const total = parseInt(countResult[0]?.count || '0', 10)

    // Get data
    const limitIdx = paramIdx
    const offsetIdx = paramIdx + 1
    const rows = await queryWithRLS<Record<string, unknown>>(
      `SELECT ${this.buildSelectClause()}
       FROM ${this.config.tableName}
       ${fullWhereClause}
       ORDER BY ${orderColumn} ${validOrderDir}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...allParams, limit, offset],
      userId
    )

    return {
      data: rows.map((row) => this.mapRowToEntity(row)),
      total,
      limit,
      offset,
    }
  }

  /**
   * Query entities with custom conditions (simpler than list)
   *
   * @param userId - Current user ID for RLS
   * @param options - Query options
   * @returns Array of entities
   */
  async query(userId: string, options: Omit<ListOptions, 'offset'> = {}): Promise<TEntity[]> {
    const result = await this.list(userId, { ...options, offset: 0 })
    return result.data
  }

  /**
   * Create a new entity
   *
   * @param userId - Current user ID for RLS and ownership
   * @param teamId - Team ID for team isolation
   * @param data - Entity data
   * @returns Created entity
   */
  async create(userId: string, teamId: string, data: TCreate): Promise<TEntity> {
    if (!userId?.trim()) {
      throw new Error('User ID is required')
    }
    if (!teamId?.trim()) {
      throw new Error('Team ID is required')
    }

    // Build INSERT statement
    const insertData = data as Record<string, unknown>
    const fields: string[] = ['userId', 'teamId']
    const values: unknown[] = [userId, teamId]
    const placeholders: string[] = ['$1', '$2']
    let paramIndex = 3

    for (const field of this.config.fields) {
      if (field in insertData && insertData[field] !== undefined) {
        fields.push(field)
        values.push(insertData[field])
        placeholders.push(`$${paramIndex}`)
        paramIndex++
      }
    }

    const quotedFields = fields.map((f) => this.quoteField(f)).join(', ')

    const result = await mutateWithRLS<Record<string, unknown>>(
      `INSERT INTO ${this.config.tableName} (${quotedFields})
       VALUES (${placeholders.join(', ')})
       RETURNING ${this.buildSelectClause()}`,
      values,
      userId
    )

    if (!result.rows[0]) {
      throw new Error('Failed to create entity')
    }

    return this.mapRowToEntity(result.rows[0])
  }

  /**
   * Update an existing entity
   *
   * @param id - Entity ID
   * @param userId - Current user ID for RLS
   * @param data - Fields to update
   * @returns Updated entity
   */
  async update(id: string, userId: string, data: TUpdate): Promise<TEntity> {
    if (!id?.trim()) {
      throw new Error('Entity ID is required')
    }
    if (!userId?.trim()) {
      throw new Error('User ID is required')
    }

    // Build UPDATE statement
    const updateData = data as Record<string, unknown>
    const setClauses: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    for (const field of this.config.fields) {
      if (field in updateData) {
        setClauses.push(`${this.quoteField(field)} = $${paramIndex}`)
        values.push(updateData[field])
        paramIndex++
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No fields to update')
    }

    // Add updatedAt
    setClauses.push(`"updatedAt" = now()`)

    // Add id parameter
    values.push(id)

    const result = await mutateWithRLS<Record<string, unknown>>(
      `UPDATE ${this.config.tableName}
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING ${this.buildSelectClause()}`,
      values,
      userId
    )

    if (!result.rows[0]) {
      throw new Error('Entity not found or not authorized')
    }

    return this.mapRowToEntity(result.rows[0])
  }

  /**
   * Delete an entity
   *
   * @param id - Entity ID
   * @param userId - Current user ID for RLS
   * @returns true if deleted, false if not found
   */
  async delete(id: string, userId: string): Promise<boolean> {
    if (!id?.trim()) {
      throw new Error('Entity ID is required')
    }
    if (!userId?.trim()) {
      throw new Error('User ID is required')
    }

    const result = await mutateWithRLS(
      `DELETE FROM ${this.config.tableName} WHERE id = $1`,
      [id],
      userId
    )

    return result.rowCount > 0
  }

  /**
   * Check if an entity exists
   *
   * @param id - Entity ID
   * @param userId - Current user ID for RLS
   * @returns true if exists and accessible
   */
  async exists(id: string, userId: string): Promise<boolean> {
    if (!id?.trim() || !userId?.trim()) {
      return false
    }

    const result = await queryOneWithRLS<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ${this.config.tableName} WHERE id = $1) as exists`,
      [id],
      userId
    )

    return result?.exists ?? false
  }

  /**
   * Count entities with optional filtering
   *
   * @param userId - Current user ID for RLS
   * @param where - Filter conditions
   * @returns Count of matching entities
   */
  async count(userId: string, where: Record<string, unknown> = {}): Promise<number> {
    if (!userId?.trim()) {
      throw new Error('User ID is required')
    }

    const { clause, params } = this.buildWhereClause(where)

    const result = await queryWithRLS<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM ${this.config.tableName} ${clause}`,
      params,
      userId
    )

    return parseInt(result[0]?.count || '0', 10)
  }
}
