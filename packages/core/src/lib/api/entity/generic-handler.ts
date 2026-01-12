/**
 * Generic Entity Handler
 *
 * Unified CRUD handler for all entities with dual authentication support.
 * Used by catch-all routes /api/v1/[entity]/ and /api/v1/[entity]/[id]/
 *
 * Phase 2 - Two-Layer Security Model:
 * - RLS (Database): Team isolation only - IDENTICAL for all entities
 * - App (Endpoints): User isolation based on access.shared config
 *
 * Team context is required for all entity operations via x-team-id header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, hasRequiredScope, canBypassTeamContext, type DualAuthResult } from '../auth/dual-auth'
import type { EntityField, EntityConfig, TaxonomyTypeConfig } from '../../entities/types'
import { resolveEntityFromUrl, validateEntityOperation } from './resolver'
import { generateEntitySchemas } from '../../entities/schema-generator'
import { queryWithRLS, mutateWithRLS, queryOneWithRLS } from '../../db'
import {
  createApiResponse,
  createApiError,
  parsePaginationParams,
  createPaginationMeta,
  parseMetaParams,
  parseChildParams,
  includeEntityMetadata,
  includeEntityChildren,
  processEntityMetadata,
  handleEntityMetadataInResponse,
  addCorsHeaders,
  handleCorsPreflightRequest
} from '../helpers'
import { afterEntityCreate, afterEntityUpdate, afterEntityDelete } from '../../entities/entity-hooks'

// ==========================================
// TAXONOMY HELPER FUNCTIONS
// ==========================================

/**
 * Include taxonomies in entity data based on EntityConfig.taxonomies
 * Queries entity_taxonomy_relations and joins with taxonomies table
 */
async function includeTaxonomiesInData<T extends { id: string }>(
  entityConfig: EntityConfig,
  items: T[],
  userId: string | null
): Promise<T[]> {
  // Skip if taxonomies not enabled or no items
  if (!entityConfig.taxonomies?.enabled || !entityConfig.taxonomies?.types?.length || items.length === 0) {
    return items
  }

  const entityIds = items.map(item => item.id)
  const entityType = entityConfig.slug

  // Build a map of entityId -> taxonomies grouped by field
  const taxonomyMap: Record<string, Record<string, Array<{ id: string; name: string; slug: string; color?: string; icon?: string }>>> = {}

  // Query all taxonomy relations for these entities
  const placeholders = entityIds.map((_, i) => `$${i + 2}`).join(', ')
  const taxonomyQuery = `
    SELECT
      etr."entityId",
      etr."order",
      t.id,
      t.name,
      t.slug,
      t.type,
      t.color,
      t.icon
    FROM entity_taxonomy_relations etr
    JOIN taxonomies t ON etr."taxonomyId" = t.id
    WHERE etr."entityType" = $1
      AND etr."entityId" IN (${placeholders})
      AND t."isActive" = true
      AND t."deletedAt" IS NULL
    ORDER BY etr."order" ASC
  `

  const taxonomyResults = await queryWithRLS<{
    entityId: string
    order: number
    id: string
    name: string
    slug: string
    type: string
    color?: string
    icon?: string
  }>(taxonomyQuery, [entityType, ...entityIds], userId)

  // Group taxonomies by entityId and taxonomy type
  for (const row of taxonomyResults) {
    if (!taxonomyMap[row.entityId]) {
      taxonomyMap[row.entityId] = {}
    }

    // Find which field this taxonomy type belongs to
    const taxonomyTypeConfig: TaxonomyTypeConfig | undefined = entityConfig.taxonomies.types.find(tc => tc.type === row.type)
    if (taxonomyTypeConfig) {
      const fieldName = taxonomyTypeConfig.field
      if (!taxonomyMap[row.entityId][fieldName]) {
        taxonomyMap[row.entityId][fieldName] = []
      }
      taxonomyMap[row.entityId][fieldName].push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        color: row.color,
        icon: row.icon,
      })
    }
  }

  // Add taxonomy fields to each item
  return items.map(item => {
    const itemTaxonomies = taxonomyMap[item.id] || {}

    // Initialize all taxonomy fields with empty arrays
    const taxonomyFields: Record<string, unknown[]> = {}
    for (const tc of entityConfig.taxonomies!.types) {
      taxonomyFields[tc.field] = itemTaxonomies[tc.field] || []
    }

    return {
      ...item,
      ...taxonomyFields,
    }
  })
}

/**
 * Process taxonomy relations for create/update operations
 * Handles inserting/updating entity_taxonomy_relations
 */
async function processTaxonomyRelations(
  entityConfig: EntityConfig,
  entityId: string,
  data: Record<string, unknown>,
  userId: string,
  isUpdate: boolean = false
): Promise<void> {
  // Skip if taxonomies not enabled
  if (!entityConfig.taxonomies?.enabled || !entityConfig.taxonomies?.types?.length) {
    return
  }

  const entityType = entityConfig.slug

  for (const taxonomyType of entityConfig.taxonomies.types) {
    const fieldName = taxonomyType.field
    const taxonomyIds = data[fieldName]

    // Skip if field not provided in request
    if (taxonomyIds === undefined) continue

    // For updates, delete existing relations first
    if (isUpdate) {
      await mutateWithRLS(
        `DELETE FROM entity_taxonomy_relations
         WHERE "entityType" = $1 AND "entityId" = $2
         AND "taxonomyId" IN (SELECT id FROM taxonomies WHERE type = $3)`,
        [entityType, entityId, taxonomyType.type],
        userId
      )
    }

    // Insert new relations
    if (Array.isArray(taxonomyIds) && taxonomyIds.length > 0) {
      for (let i = 0; i < taxonomyIds.length; i++) {
        const taxonomyId = typeof taxonomyIds[i] === 'object' && taxonomyIds[i] !== null
          ? (taxonomyIds[i] as { id: string }).id
          : taxonomyIds[i]

        await mutateWithRLS(
          `INSERT INTO entity_taxonomy_relations ("entityType", "entityId", "taxonomyId", "order")
           VALUES ($1, $2, $3, $4)`,
          [entityType, entityId, taxonomyId, i + 1],
          userId
        )
      }
    }
  }
}

/**
 * Parse taxonomy filter parameters from URL
 * Supports both ?categoryId=xxx and ?taxonomy[type]=xxx formats
 */
function parseTaxonomyFilterParams(url: URL, entityConfig: EntityConfig): { taxonomyId?: string; taxonomyType?: string } | null {
  if (!entityConfig.taxonomies?.enabled) return null

  // Check for categoryId (legacy/convenience parameter)
  const categoryId = url.searchParams.get('categoryId')
  if (categoryId) {
    // Find the category taxonomy type
    const categoryType = entityConfig.taxonomies.types.find(t => t.type.includes('category'))
    if (categoryType) {
      return { taxonomyId: categoryId, taxonomyType: categoryType.type }
    }
  }

  // Check for taxonomyId parameter
  const taxonomyId = url.searchParams.get('taxonomyId')
  if (taxonomyId) {
    return { taxonomyId, taxonomyType: url.searchParams.get('taxonomyType') || undefined }
  }

  return null
}

/**
 * Get the database table name for an entity
 * Uses tableName if specified, otherwise falls back to slug
 */
function getTableName(entityConfig: EntityConfig): string {
  return entityConfig.tableName || entityConfig.slug
}

/**
 * Get team ID from request headers
 * Team context is required for entity operations (Phase 2)
 */
function getTeamIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-team-id')
}

/**
 * Check if request comes from the builder interface
 * Used to allow blocks field for builder-enabled entities
 */
function isBuilderRequest(request: NextRequest): boolean {
  return request.headers.get('x-builder-source') === 'true'
}

/**
 * Validate that user is a member of the specified team
 * Returns true if user is a member, false otherwise
 */
async function validateTeamMembership(userId: string, teamId: string): Promise<boolean> {
  try {
    console.log('[GenericHandler] Validating team membership:', { userId, teamId, teamIdLength: teamId?.length })
    const member = await queryOneWithRLS<{ id: string }>(
      'SELECT id FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
      [teamId, userId],
      userId
    )
    console.log('[GenericHandler] Team membership result:', { found: !!member, memberId: member?.id })
    return !!member
  } catch (error) {
    console.error('[GenericHandler] Error validating team membership:', error)
    return false
  }
}

/**
 * Validate team context with admin bypass support
 * Returns { valid: true, teamId, isBypass } or { valid: false, error: NextResponse }
 *
 * Admin bypass allows:
 * - If teamId provided: filter by that team (no membership check, skip userId filter)
 * - If teamId not provided: cross-team access (all teams, skip userId filter)
 *
 * The isBypass flag is used to skip userId filter in query building,
 * enabling admins to see all records regardless of ownership.
 */
async function validateTeamContextWithBypass(
  request: NextRequest,
  authResult: DualAuthResult,
  userId: string
): Promise<{ valid: true; teamId: string | null; isBypass: boolean } | { valid: false; error: NextResponse }> {
  const teamId = getTeamIdFromRequest(request)

  // Check if user can bypass team validation
  const canBypass = await canBypassTeamContext(authResult, request)

  if (canBypass) {
    // Admin bypass: teamId is optional
    // - If provided: filter by that team (no membership check)
    // - If not provided: cross-team access (all teams)
    // isBypass = true means skip userId filter too (see all records)
    console.log('[GenericHandler] Admin bypass active:', { userId, teamId: teamId || 'cross-team' })
    return { valid: true, teamId, isBypass: true }
  }

  // Normal flow: require teamId and membership
  if (!teamId) {
    const response = createApiError(
      'Team context required. Include x-team-id header.',
      400,
      undefined,
      'TEAM_CONTEXT_REQUIRED'
    )
    return { valid: false, error: await addCorsHeaders(response) }
  }

  const isMember = await validateTeamMembership(userId, teamId)
  if (!isMember) {
    const response = createApiError(
      'Access denied: You are not a member of this team',
      403,
      undefined,
      'TEAM_ACCESS_DENIED'
    )
    return { valid: false, error: await addCorsHeaders(response) }
  }

  return { valid: true, teamId, isBypass: false }
}

/**
 * Generic LIST handler (GET /api/v1/[entity])
 */
export async function handleGenericList(request: NextRequest): Promise<NextResponse> {
  try {
    // Resolve entity from URL
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)

    if (!resolution.isValidEntity || !resolution.entityConfig) {
      const response = createApiError('Entity not found', 404)
      return addCorsHeaders(response)
    }

    // Check if entity supports list operation
    if (!validateEntityOperation(resolution.entityConfig, 'list')) {
      const response = createApiError('List operation not supported for this entity', 405)
      return addCorsHeaders(response)
    }

    // Authenticate request
    const authResult = await authenticateRequest(request)
    let userId: string | null = null
    let teamId: string | null = null
    let isBypass = false  // Track if admin bypass is active (skip userId filter)

    // For public entities, allow read access without authentication
    if (!authResult.success && resolution.entityConfig.access?.public) {
      console.log(`[GenericHandler] Public access allowed for ${resolution.entityConfig.slug} list`)
      // userId remains null for public access (no RLS filtering)
    } else if (!authResult.success) {
      return NextResponse.json(
          { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
          { status: 401 }
      )
    } else {
      // Authenticated request - check rate limits and permissions
      if (authResult.rateLimitResponse) {
        return authResult.rateLimitResponse as NextResponse
      }

      // Check required permissions for authenticated access
      if (!hasRequiredScope(authResult, `${resolution.entityConfig.slug}:read`)) {
        const response = createApiError('Insufficient permissions', 403)
        return addCorsHeaders(response)
      }

      userId = authResult.user!.id

      // Validate team context with admin bypass support
      const teamValidation = await validateTeamContextWithBypass(request, authResult, userId)
      if (!teamValidation.valid) {
        return teamValidation.error
      }
      teamId = teamValidation.teamId
      isBypass = teamValidation.isBypass
    }

    // Parse request parameters
    const pagination = parsePaginationParams(request)
    const metaParams = parseMetaParams(request)

    // Parse field filtering and distinct parameters
    const url = new URL(request.url)
    const fieldsParam = url.searchParams.get('fields')
    const distinctParam = url.searchParams.get('distinct') === 'true'

    // Handle both comma-separated and multiple query params for IDs
    // Example: ?ids=id1,id2,id3 OR ?ids=id1&ids=id2&ids=id3
    const idsFromParams = url.searchParams.getAll('ids')
    const specificIds = idsFromParams.length > 0
        ? idsFromParams.flatMap(param => param.split(',').map(id => id.trim())).filter(Boolean)
        : null

    // Parse custom filters (any searchParam that isn't a known param)
    // Supports both repeated params (?status=a&status=b) and comma-separated (?status=a,b)
    const knownParams = new Set(['page', 'limit', 'fields', 'distinct', 'ids', 'parentId', 'search', 'sortBy', 'sortOrder', 'child', 'meta', 'from', 'to', 'dateField'])
    const customFilters: Record<string, string[]> = {}
    url.searchParams.forEach((value, key) => {
      if (!knownParams.has(key) && value) {
        if (!customFilters[key]) {
          customFilters[key] = []
        }
        // Support comma-separated values (e.g., "draft,published" -> ['draft', 'published'])
        const values = value.includes(',') ? value.split(',').map(v => v.trim()) : [value]
        customFilters[key].push(...values)
      }
    })

    // Build dynamic query from entity configuration
    const entityConfig = resolution.entityConfig

    // Determine which fields to select
    let fields: string
    if (fieldsParam && distinctParam) {
      // For distinct field queries (like relation-prop), handle specially
      const fieldName = fieldsParam
      const isJsonbField = fieldName === 'contentLanguages' || fieldName === 'brandValues' || fieldName === 'hashtags'

      if (isJsonbField) {
        // JSONB array field - extract elements and return distinct values
        return handleDistinctJsonbField(entityConfig, fieldName, url, userId)
      } else {
        // Regular field - return distinct values
        fields = `DISTINCT "${fieldName}" as value, "${fieldName}" as label, '${entityConfig.slug}' as "entityType"`
      }
    } else if (fieldsParam) {
      // Specific fields requested
      const requestedFields = fieldsParam.split(',').map(f => f.trim())
      const validFields = requestedFields.filter(fieldName =>
          entityConfig.fields.some(field => field.name === fieldName)
      )

      fields = ['id', ...validFields]
          .map(fieldName => {
            const columnName = /[A-Z]/.test(fieldName) ? `"${fieldName}"` : fieldName
            return `t.${columnName}`
          })
          .join(', ')
    } else {
      // All fields (default behavior)
      // Always include system fields (id, createdAt, updatedAt) even if not in entity fields config
      const systemFields = ['id', 'createdAt', 'updatedAt']

      // Add blocks for builder-enabled entities
      if (entityConfig.builder?.enabled) {
        systemFields.push('blocks')
      }

      const configFields = entityConfig.fields
          .map((field: EntityField) => {
            // Add quotes for camelCase fields (any field with uppercase letters)
            const columnName = /[A-Z]/.test(field.name) ? `"${field.name}"` : field.name
            return `t.${columnName}`
          })

      const systemFieldsFormatted = systemFields.map(fieldName => {
        const columnName = /[A-Z]/.test(fieldName) ? `"${fieldName}"` : fieldName
        return `t.${columnName}`
      })

      fields = [...systemFieldsFormatted, ...configFields].join(', ')
    }

    // Build query based on access type and request type
    let query: string
    let queryParams: unknown[]
    let paramIndex = 1

    // Extract search parameter early so it's available for both main query and count query
    const searchParam = url.searchParams.get('search')

    // Extract date range parameters early so they're available for both main query and count query
    const fromDate = url.searchParams.get('from')
    const toDate = url.searchParams.get('to')
    const dateFieldName = url.searchParams.get('dateField')

    // ===================================================================================
    // PUBLIC ACCESS LOGIC FOR PUBLISHED CONTENT
    // ===================================================================================
    // For public entities (access.public: true) with status=published filter:
    // - Skip userId filter to allow cross-user access
    // - Enables blog-style viewing where anyone can read published posts
    // - Dashboard access (without status=published) still filters by userId
    //
    // Security: Only LIST operations with explicit status=published filter skip the filter
    // - READ by ID still requires userId match (prevents accessing unpublished content)
    // - CREATE/UPDATE/DELETE always require userId match
    // ===================================================================================
    const isPublicEntity = entityConfig.access?.public === true
    const requestingPublishedOnly = customFilters['status']?.includes('published')
    const skipUserFilter = isPublicEntity && requestingPublishedOnly

    if (skipUserFilter && process.env.NODE_ENV === 'development') {
      console.log(`[GenericHandler] Public access mode: skipping userId filter for ${entityConfig.slug} (status=published)`)
    }

    // Get table name (uses tableName if specified, otherwise slug)
    const tableName = getTableName(entityConfig)

    // Parse taxonomy filter early so it's available for all query branches
    const taxonomyFilter = parseTaxonomyFilterParams(url, entityConfig)

    if (specificIds && specificIds.length > 0) {
      // Query specific IDs - for getting details of selected items
      const idPlaceholders = specificIds.map(() => `$${paramIndex++}`).join(', ')
      query = `SELECT ${fields} FROM "${tableName}" t WHERE t.id IN (${idPlaceholders})`
      queryParams = [...specificIds]

      // Add team filter if team context provided (Phase 2)
      // Skip for public entities requesting published content (allows cross-team public access)
      if (teamId && !skipUserFilter) {
        query += ` AND t."teamId" = $${paramIndex++}`
        queryParams.push(teamId)
      }

      // Add user filter if authenticated and not shared (CASE 1 only)
      // Skip for public entities requesting published content (e.g., viewing blog posts)
      // Skip when admin bypass is active (allows cross-team/cross-user access)
      if (userId && !entityConfig.access?.shared && !skipUserFilter && !isBypass) {
        query += ` AND t."userId" = $${paramIndex++}`
        queryParams.push(userId)
      }
    } else if (fieldsParam && distinctParam) {
      // Distinct field values query
      const fieldName = fieldsParam
      const parentId = url.searchParams.get('parentId')

      query = `SELECT ${fields} FROM "${tableName}" t WHERE 1=1`
      queryParams = []

      // Add team filter if team context provided (Phase 2)
      // Skip for public entities requesting published content
      if (teamId && !skipUserFilter) {
        query += ` AND t."teamId" = $${paramIndex++}`
        queryParams.push(teamId)
      }

      // Add parent filter if provided (for child entities)
      // Convention: child entities use "parentId" column as FK to parent
      if (parentId) {
        query += ` AND t."parentId" = $${paramIndex++}`
        queryParams.push(parentId)
      }

      // Add user filter if authenticated and not shared (CASE 1 only)
      // Skip for public entities requesting published content (e.g., viewing blog posts)
      // Skip when admin bypass is active (allows cross-team/cross-user access)
      if (userId && !entityConfig.access?.shared && !skipUserFilter && !isBypass) {
        query += ` AND t."userId" = $${paramIndex++}`
        queryParams.push(userId)
      }

      query += ` ORDER BY "${fieldName}" ASC LIMIT $${paramIndex++}`
      queryParams.push(pagination.limit)
    } else {
      // Regular list query - combine both logics
      const whereConditions: string[] = []
      queryParams = []
      paramIndex = 1

      // Add team filter if team context provided (Phase 2 - Team Isolation)
      // This is the PRIMARY isolation mechanism - all entities are isolated by team
      // Skip for public entities requesting published content (allows cross-team public access)
      if (teamId && !skipUserFilter) {
        whereConditions.push(`t."teamId" = $${paramIndex++}`)
        queryParams.push(teamId)
      }

      // Add user filter if authenticated AND not shared (secondary filter)
      // Exception: For public entities with status=published filter, allow cross-user access
      // This enables blog-style public viewing where anyone can read published posts
      // Skip when admin bypass is active (allows cross-team/cross-user access)
      if (userId && !entityConfig.access?.shared && !skipUserFilter && !isBypass) {
        // CASE 1: Private data - filter by user within team
        whereConditions.push(`t."userId" = $${paramIndex++}`)
        queryParams.push(userId)
      }
      // else: CASE 2/3 - Public or shared, no user filter (but still team-filtered)
      // else: CASE 4 - Admin bypass active, no user filter (see all records)

      // Add search filter (searches in name, title, slug, and content fields)
      if (searchParam && searchParam.trim() !== '') {
        const searchTerm = searchParam.trim()
        // Search in common text fields if they exist
        const hasName = entityConfig.fields.some((f: EntityField) => f.name === 'name')
        const hasTitle = entityConfig.fields.some((f: EntityField) => f.name === 'title')
        const hasSlug = entityConfig.fields.some((f: EntityField) => f.name === 'slug')
        const hasContent = entityConfig.fields.some((f: EntityField) => f.name === 'content')

        if (hasName || hasTitle || hasSlug || hasContent) {
          const searchConditions: string[] = []
          if (hasName) {
            searchConditions.push(`t.name ILIKE $${paramIndex}`)
          }
          if (hasTitle) {
            searchConditions.push(`t.title ILIKE $${paramIndex}`)
          }
          if (hasSlug) {
            searchConditions.push(`t.slug ILIKE $${paramIndex}`)
          }
          if (hasContent) {
            searchConditions.push(`t.content ILIKE $${paramIndex}`)
          }
          whereConditions.push(`(${searchConditions.join(' OR ')})`)
          queryParams.push(`%${searchTerm}%`)
          paramIndex++
        }
      }

      // Add date range filters (from/to) for specified date field
      if (dateFieldName && (fromDate || toDate)) {
        const field = entityConfig.fields.find((f: EntityField) => f.name === dateFieldName)

        // Validate field exists and is a date/datetime type
        if (field && (field.type === 'datetime' || field.type === 'date')) {
          if (fromDate) {
            whereConditions.push(`t."${dateFieldName}" >= $${paramIndex++}`)
            queryParams.push(fromDate)
          }
          if (toDate) {
            whereConditions.push(`t."${dateFieldName}" <= $${paramIndex++}`)
            queryParams.push(toDate)
          }
        }
      }

      // Add custom filters
      Object.entries(customFilters).forEach(([key, values]) => {
        // Validate that the field exists in the entity config
        const field = entityConfig.fields.find((f: EntityField) => f.name === key)
        if (field && values.length > 0) {
          // Use quoted column name for camelCase fields
          const columnName = `"${key}"`

          // Special handling for JSONB array fields (e.g., socialPlatformId)
          if (field.type === 'relation-multi' || key === 'socialPlatformId') {
            // Multiple values = OR logic: platform = A OR platform = B
            const orConditions = values.map(() => {
              const condition = `t.${columnName}::jsonb @> $${paramIndex++}::jsonb`
              return condition
            })
            values.forEach(value => {
              queryParams.push(JSON.stringify([value]))
            })
            whereConditions.push(`(${orConditions.join(' OR ')})`)
          } else {
            // Multiple values = OR logic: field = A OR field = B
            const orConditions = values.map(() => {
              const condition = `t.${columnName} = $${paramIndex++}`
              return condition
            })
            values.forEach(value => {
              queryParams.push(value)
            })
            whereConditions.push(`(${orConditions.join(' OR ')})`)
          }
        }
      })

      // Add taxonomy filter if applicable (e.g., ?categoryId=xxx or ?taxonomyId=xxx)
      if (taxonomyFilter?.taxonomyId) {
        whereConditions.push(`EXISTS (
          SELECT 1 FROM entity_taxonomy_relations etr
          WHERE etr."entityId" = t.id::text
            AND etr."entityType" = '${entityConfig.slug}'
            AND etr."taxonomyId" = $${paramIndex++}
        )`)
        queryParams.push(taxonomyFilter.taxonomyId)
      }

      const whereClause = whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : ''

      // Use COUNT(*) OVER() window function to get total count in single query
      // This eliminates a separate COUNT query, saving ~230ms per request
      query = `
        SELECT ${fields}, COUNT(*) OVER() as total_count
        FROM "${tableName}" t
        ${whereClause}
        ORDER BY t."createdAt" DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `
      queryParams.push(pagination.limit, pagination.offset)
    }

    const rawData = await queryWithRLS(query, queryParams, userId)

    // Extract total count from first row (window function includes it in every row)
    // If no results, total is 0
    const total = rawData.length > 0 ? Number((rawData[0] as Record<string, unknown>).total_count) || 0 : 0

    // Remove total_count from data (it was only needed for pagination)
    const data = (rawData as Record<string, unknown>[]).map((row) => {
      const { total_count, ...rest } = row
      return rest
    })
    const paginationMeta = createPaginationMeta(pagination.page, pagination.limit, total)

    // Handle metadata inclusion (only for authenticated users)
    let dataWithMeta = data
    if (metaParams.includeMetadata && userId) {
      dataWithMeta = await includeEntityMetadata(
          resolution.entityName,
          data as Array<{ id: string }>,
          metaParams,
          userId
      )
    }

    // Handle child entities inclusion (only for authenticated users)
    const childParams = parseChildParams(request)
    let dataWithChild = dataWithMeta
    if (childParams.includeChildren && userId) {
      dataWithChild = await includeEntityChildren(
          resolution.entityName,
          dataWithMeta as Array<{ id: string }>,
          childParams,
          userId,
          resolution.entityConfig
      )
    }

    // Handle taxonomy inclusion (for entities with taxonomies.enabled)
    let dataWithTaxonomies = dataWithChild
    if (entityConfig.taxonomies?.enabled) {
      dataWithTaxonomies = await includeTaxonomiesInData(
        entityConfig,
        dataWithChild as Array<{ id: string }>,
        userId
      )
    }

    const response = createApiResponse(dataWithTaxonomies, paginationMeta)
    return addCorsHeaders(response)

  } catch (error) {
    console.error('Error in generic list handler:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response)
  }
}

/**
 * Generic CREATE handler (POST /api/v1/[entity])
 */
export async function handleGenericCreate(request: NextRequest): Promise<NextResponse> {
  try {
    // Resolve entity from URL
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)

    if (!resolution.isValidEntity || !resolution.entityConfig) {
      const response = createApiError('Entity not found', 404)
      return addCorsHeaders(response)
    }

    // Check if entity supports create operation
    if (!validateEntityOperation(resolution.entityConfig, 'create')) {
      const response = createApiError('Create operation not supported for this entity', 405)
      return addCorsHeaders(response)
    }

    // Authenticate request
    const authResult = await authenticateRequest(request)

    if (!authResult.success) {
      return NextResponse.json(
          { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
          { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

    // Check required permissions for all auth types
    if (!hasRequiredScope(authResult, `${resolution.entityConfig.slug}:write`)) {
      const response = createApiError('Insufficient permissions', 403)
      return addCorsHeaders(response)
    }

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch {
      const response = createApiError('Invalid JSON body', 400)
      return addCorsHeaders(response)
    }

    // Separate metadata from entity data
    const { metas, ...entityData } = body

    // Extract userId from raw body BEFORE validation (for shared entities)
    const rawUserId = entityData.userId

    // Generate validation schema from entity configuration
    const entityConfig = resolution.entityConfig
    const tableName = getTableName(entityConfig)
    const schemas = generateEntitySchemas(entityConfig)
    const validation = schemas.create.safeParse(entityData)

    if (!validation.success) {
      console.error(`[${entityConfig.slug}] Validation failed:`, {
        entityData,
        errors: validation.error.issues
      })
      const response = createApiError('Validation error', 400, validation.error.issues, 'VALIDATION_ERROR')
      return addCorsHeaders(response)
    }

    const validatedData = validation.data

    // Determine ID generation strategy (default: uuid)
    const idStrategy = entityConfig.idStrategy?.type || 'uuid'

    // Build dynamic INSERT based on validated fields and ID strategy
    let insertFields: string[]
    let placeholders: string[]
    let values: unknown[]
    let paramCount: number

    // Determine userId to use: for shared entities, allow userId from request body (before validation)
    const isSharedEntity = entityConfig.access?.shared === true
    const userIdToUse = isSharedEntity && rawUserId
        ? rawUserId
        : authResult.user!.id

    // Validate team context with admin bypass support
    // Note: CREATE always requires teamId (even with bypass) to know where to store the entity
    const teamValidation = await validateTeamContextWithBypass(request, authResult, authResult.user!.id)
    if (!teamValidation.valid) {
      return teamValidation.error
    }
    const teamId = teamValidation.teamId
    if (!teamId) {
      // Even with bypass, CREATE needs a target team
      const response = createApiError('Team context required for create operations. Include x-team-id header.', 400, undefined, 'TEAM_CONTEXT_REQUIRED')
      return addCorsHeaders(response)
    }

    if (idStrategy === 'serial') {
      // SERIAL: Let database generate ID via DEFAULT/SERIAL
      // Always include userId to track who created the record (even for shared entities)
      insertFields = ['"userId"', '"teamId"']
      placeholders = ['$1', '$2']
      values = [userIdToUse, teamId]
      paramCount = 3
    } else {
      // UUID: Generate ID and include in INSERT
      // Always include userId to track who created the record (even for shared entities)
      const newEntityId = globalThis.crypto.randomUUID()
      insertFields = ['id', '"userId"', '"teamId"']
      placeholders = ['$1', '$2', '$3']
      values = [newEntityId, userIdToUse, teamId]
      paramCount = 4
    }

    // Handle blocks field for builder-enabled entities
    // Blocks are only saved when: entity has builder.enabled AND request comes from builder
    const builderRequest = isBuilderRequest(request)
    const entityHasBuilder = entityConfig.builder?.enabled === true

    if (builderRequest && entityHasBuilder && 'blocks' in (validatedData as Record<string, unknown>)) {
      const blocksValue = (validatedData as Record<string, unknown>).blocks
      insertFields.push('"blocks"')
      placeholders.push(`$${paramCount++}::jsonb`)
      values.push(JSON.stringify(blocksValue))
      // Remove blocks from validatedData to avoid processing in loop
      delete (validatedData as Record<string, unknown>).blocks
    }

    // Add validated fields dynamically
    Object.entries(validatedData as Record<string, unknown>).forEach(([key, value]) => {
      // Skip userId and teamId as they're already handled above
      if (key === 'userId' || key === 'teamId') return

      const field = entityConfig.fields.find((f: EntityField) => f.name === key)
      // Skip fields that should not be in forms (e.g., createdAt, updatedAt with database defaults)
      if (field && !field.api?.readOnly && field.display.showInForm !== false) {
        // Always quote column names to handle reserved keywords (e.g., "order", "user", "type")
        const columnName = `"${key}"`
        insertFields.push(columnName)

        // Handle relation fields specially - extract single ID from array or object
        if (field.type === 'relation') {
          let relationId = null
          if (Array.isArray(value) && value.length > 0) {
            const firstItem = value[0]
            relationId = typeof firstItem === 'object' && firstItem && 'id' in firstItem ? firstItem.id : firstItem
          } else if (typeof value === 'object' && value && 'id' in value) {
            relationId = (value as { id: unknown }).id
          } else if (typeof value === 'string') {
            relationId = value
          }

          // Check if relationId is empty string and convert to null
          if (typeof relationId === 'string' && relationId.trim() === '') {
            relationId = null
          }

          placeholders.push(`$${paramCount++}`)
          values.push(relationId)
        }
        // Handle relation-multi fields - value should already be JSON string from Zod
        else if (field.type === 'relation-multi') {
          placeholders.push(`$${paramCount++}::jsonb`)
          values.push(value) // Value should already be JSON string from Zod schema
        }
        // Handle tags as JSONB (consistent with database schema)
        else if (field.type === 'tags') {
          placeholders.push(`$${paramCount++}::jsonb`)
          values.push(JSON.stringify(Array.isArray(value) ? value : []))
        }
        // Handle null values for user/multiselect fields - store as SQL NULL not JSONB "null"
        else if ((field.type === 'multiselect' || field.type === 'user') && value === null) {
          placeholders.push(`$${paramCount++}`)
          values.push(null)
        }
        // Handle user field - extract just the ID (assumes FK to users table)
        else if (field.type === 'user') {
          placeholders.push(`$${paramCount++}`)
          // Value can be: array of user objects [{id: "...", ...}], single ID string, or null
          if (Array.isArray(value) && value.length > 0) {
            // Extract the ID from the first user object
            const userId = value[0]?.id
            values.push(userId ? String(userId) : null)
          } else if (typeof value === 'string') {
            values.push(value)
          } else {
            values.push(null)
          }
        }
        // Handle multiselect and other complex types as JSONB
        else if (field.type === 'multiselect' ||
            Array.isArray(value) || (typeof value === 'object' && value !== null)) {
          placeholders.push(`$${paramCount++}::jsonb`)
          values.push(JSON.stringify(value))
        } else {
          placeholders.push(`$${paramCount++}`)
          values.push(value)
        }
      }
    })

    const insertQuery = `
      INSERT INTO "${tableName}" (${insertFields.join(', ')})
      VALUES (${placeholders.join(', ')}) RETURNING *
    `

    const insertResult = await mutateWithRLS<Record<string, unknown>>(insertQuery, values, authResult.user!.id)

    // Extract the generated ID from the insert result
    const createdEntityId = String(insertResult.rows[0]?.id)

    // Get the created item with full data (include all fields for read operations)
    // Always include system fields (id, userId, createdAt, updatedAt)
    // userId is always included to track ownership even for shared entities
    const systemFields = ['id', 'userId', 'createdAt', 'updatedAt']

    // Add blocks for builder-enabled entities
    if (entityConfig.builder?.enabled) {
      systemFields.push('blocks')
    }

    const configFields = entityConfig.fields
        .map((field: EntityField) => {
          // Add quotes for camelCase fields (any field with uppercase letters)
          const columnName = /[A-Z]/.test(field.name) ? `"${field.name}"` : field.name
          return `t.${columnName}`
        })

    const systemFieldsFormatted = systemFields.map(fieldName => {
      const columnName = /[A-Z]/.test(fieldName) ? `"${fieldName}"` : fieldName
      return `t.${columnName}`
    })

    const fields = [...systemFieldsFormatted, ...configFields].join(', ')

    const selectQuery = `
      SELECT ${fields}
      FROM "${tableName}" t
      WHERE t.id = $1
    `

    const createdItems = await queryWithRLS(selectQuery, [createdEntityId], authResult.user!.id)
    const createdItem = createdItems[0] as Record<string, unknown>

    // Handle taxonomy relations if entity has taxonomies enabled
    if (entityConfig.taxonomies?.enabled) {
      await processTaxonomyRelations(entityConfig, createdEntityId, body, authResult.user!.id, false)
    }

    // Handle metadata if provided
    const metadataWasProvided = metas && typeof metas === 'object' && Object.keys(metas).length > 0
    if (metadataWasProvided) {
      await processEntityMetadata(
          resolution.entityName,
          createdEntityId,
          metas,
          authResult.user!.id
      )
    }

    // Include taxonomies in response if applicable
    let responseItem = createdItem
    if (entityConfig.taxonomies?.enabled) {
      const itemsWithTaxonomies = await includeTaxonomiesInData(
        entityConfig,
        [createdItem as { id: string }],
        authResult.user!.id
      )
      responseItem = itemsWithTaxonomies[0] || createdItem
    }

    // Create response with metadata if provided in payload
    const responseData = await handleEntityMetadataInResponse(
        resolution.entityName,
        responseItem as { id: string },
        metadataWasProvided,
        authResult.user!.id
    )

    // Fire entity hooks for plugins to react
    try {
      await afterEntityCreate(entityConfig.slug, responseItem, authResult.user!.id)
    } catch (hookError) {
      console.error(`[generic-handler] Error in afterEntityCreate hook for ${entityConfig.slug}:`, hookError)
      // Don't fail the request if hooks fail
    }

    const response = createApiResponse(responseData, { created: true }, 201)
    return addCorsHeaders(response)

  } catch (error) {
    console.error('Error in generic create handler:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response)
  }
}

/**
 * Generic READ handler (GET /api/v1/[entity]/[id])
 */
export async function handleGenericRead(request: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params

    // Resolve entity from URL
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)

    if (!resolution.isValidEntity || !resolution.entityConfig) {
      const response = createApiError('Entity not found', 404)
      return addCorsHeaders(response)
    }

    // Check if entity supports read operation
    if (!validateEntityOperation(resolution.entityConfig, 'read')) {
      const response = createApiError('Read operation not supported for this entity', 405)
      return addCorsHeaders(response)
    }

    // Authenticate request
    const authResult = await authenticateRequest(request)
    let userId: string | null = null
    let teamId: string | null = null
    let isBypass = false  // Track if admin bypass is active (skip userId filter)

    // For public entities, allow read access without authentication
    if (!authResult.success && resolution.entityConfig.access?.public) {
      console.log(`[GenericHandler] Public access allowed for ${resolution.entityConfig.slug} read`)
      // userId remains null for public access (no RLS filtering)
    } else if (!authResult.success) {
      return NextResponse.json(
          { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
          { status: 401 }
      )
    } else {
      // Authenticated request - check rate limits and permissions
      if (authResult.rateLimitResponse) {
        return authResult.rateLimitResponse as NextResponse
      }

      // Check required permissions for authenticated access
      if (!hasRequiredScope(authResult, `${resolution.entityConfig.slug}:read`)) {
        const response = createApiError('Insufficient permissions', 403)
        return addCorsHeaders(response)
      }

      userId = authResult.user!.id

      // Validate team context with admin bypass support
      const teamValidation = await validateTeamContextWithBypass(request, authResult, userId)
      if (!teamValidation.valid) {
        return teamValidation.error
      }
      teamId = teamValidation.teamId
      isBypass = teamValidation.isBypass
    }

    // Build dynamic query (include all fields for read operations)
    const entityConfig = resolution.entityConfig
    const tableName = getTableName(entityConfig)
    // Always include system fields (id, createdAt, updatedAt)
    const systemFields = ['id', 'createdAt', 'updatedAt']

    // Add blocks for builder-enabled entities
    if (entityConfig.builder?.enabled) {
      systemFields.push('blocks')
    }

    const configFields = entityConfig.fields
        .map((field: EntityField) => {
          // Add quotes for camelCase fields (any field with uppercase letters)
          const columnName = /[A-Z]/.test(field.name) ? `"${field.name}"` : field.name
          return `t.${columnName}`
        })

    const systemFieldsFormatted = systemFields.map(fieldName => {
      const columnName = /[A-Z]/.test(fieldName) ? `"${fieldName}"` : fieldName
      return `t.${columnName}`
    })

    const fields = [...systemFieldsFormatted, ...configFields].join(', ')

    // Build query based on access type and team context
    let query: string
    let queryParams: unknown[]
    let paramIndex = 1

    // Start with base query
    query = `
      SELECT ${fields}
      FROM "${tableName}" t
      WHERE t.id = $${paramIndex++}
    `
    queryParams = [id]

    // Add team filter if team context provided (Phase 2 - Team Isolation)
    if (teamId) {
      query += ` AND t."teamId" = $${paramIndex++}`
      queryParams.push(teamId)
    }

    // Add user filter if authenticated AND not shared (CASE 1)
    // Skip when admin bypass is active (allows cross-team/cross-user access)
    if (userId && !entityConfig.access?.shared && !isBypass) {
      query += ` AND t."userId" = $${paramIndex++}`
      queryParams.push(userId)
    }

    const items = await queryWithRLS(query, queryParams, userId)

    if (!items[0]) {
      const response = createApiError('Item not found', 404)
      return addCorsHeaders(response)
    }

    const item = items[0] as Record<string, unknown>

    // Handle metadata inclusion (only for authenticated users)
    const metaParams = parseMetaParams(request)
    let itemWithMeta = item
    if (metaParams.includeMetadata && userId) {
      const itemsWithMeta = await includeEntityMetadata(
          resolution.entityName,
          [item as { id: string }],
          metaParams,
          userId
      )
      itemWithMeta = itemsWithMeta[0] || item
    }

    // Handle child entities inclusion (only for authenticated users)
    const childParams = parseChildParams(request)
    let itemWithChild = itemWithMeta
    if (childParams.includeChildren && userId) {
      const itemsWithChild = await includeEntityChildren(
          resolution.entityName,
          [itemWithMeta as { id: string }],
          childParams,
          userId,
          resolution.entityConfig
      )
      itemWithChild = itemsWithChild[0] || itemWithMeta
    }

    // Handle taxonomy inclusion (for entities with taxonomies.enabled)
    let itemWithTaxonomies = itemWithChild
    if (entityConfig.taxonomies?.enabled) {
      const itemsWithTaxonomies = await includeTaxonomiesInData(
        entityConfig,
        [itemWithChild as { id: string }],
        userId
      )
      itemWithTaxonomies = itemsWithTaxonomies[0] || itemWithChild
    }

    const response = createApiResponse(itemWithTaxonomies)
    return addCorsHeaders(response)

  } catch (error) {
    console.error('Error in generic read handler:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response)
  }
}

/**
 * Generic UPDATE handler (PATCH /api/v1/[entity]/[id])
 */
export async function handleGenericUpdate(request: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params

    // Resolve entity from URL
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)

    if (!resolution.isValidEntity || !resolution.entityConfig) {
      const response = createApiError('Entity not found', 404)
      return addCorsHeaders(response)
    }

    // Check if entity supports update operation
    if (!validateEntityOperation(resolution.entityConfig, 'update')) {
      const response = createApiError('Update operation not supported for this entity', 405)
      return addCorsHeaders(response)
    }

    // Authenticate request
    const authResult = await authenticateRequest(request)

    if (!authResult.success) {
      return NextResponse.json(
          { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
          { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

    // Check required permissions for all auth types
    if (!hasRequiredScope(authResult, `${resolution.entityConfig.slug}:write`)) {
      const response = createApiError('Insufficient permissions', 403)
      return addCorsHeaders(response)
    }

    // Validate team context with admin bypass support
    // Note: UPDATE requires teamId to scope the update to a specific team
    const teamValidation = await validateTeamContextWithBypass(request, authResult, authResult.user!.id)
    if (!teamValidation.valid) {
      return teamValidation.error
    }
    const teamId = teamValidation.teamId
    if (!teamId) {
      // Even with bypass, UPDATE needs a target team for WHERE clause
      const response = createApiError('Team context required for update operations. Include x-team-id header.', 400, undefined, 'TEAM_CONTEXT_REQUIRED')
      return addCorsHeaders(response)
    }

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch {
      const response = createApiError('Invalid JSON body', 400)
      return addCorsHeaders(response)
    }

    // Separate metadata from entity data
    const { metas, ...entityData } = body

    // Generate validation schema from entity configuration
    const entityConfig = resolution.entityConfig
    const tableName = getTableName(entityConfig)
    const schemas = generateEntitySchemas(entityConfig)
    const validation = schemas.update.safeParse(entityData)

    if (!validation.success) {
      // Debug logging for validation errors
      console.log(`[${entityConfig.slug}] Validation failed:`, {
        entityData,
        errors: validation.error.issues
      })
      const response = createApiError('Validation error', 400, validation.error.issues, 'VALIDATION_ERROR')
      return addCorsHeaders(response)
    }

    const validatedData = validation.data

    // Build dynamic UPDATE query
    const updates: string[] = []
    const values: unknown[] = []
    let paramCount = 1

    // Handle blocks field for builder-enabled entities
    // Blocks are only updated when: entity has builder.enabled AND request comes from builder
    const builderRequest = isBuilderRequest(request)
    const entityHasBuilder = entityConfig.builder?.enabled === true

    if (builderRequest && entityHasBuilder && 'blocks' in entityData) {
      updates.push(`"blocks" = $${paramCount++}::jsonb`)
      values.push(JSON.stringify(entityData.blocks))
    }

    // Filter out undefined/null fields AND fields not in original request
    // Only update fields that were actually provided in the request body
    const originalKeys = Object.keys(entityData)
    const fieldsToUpdate = Object.entries(validatedData as Record<string, unknown>)
        .filter(([key]) => originalKeys.includes(key))

    fieldsToUpdate.forEach(([key, value]) => {
      // Skip blocks - already handled above
      if (key === 'blocks') return

      const field = entityConfig.fields.find((f: EntityField) => f.name === key)
      // Skip fields that should not be in forms (e.g., createdAt, updatedAt with database defaults)
      if (field && !field.api?.readOnly && field.display.showInForm !== false) {
        // Add quotes for camelCase fields (any field with uppercase letters)
        const columnName = `"${key}"`

        // Handle relation fields specially - extract single ID from array or object
        if (field.type === 'relation') {
          let relationId = null
          if (Array.isArray(value) && value.length > 0) {
            const firstItem = value[0]
            relationId = typeof firstItem === 'object' && firstItem && 'id' in firstItem ? firstItem.id : firstItem
          } else if (typeof value === 'object' && value && 'id' in value) {
            relationId = (value as { id: unknown }).id
          } else if (typeof value === 'string') {
            relationId = value
          }

          // Check if relationId is empty string and convert to null
          if (typeof relationId === 'string' && relationId.trim() === '') {
            relationId = null
          }

          updates.push(`${columnName} = $${paramCount++}`)
          values.push(relationId)
        }
        // Handle relation-multi fields - value should already be JSON string from Zod
        else if (field.type === 'relation-multi') {
          updates.push(`${columnName} = $${paramCount++}::jsonb`)
          values.push(value) // Value should already be JSON string from Zod schema
        }
        // Handle tags as JSONB (consistent with database schema)
        else if (field.type === 'tags') {
          updates.push(`${columnName} = $${paramCount++}::jsonb`)
          values.push(JSON.stringify(Array.isArray(value) ? value : []))
        }
        // Handle null values for user/multiselect fields - store as SQL NULL not JSONB "null"
        else if ((field.type === 'multiselect' || field.type === 'user') && value === null) {
          updates.push(`${columnName} = $${paramCount++}`)
          values.push(null)
        }
        // Handle user field - extract just the ID (assumes FK to users table)
        else if (field.type === 'user') {
          updates.push(`${columnName} = $${paramCount++}`)
          // Value can be: array of user objects [{id: "...", ...}], single ID string, or null
          if (Array.isArray(value) && value.length > 0) {
            // Extract the ID from the first user object
            const userId = value[0]?.id
            values.push(userId ? String(userId) : null)
          } else if (typeof value === 'string') {
            values.push(value)
          } else {
            values.push(null)
          }
        }
        // Handle multiselect and other complex types as JSONB
        else if (field.type === 'multiselect' ||
            Array.isArray(value) || (typeof value === 'object' && value !== null)) {
          updates.push(`${columnName} = $${paramCount++}::jsonb`)
          values.push(JSON.stringify(value))
        } else {
          updates.push(`${columnName} = $${paramCount++}`)
          values.push(value)
        }
      }
    })

    // Allow updates with only metas (no entity fields)
    const metadataWasProvided = metas && typeof metas === 'object' && Object.keys(metas).length > 0

    if (updates.length === 0 && !metadataWasProvided) {
      const response = createApiError('No fields to update', 400)
      return addCorsHeaders(response)
    }

    // If we have entity fields to update, add updatedAt
    if (updates.length > 0) {
      updates.push(`"updatedAt" = CURRENT_TIMESTAMP`)
    }

    let updatedItem: Record<string, unknown>

    // Only run UPDATE query if we have entity fields to update
    if (updates.length > 0) {
      // Build UPDATE query with team and user filtering
      const whereConditions: string[] = [`id = $${paramCount++}`]
      values.push(id)

      // Add team filter if team context provided (Phase 2 - Team Isolation)
      if (teamId) {
        whereConditions.push(`"teamId" = $${paramCount++}`)
        values.push(teamId)
      }

      // Add user filter if not shared (CASE 1 - Private to owner)
      if (!entityConfig.access?.shared) {
        whereConditions.push(`"userId" = $${paramCount++}`)
        values.push(authResult.user!.id)
      }

      const updateQuery = `
        UPDATE "${tableName}"
        SET ${updates.join(', ')}
        WHERE ${whereConditions.join(' AND ')}
        RETURNING *
      `

      const result = await mutateWithRLS(updateQuery, values, authResult.user!.id)

      if (!result.rows || result.rows.length === 0) {
        const response = createApiError('Item not found', 404)
        return addCorsHeaders(response)
      }

      updatedItem = result.rows[0] as Record<string, unknown>
    } else {
      // Only updating metas - fetch the existing entity to verify it exists and return it
      let selectQuery = `SELECT * FROM "${tableName}" WHERE id = $1`
      const selectValues: unknown[] = [id]

      // Add team filter if team context provided (Phase 2 - Team Isolation)
      if (teamId) {
        selectQuery += ` AND "teamId" = $2`
        selectValues.push(teamId)
      }

      const result = await queryWithRLS(selectQuery, selectValues, authResult.user!.id)

      if (!result || result.length === 0) {
        const response = createApiError('Item not found', 404)
        return addCorsHeaders(response)
      }

      updatedItem = result[0] as Record<string, unknown>
    }

    // Handle taxonomy relations if entity has taxonomies enabled
    if (entityConfig.taxonomies?.enabled) {
      await processTaxonomyRelations(entityConfig, id, body, authResult.user!.id, true)
    }

    // Handle metadata if provided
    if (metadataWasProvided) {
      await processEntityMetadata(
          resolution.entityName,
          id,
          metas,
          authResult.user!.id
      )
    }

    // Include taxonomies in response if applicable
    let responseItem = updatedItem
    if (entityConfig.taxonomies?.enabled) {
      const itemsWithTaxonomies = await includeTaxonomiesInData(
        entityConfig,
        [updatedItem as { id: string }],
        authResult.user!.id
      )
      responseItem = itemsWithTaxonomies[0] || updatedItem
    }

    // Create response with metadata if provided in payload
    const responseData = await handleEntityMetadataInResponse(
        resolution.entityName,
        responseItem as { id: string },
        metadataWasProvided,
        authResult.user!.id
    )

    // Fire entity hooks for plugins to react
    try {
      await afterEntityUpdate(entityConfig.slug, id, responseItem, entityData, authResult.user!.id)
    } catch (hookError) {
      console.error(`[generic-handler] Error in afterEntityUpdate hook for ${entityConfig.slug}:`, hookError)
      // Don't fail the request if hooks fail
    }

    const response = createApiResponse(responseData)
    return addCorsHeaders(response)

  } catch (error) {
    console.error('Error in generic update handler:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response)
  }
}

/**
 * Generic DELETE handler (DELETE /api/v1/[entity]/[id])
 */
export async function handleGenericDelete(request: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params

    // Resolve entity from URL
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)

    if (!resolution.isValidEntity || !resolution.entityConfig) {
      const response = createApiError('Entity not found', 404)
      return addCorsHeaders(response)
    }

    // Check if entity supports delete operation
    if (!validateEntityOperation(resolution.entityConfig, 'delete')) {
      const response = createApiError('Delete operation not supported for this entity', 405)
      return addCorsHeaders(response)
    }

    // Authenticate request
    const authResult = await authenticateRequest(request)

    if (!authResult.success) {
      return NextResponse.json(
          { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
          { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

    // Check required permissions for all auth types
    if (!hasRequiredScope(authResult, `${resolution.entityConfig.slug}:write`)) {
      const response = createApiError('Insufficient permissions', 403)
      return addCorsHeaders(response)
    }

    // Validate team context with admin bypass support
    // Note: DELETE requires teamId to scope the deletion to a specific team
    const teamValidation = await validateTeamContextWithBypass(request, authResult, authResult.user!.id)
    if (!teamValidation.valid) {
      return teamValidation.error
    }
    const teamId = teamValidation.teamId
    if (!teamId) {
      // Even with bypass, DELETE needs a target team for WHERE clause
      const response = createApiError('Team context required for delete operations. Include x-team-id header.', 400, undefined, 'TEAM_CONTEXT_REQUIRED')
      return addCorsHeaders(response)
    }

    // Delete the item
    const entityConfig = resolution.entityConfig
    const tableName = getTableName(entityConfig)

    // Build DELETE query with team and user filtering
    const whereConditions: string[] = ['id = $1']
    const deleteParams: unknown[] = [id]
    let paramIndex = 2

    // Add team filter if team context provided (Phase 2 - Team Isolation)
    if (teamId) {
      whereConditions.push(`"teamId" = $${paramIndex++}`)
      deleteParams.push(teamId)
    }

    // Add user filter if not shared (CASE 1 - Private to owner)
    if (!entityConfig.access?.shared) {
      whereConditions.push(`"userId" = $${paramIndex++}`)
      deleteParams.push(authResult.user!.id)
    }

    const deleteQuery = `
      DELETE FROM "${tableName}"
      WHERE ${whereConditions.join(' AND ')}
      RETURNING id
    `

    const result = await mutateWithRLS(deleteQuery, deleteParams, authResult.user!.id)

    if (!result.rows || result.rows.length === 0) {
      const response = createApiError('Item not found', 404)
      return addCorsHeaders(response)
    }

    // Fire entity hooks for plugins to react
    try {
      await afterEntityDelete(entityConfig.slug, id, authResult.user!.id)
    } catch (hookError) {
      console.error(`[generic-handler] Error in afterEntityDelete hook for ${entityConfig.slug}:`, hookError)
      // Don't fail the request if hooks fail
    }

    const response = createApiResponse({ success: true, id })
    return addCorsHeaders(response)

  } catch (error) {
    console.error('Error in generic delete handler:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response)
  }
}

/**
 * Handle CORS preflight for all generic endpoints
 */
export async function handleGenericOptions(): Promise<NextResponse> {
  return handleCorsPreflightRequest()
}

/**
 * Helper function to handle JSONB field distinct queries
 */
async function handleDistinctJsonbField(
    entityConfig: EntityConfig,
    fieldName: string,
    url: URL,
    userId: string | null
): Promise<NextResponse> {
  const tableName = getTableName(entityConfig)
  const parentId = url.searchParams.get('parentId')
  const limit = parseInt(url.searchParams.get('limit') || '50')

  let query: string
  const queryParams: unknown[] = []
  let paramIndex = 1

  // Build JSONB extraction query
  query = `
    SELECT DISTINCT
      elem.value as value,
      elem.value as label,
      '${entityConfig.slug}' as "entityType"
    FROM (
      SELECT jsonb_array_elements_text("${fieldName}") as value
      FROM "${tableName}"
      WHERE "${fieldName}" IS NOT NULL
      AND jsonb_array_length("${fieldName}") > 0
  `

  // Add parent filter if provided (for child entities)
  // Convention: child entities use "parentId" column as FK to parent
  if (parentId) {
    query += ` AND "parentId" = $${paramIndex++}`
    queryParams.push(parentId)
  }

  // Add user filter if authenticated and not shared (CASE 1 only)
  if (userId && !entityConfig.access?.shared) {
    query += ` AND "userId" = $${paramIndex++}`
    queryParams.push(userId)
  }

  query += `) as elem ORDER BY elem.value ASC LIMIT $${paramIndex++}`
  queryParams.push(limit)

  const results = await queryWithRLS(query, queryParams, userId)

  return NextResponse.json({
    success: true,
    data: results,
    meta: {
      entityType: entityConfig.slug,
      field: fieldName,
      total: results.length,
      timestamp: new Date().toISOString(),
      mode: 'distinct-jsonb'
    }
  })
}
