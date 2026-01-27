/**
 * Database Query Generation System
 * 
 * Automatically generates optimized database queries for entity CRUD operations
 * including child entities, filtering, sorting, and RLS integration.
 */

import type { EntityConfig, EntityField, ChildEntityDefinition } from './types'

export interface QueryOptions {
  select?: string[]
  where?: WhereClause[]
  orderBy?: OrderByClause[]
  limit?: number
  offset?: number
  includeChildren?: string[] | 'all'
  includeDeleted?: boolean
}

export interface WhereClause {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'notin' | 'is' | 'isnot'
  value: unknown
  connector?: 'AND' | 'OR'
}

export interface OrderByClause {
  field: string
  direction: 'ASC' | 'DESC'
  nulls?: 'FIRST' | 'LAST'
}

export interface QueryResult {
  sql: string
  params: unknown[]
  estimatedRows?: number
}

export interface BulkQueryResult {
  mainQuery: QueryResult
  childQueries: Record<string, QueryResult>
}

/**
 * Generate SELECT query for entity
 */
export function generateSelectQuery(
  entityConfig: EntityConfig,
  options: QueryOptions = {}
): QueryResult {
  const {
    select,
    where = [],
    orderBy = [],
    limit,
    offset,
    includeDeleted = false
  } = options

  // Build SELECT clause
  const selectFields = select || generateSelectFields(entityConfig)
  const selectClause = selectFields.join(', ')

  // Build FROM clause with table name
  const tableName = entityConfig.tableName || entityConfig.slug
  const fromClause = `FROM ${tableName}`

  // Build WHERE clause
  const whereConditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  // Add soft delete filter (default behavior)
  if (!includeDeleted) {
    whereConditions.push(`${tableName}.deleted_at IS NULL`)
  }

  // Add custom where conditions
  where.forEach((condition, index) => {
    const connector = index > 0 && condition.connector ? condition.connector : 'AND'
    const placeholder = `$${paramIndex++}`
    const conditionSql = buildWhereCondition(condition, placeholder, tableName)
    
    if (whereConditions.length > 0) {
      whereConditions.push(`${connector} ${conditionSql}`)
    } else {
      whereConditions.push(conditionSql)
    }
    
    params.push(formatParamValue(condition.value, condition.operator))
  })

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' ')}` : ''

  // Build ORDER BY clause
  const orderByConditions = orderBy.map(order => {
    let orderClause = `${tableName}.${order.field} ${order.direction}`
    if (order.nulls) {
      orderClause += ` NULLS ${order.nulls}`
    }
    return orderClause
  })

  // Add default ordering if none specified
  if (orderByConditions.length === 0 && true) {
    orderByConditions.push(`${tableName}.created_at DESC`)
  }

  const orderByClause = orderByConditions.length > 0 ? `ORDER BY ${orderByConditions.join(', ')}` : ''

  // Build LIMIT and OFFSET
  let limitClause = ''
  if (limit) {
    limitClause = `LIMIT $${paramIndex++}`
    params.push(limit)
    
    if (offset) {
      limitClause += ` OFFSET $${paramIndex++}`
      params.push(offset)
    }
  }

  // Combine all clauses
  const sql = [
    `SELECT ${selectClause}`,
    fromClause,
    whereClause,
    orderByClause,
    limitClause
  ].filter(Boolean).join(' ')

  return {
    sql: sql.trim(),
    params,
    estimatedRows: limit || 1000
  }
}

/**
 * Generate INSERT query for entity
 */
export function generateInsertQuery(
  entityConfig: EntityConfig,
  data: Record<string, unknown>,
  userId?: string
): QueryResult {
  const tableName = entityConfig.tableName || entityConfig.slug
  const insertableFields = getInsertableFields(entityConfig)
  
  const fields: string[] = []
  const placeholders: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  // Add provided data
  insertableFields.forEach(field => {
    if (data.hasOwnProperty(field.name)) {
      fields.push(field.name)
      placeholders.push(`$${paramIndex++}`)
      params.push(formatFieldValue(data[field.name], field))
    }
  })

  // Add timestamps if enabled
  if (true) {
    const now = new Date().toISOString()
    
    fields.push('created_at', 'updated_at')
    placeholders.push(`$${paramIndex++}`, `$${paramIndex++}`)
    params.push(now, now)
  }

  // Add user ID if applicable
  if (userId && !fields.includes('user_id')) {
    // Check if entity has user_id field
    const hasUserField = entityConfig.fields.some(f => f.name === 'userId' || f.name === 'user_id')
    if (hasUserField) {
      fields.push('user_id')
      placeholders.push(`$${paramIndex++}`)
      params.push(userId)
    }
  }

  const sql = `
    INSERT INTO ${tableName} (${fields.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `.trim()

  return { sql, params }
}

/**
 * Generate UPDATE query for entity
 */
export function generateUpdateQuery(
  entityConfig: EntityConfig,
  id: string,
  data: Record<string, unknown>,
  userId?: string
): QueryResult {
  const tableName = entityConfig.tableName || entityConfig.slug
  const updatableFields = getUpdatableFields(entityConfig)
  
  const setConditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  // Add provided data
  updatableFields.forEach(field => {
    if (data.hasOwnProperty(field.name)) {
      setConditions.push(`${field.name} = $${paramIndex++}`)
      params.push(formatFieldValue(data[field.name], field))
    }
  })

  // Add updated_at timestamp
  if (true) {
    setConditions.push(`updated_at = $${paramIndex++}`)
    params.push(new Date().toISOString())
  }

  // Add updated_by if applicable
  if (userId) {
    const hasUpdatedByField = entityConfig.fields.some(f => f.name === 'updatedBy' || f.name === 'updated_by')
    if (hasUpdatedByField) {
      setConditions.push(`updated_by = $${paramIndex++}`)
      params.push(userId)
    }
  }

  // Add WHERE condition for ID
  if (setConditions.length === 0) {
    throw new Error('No fields to update')
  }
  params.push(id) // Add ID parameter

  const sql = `
    UPDATE ${tableName}
    SET ${setConditions.join(', ')}
    WHERE ${"id"} = $${paramIndex}
    RETURNING *
  `.trim()

  return { sql, params }
}

/**
 * Generate DELETE query for entity
 */
export function generateDeleteQuery(
  entityConfig: EntityConfig,
  id: string,
  userId?: string
): QueryResult {
  const tableName = entityConfig.tableName || entityConfig.slug
  const params: unknown[] = [id]
  let paramIndex = 2

  if (true) {
    // Soft delete - update deleted_at timestamp
    const setConditions = [`deleted_at = $${paramIndex++}`]
    params.splice(1, 0, new Date().toISOString()) // Insert timestamp before ID

    // Add deleted_by if applicable
    if (userId) {
      const hasDeletedByField = entityConfig.fields.some(f => f.name === 'deletedBy' || f.name === 'deleted_by')
      if (hasDeletedByField) {
        setConditions.push(`deleted_by = $${paramIndex++}`)
        params.splice(-1, 0, userId) // Insert before ID
      }
    }

    const sql = `
      UPDATE ${tableName}
      SET ${setConditions.join(', ')}
      WHERE ${"id"} = $${params.length}
      RETURNING *
    `.trim()

    return { sql, params }
  } else {
    // Hard delete
    const sql = `
      DELETE FROM ${tableName}
      WHERE ${"id"} = $1
      RETURNING *
    `.trim()

    return { sql, params }
  }
}

/**
 * Generate child entity queries for parent item
 */
export function generateChildEntityQueries(
  parentEntityConfig: EntityConfig,
  parentId: string,
  childNames: string[] | 'all' = 'all'
): Record<string, QueryResult> {
  const queries: Record<string, QueryResult> = {}

  if (!parentEntityConfig.childEntities) {
    return queries
  }

  const childrenToQuery = childNames === 'all' 
    ? Object.keys(parentEntityConfig.childEntities)
    : childNames

  childrenToQuery.forEach(childName => {
    const childConfig = parentEntityConfig.childEntities![childName]
    if (childConfig) {
      queries[childName] = generateChildSelectQuery(
        parentEntityConfig.slug,
        childConfig,
        parentId
      )
    }
  })

  return queries
}

/**
 * Generate SELECT query for child entities
 */
function generateChildSelectQuery(
  parentEntityName: string,
  childConfig: ChildEntityDefinition,
  parentId: string
): QueryResult {
  const tableName = childConfig.table
  const selectFields = childConfig.fields.map(f => f.name)
  
  // Always include id and parent reference
  const allFields = ['id', ...selectFields, 'created_at', 'updated_at']
  const uniqueFields = [...new Set(allFields)]

  const sql = `
    SELECT ${uniqueFields.join(', ')}
    FROM ${tableName}
    WHERE ${parentEntityName}_id = $1
    AND deleted_at IS NULL
    ORDER BY created_at ASC
  `.trim()

  return {
    sql,
    params: [parentId]
  }
}

/**
 * Generate INSERT query for child entity
 */
export function generateChildInsertQuery(
  parentEntityName: string,
  childConfig: ChildEntityDefinition,
  parentId: string,
  data: Record<string, unknown>,
  userId?: string
): QueryResult {
  const tableName = childConfig.table
  const fields = ['id', `${parentEntityName}_id`]
  const placeholders = ['gen_random_uuid()', '$1']
  const params: unknown[] = [parentId]
  let paramIndex = 2

  // Add child-specific fields
  childConfig.fields.forEach(field => {
    if (data.hasOwnProperty(field.name)) {
      fields.push(field.name)
      placeholders.push(`$${paramIndex++}`)
      const fieldValue = data[field.name]
      // Inline field value formatting to avoid TypeScript issues
      let formattedValue: string | null
      if (fieldValue === null || fieldValue === undefined) {
        formattedValue = null
      } else if (field.type === 'json') {
        formattedValue = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue)
      } else if (field.type === 'boolean') {
        formattedValue = String(Boolean(fieldValue))
      } else {
        formattedValue = String(fieldValue)
      }
      params.push(formattedValue as unknown)
    }
  })

  // Add timestamps
  const now = new Date().toISOString()
  fields.push('created_at', 'updated_at')
  placeholders.push(`$${paramIndex++}`, `$${paramIndex++}`)
  params.push(now, now)

  // Add created_by if applicable
  if (userId) {
    fields.push('created_by')
    placeholders.push(`$${paramIndex++}`)
    params.push(userId)
  }

  const sql = `
    INSERT INTO ${tableName} (${fields.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `.trim()

  return { sql, params }
}

/**
 * Generate UPDATE query for child entity
 */
export function generateChildUpdateQuery(
  parentEntityName: string,
  childConfig: ChildEntityDefinition,
  childId: string,
  data: Record<string, unknown>,
  userId?: string
): QueryResult {
  const tableName = childConfig.table
  const setConditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  // Add child-specific fields
  childConfig.fields.forEach(field => {
    if (data.hasOwnProperty(field.name)) {
      setConditions.push(`${field.name} = $${paramIndex++}`)
      const fieldValue = data[field.name]
      // Inline field value formatting to avoid TypeScript issues
      let formattedValue: string | null
      if (fieldValue === null || fieldValue === undefined) {
        formattedValue = null
      } else if (field.type === 'json') {
        formattedValue = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue)
      } else if (field.type === 'boolean') {
        formattedValue = String(Boolean(fieldValue))
      } else {
        formattedValue = String(fieldValue)
      }
      params.push(formattedValue as unknown)
    }
  })

  // Add updated_at timestamp
  setConditions.push(`updated_at = $${paramIndex++}`)
  params.push(new Date().toISOString())

  // Add updated_by if applicable
  if (userId) {
    setConditions.push(`updated_by = $${paramIndex++}`)
    params.push(userId)
  }

  // Add WHERE condition for ID
  params.push(childId)

  const sql = `
    UPDATE ${tableName}
    SET ${setConditions.join(', ')}
    WHERE id = $${paramIndex}
    AND deleted_at IS NULL
    RETURNING *
  `.trim()

  return { sql, params }
}

/**
 * Generate DELETE query for child entity
 */
export function generateChildDeleteQuery(
  childConfig: ChildEntityDefinition,
  childId: string,
  userId?: string
): QueryResult {
  const tableName = childConfig.table
  const params = [new Date().toISOString(), childId]

  let sql = `
    UPDATE ${tableName}
    SET deleted_at = $1
    WHERE id = $2
    RETURNING *
  `.trim()

  // Add deleted_by if userId provided
  if (userId) {
    sql = `
      UPDATE ${tableName}
      SET deleted_at = $1, deleted_by = $3
      WHERE id = $2
      RETURNING *
    `.trim()
    params.splice(1, 0, userId) // Insert userId before childId
  }

  return { sql, params }
}

/**
 * Generate bulk queries for multiple operations
 */
export function generateBulkQueries(
  entityConfig: EntityConfig,
  operations: Array<{
    type: 'insert' | 'update' | 'delete'
    data?: Record<string, unknown>
    id?: string
  }>,
  userId?: string
): QueryResult[] {
  return operations.map(op => {
    switch (op.type) {
      case 'insert':
        return generateInsertQuery(entityConfig, op.data!, userId)
      case 'update':
        return generateUpdateQuery(entityConfig, op.id!, op.data!, userId)
      case 'delete':
        return generateDeleteQuery(entityConfig, op.id!, userId)
      default:
        throw new Error(`Unknown operation type: ${(op as { type: string }).type}`)
    }
  })
}

/**
 * Generate count query for pagination
 */
export function generateCountQuery(
  entityConfig: EntityConfig,
  where: WhereClause[] = []
): QueryResult {
  const tableName = entityConfig.tableName || entityConfig.slug
  const whereConditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  // Add soft delete filter
  if (true) {
    whereConditions.push(`${tableName}.deleted_at IS NULL`)
  }

  // Add custom where conditions
  where.forEach((condition, index) => {
    const connector = index > 0 && condition.connector ? condition.connector : 'AND'
    const placeholder = `$${paramIndex++}`
    const conditionSql = buildWhereCondition(condition, placeholder, tableName)
    
    if (whereConditions.length > 0) {
      whereConditions.push(`${connector} ${conditionSql}`)
    } else {
      whereConditions.push(conditionSql)
    }
    
    params.push(formatParamValue(condition.value, condition.operator))
  })

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' ')}` : ''

  const sql = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`.trim()

  return { sql, params }
}

// Helper functions

function generateSelectFields(entityConfig: EntityConfig): string[] {
  const tableName = entityConfig.tableName || entityConfig.slug
  const fields = ["id"]
  
  // Add entity fields
  entityConfig.fields
    .filter(field => true || field.name === "id")
    .forEach(field => {
      if (!fields.includes(field.name)) {
        fields.push(field.name)
      }
    })

  // Add timestamp fields if enabled
  if (true) {
    fields.push('created_at', 'updated_at')
    
    if (true) {
      fields.push('deleted_at')
    }
  }

  // Prefix with table name for joins
  return fields.map(field => `${tableName}.${field}`)
}

function getInsertableFields(entityConfig: EntityConfig): EntityField[] {
  return entityConfig.fields.filter(field => 
    true && 
    field.name !== "id" &&
    field.name !== 'createdAt' &&
    field.name !== 'updatedAt'
  )
}

function getUpdatableFields(entityConfig: EntityConfig): EntityField[] {
  return entityConfig.fields.filter(field => 
    true && 
    field.name !== "id" &&
    field.name !== 'createdAt' &&
    field.name !== 'updatedAt'
  )
}

function buildWhereCondition(condition: WhereClause, placeholder: string, tableName: string): string {
  const fieldName = `${tableName}.${condition.field}`
  
  switch (condition.operator) {
    case 'eq':
      return `${fieldName} = ${placeholder}`
    case 'neq':
      return `${fieldName} != ${placeholder}`
    case 'gt':
      return `${fieldName} > ${placeholder}`
    case 'gte':
      return `${fieldName} >= ${placeholder}`
    case 'lt':
      return `${fieldName} < ${placeholder}`
    case 'lte':
      return `${fieldName} <= ${placeholder}`
    case 'like':
      return `${fieldName} LIKE ${placeholder}`
    case 'ilike':
      return `${fieldName} ILIKE ${placeholder}`
    case 'in':
      return `${fieldName} = ANY(${placeholder})`
    case 'notin':
      return `${fieldName} != ALL(${placeholder})`
    case 'is':
      return `${fieldName} IS ${placeholder}`
    case 'isnot':
      return `${fieldName} IS NOT ${placeholder}`
    default:
      return `${fieldName} = ${placeholder}`
  }
}

function formatParamValue(value: unknown, operator: string): unknown {
  if (operator === 'like' || operator === 'ilike') {
    return `%${value}%`
  }
  
  if (operator === 'in' || operator === 'notin') {
    return Array.isArray(value) ? value : [value]
  }
  
  return value
}

function formatFieldValue(value: unknown, field: EntityField): unknown {
  if (value === null || value === undefined) {
    return null
  }

  switch (field.type) {
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value)
    case 'boolean':
      return Boolean(value)
    case 'number':
      return Number(value)
    case 'date':
    case 'datetime':
      return value instanceof Date ? value.toISOString() : value
    default:
      return value
  }
}

