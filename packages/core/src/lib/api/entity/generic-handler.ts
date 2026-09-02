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
import { beforeEntityCreate, afterEntityCreate, afterEntityUpdate, afterEntityDelete } from '../../entities/entity-hooks'
import { logGenericHandlerUsage, type AuditContext } from './audit-log'
import { checkPermission } from '../../permissions/check'
import type { Permission } from '../../permissions/types'
import { extractPatternIds } from '../../blocks/pattern-resolver'
import { isPatternReference } from '../../../types/pattern-reference'
import { PatternUsageService } from '../../services/pattern-usage.service'
import { SubscriptionService } from '../../services/subscription.service'
import { UsageService } from '../../services/usage.service'
import { BILLING_REGISTRY } from '@nextsparkjs/registries/billing-registry'
import type { BlockInstance } from '../../../types/blocks'
import type { PatternReference } from '../../../types/pattern-reference'

// ==========================================
// NAME FIELD XSS GUARD
// ==========================================

/**
 * Regexp that detects the presence of an HTML tag angle bracket in a string.
 * Matching either `<` or `>` is sufficient to catch all tag variants:
 * - opening tags:            <script>
 * - closing tags:            </script>
 * - self-closing tags:       <br/>
 * - attribute-only payloads: <img src=x onerror=alert(1)>
 * - broken/partial tags:     <b
 */
const HTML_TAG_CHARS_RE = /[<>]/

/**
 * Field names that are checked for HTML injection on POST / PATCH.
 * Add more names here if other free-text display fields need protecting.
 */
const SAFE_TEXT_FIELDS = new Set(['name', 'title'])

/**
 * Validate that no `name` / `title` field in the validated data contains HTML.
 *
 * Returns the offending field name if a violation is found, or `null` if clean.
 * Applies to any entity whose field config declares one of SAFE_TEXT_FIELDS
 * as a text / textarea type.
 */
function checkNameFieldXss(
  entityConfig: EntityConfig,
  validatedData: Record<string, unknown>
): string | null {
  for (const field of entityConfig.fields) {
    if (!SAFE_TEXT_FIELDS.has(field.name)) continue
    if (field.type !== 'text' && field.type !== 'textarea') continue
    const value = validatedData[field.name]
    if (typeof value === 'string' && HTML_TAG_CHARS_RE.test(value)) {
      return field.name
    }
  }
  return null
}

// ==========================================
// PUBLIC FIELD FILTER
// ==========================================

/**
 * Filter entity data to only include publicFields when request is unauthenticated.
 * If entityConfig.access.publicFields is defined and userId is null (public request),
 * strips all fields not in the whitelist from the response data.
 * Authenticated requests (userId !== null) always receive full data.
 */
function filterPublicFields<T>(
  data: T,
  entityConfig: EntityConfig,
  userId: string | null
): T {
  const publicFields = entityConfig.access?.publicFields
  if (!publicFields || publicFields.length === 0 || userId !== null) {
    return data
  }

  const allowedSet = new Set(publicFields)

  const filterItem = (item: Record<string, unknown>): Record<string, unknown> => {
    const filtered: Record<string, unknown> = {}
    for (const key of allowedSet) {
      if (key in item) {
        filtered[key] = item[key]
      }
    }
    return filtered
  }

  if (Array.isArray(data)) {
    return data.map(item => filterItem(item as Record<string, unknown>)) as T
  }

  return filterItem(data as Record<string, unknown>) as T
}

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
 * Whether `fieldName` is a declared field of the entity.
 *
 * Every place that turns a caller-supplied name into a SQL identifier
 * (`?fields=`, `?fields=X&distinct=true`, `?sortBy=`, custom filters) MUST go
 * through this check first — an unvalidated name lands inside a quoted
 * identifier position and becomes a SQL injection vector (#96).
 */
function isEntityField(entityConfig: EntityConfig, fieldName: string): boolean {
  return entityConfig.fields.some((field: EntityField) => field.name === fieldName)
}

// ==========================================
// LIST PARAMETER VALIDATION (#97)
// ==========================================

/**
 * Query-string keys the list handler (or the helpers it delegates to)
 * consumes itself. Anything else is treated as a custom field filter and MUST
 * name a declared entity field — unknown keys are rejected with 400 instead
 * of being silently dropped.
 *
 * Legacy / client-side keys that existing callers send and that this handler
 * does not act on — reserved so they keep working instead of becoming 400s:
 * - `meta`, `includeMeta`, `userId`: sent by EntityApiClient.list
 *   (lib/api/entities.ts) and older clients; metadata is requested via `metas`.
 * - `userFiltered`: sent by SimpleRelationSelect for distinct lookups.
 * - `sort` / `order`: aliases of `sortBy` / `sortOrder` (PublicEntityGrid).
 */
const LIST_RESERVED_PARAMS = new Set([
  'page', 'limit', 'fields', 'distinct', 'ids', 'parentId', 'search',
  'sortBy', 'sortOrder', 'sort', 'order', 'child', 'meta', 'metas',
  'includeMeta', 'userId', 'from', 'to', 'dateField', 'userFiltered',
])

/** Taxonomy filter params, accepted only when the entity has taxonomies enabled. */
const TAXONOMY_FILTER_PARAMS = ['categoryId', 'taxonomyId', 'taxonomyType']

/** Fields `?search=` matches against (any that the entity declares). */
const SEARCHABLE_FIELDS = ['name', 'title', 'slug', 'content']

/** Base columns every entity table has that may be used for `?sortBy=`. */
const SORTABLE_BASE_FIELDS = ['id', 'createdAt', 'updatedAt', 'teamId']

/** A bare calendar day (no time component), e.g. `2026-01-15`. */
const BARE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ==========================================
// BODY HANDLING (#97)
// ==========================================

/**
 * Keys of a create/update body that the handler consumes itself rather than
 * through the entity schema: the row owner/team (stamped from auth), and the
 * taxonomy relation arrays (persisted via processTaxonomyRelations). They are
 * removed before Zod validation so the strict entity schema only judges the
 * caller's field payload.
 */
function omitHandlerManagedKeys(
  entityConfig: EntityConfig,
  data: Record<string, unknown>
): Record<string, unknown> {
  const managed = new Set(['userId', 'teamId'])
  if (entityConfig.taxonomies?.enabled) {
    for (const taxonomyType of entityConfig.taxonomies.types ?? []) {
      managed.add(taxonomyType.field)
    }
  }
  return Object.fromEntries(Object.entries(data).filter(([key]) => !managed.has(key)))
}

/**
 * Human-readable summary for a failed body validation. Unknown keys get
 * called out by name so a typo'd field is obvious from the message alone.
 */
function validationErrorMessage(issues: Array<{ code: string; keys?: string[] }>): string {
  const unknownKeys = issues
    .filter(issue => issue.code === 'unrecognized_keys')
    .flatMap(issue => issue.keys ?? [])
  return unknownKeys.length > 0
    ? `Unknown field(s): ${unknownKeys.join(', ')}`
    : 'Validation error'
}

// ==========================================
// DATABASE CONSTRAINT ERRORS (#97)
// ==========================================

interface PgConstraintError {
  code: string
  constraint?: string
  detail?: string
  table?: string
}

function asPgError(error: unknown): PgConstraintError | null {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return error as PgConstraintError
  }
  return null
}

/**
 * Map a PostgreSQL integrity-constraint error (SQLSTATE class 23) to a
 * client-facing response, or null when the error is not one of those.
 *
 * - 23505 unique_violation      → 409 UNIQUE_CONSTRAINT_VIOLATION
 * - 23514 check_violation       → 422 CHECK_CONSTRAINT_VIOLATION
 * - 23503 foreign_key_violation → 409 on delete (row still referenced),
 *                                 422 on create/update (dangling reference)
 *
 * Anything else falls through to the generic 500 in the caller. A CHECK
 * violation is an application-level rule the caller can satisfy by changing
 * the input, so it must not be reported as a server fault.
 */
function mapConstraintViolation(
  error: unknown,
  operation: 'create' | 'update' | 'delete'
): ReturnType<typeof createApiError> | null {
  const pgError = asPgError(error)
  if (!pgError) return null
  const { constraint, detail, table } = pgError

  switch (pgError.code) {
    case '23505':
      return createApiError(
        'A record with this value already exists',
        409,
        { constraint, detail },
        'UNIQUE_CONSTRAINT_VIOLATION'
      )
    case '23514':
      // `detail` for a CHECK violation echoes the whole failing row; only the
      // constraint identity is useful (and safe) to return.
      return createApiError(
        constraint
          ? `Value rejected by check constraint "${constraint}"`
          : 'Value rejected by a database check constraint',
        422,
        { constraint, table },
        'CHECK_CONSTRAINT_VIOLATION'
      )
    case '23503':
      if (operation === 'delete') {
        return createApiError(
          detail || 'Cannot delete: this record is referenced by other records',
          409,
          { constraint },
          'FOREIGN_KEY_VIOLATION'
        )
      }
      return createApiError(
        detail ? `Referenced record does not exist: ${detail}` : 'Referenced record does not exist',
        422,
        { constraint, detail },
        'FOREIGN_KEY_VIOLATION'
      )
    default:
      return null
  }
}

/**
 * HTTP status to use when a `before_*` entity hook rejects a write by
 * throwing. A hook may attach a numeric 4xx `status` (or `statusCode`) to the
 * error to pick the response code (e.g. 403 for an ownership violation);
 * anything else is reported as a 400 — never a 500, since a hook rejection is
 * a validation outcome the caller can act on, not a server fault.
 */
function hookRejectionStatus(error: unknown): number {
  if (error && typeof error === 'object') {
    const candidate = (error as { status?: unknown; statusCode?: unknown }).status
      ?? (error as { statusCode?: unknown }).statusCode
    if (typeof candidate === 'number' && candidate >= 400 && candidate < 500) {
      return candidate
    }
  }
  return 400
}

// ==========================================
// PATTERN REFERENCE HELPER FUNCTIONS
// ==========================================

/**
 * Filter out PatternReferences to deleted patterns
 *
 * This enables lazy cleanup - patterns can be deleted without updating all entities.
 * When an entity is saved, any references to deleted patterns are automatically filtered out.
 *
 * @param blocks - Array of blocks that may contain pattern references
 * @param userId - User ID for RLS
 * @returns Filtered array with orphaned pattern references removed
 */
async function filterOrphanedPatternReferences(
  blocks: unknown[],
  userId: string
): Promise<unknown[]> {
  if (!Array.isArray(blocks) || blocks.length === 0) return blocks

  // Extract pattern IDs referenced in blocks
  const patternIds = extractPatternIds(blocks as (BlockInstance | PatternReference)[])
  if (patternIds.length === 0) return blocks

  // Check which patterns still exist
  const existingIds = await PatternUsageService.getExistingPatternIds(patternIds, userId)

  // If all patterns exist, return blocks unchanged
  if (existingIds.size === patternIds.length) return blocks

  // Filter out references to deleted patterns
  const filtered = blocks.filter(block => {
    if (isPatternReference(block)) {
      const exists = existingIds.has(block.ref)
      if (!exists) {
        console.info(`[generic-handler] Filtering orphaned PatternReference: ${block.ref}`)
      }
      return exists
    }
    return true
  })

  return filtered
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

// ==========================================
// OWNERSHIP FILTER (role-based record scoping)
// ==========================================

/**
 * Result of ownership filter resolution.
 *
 * - `{ applies: false }` — the current user's role is NOT restricted; they see
 *   all records.
 * - `{ applies: true, field, value }` — the query must add `WHERE field = value`
 *   to scope results to the user's own records.
 * - `{ applies: true, field, value: null }` — the user has a restricted role but
 *   no linked record was found; return an empty result set to avoid leaking data.
 */
type OwnershipFilterResult =
  | { applies: false }
  | { applies: true; field: string; value: string | null }

/**
 * Resolve the ownership filter for the current request.
 *
 * Checks whether the authenticated identity's team role is one of the roles
 * listed in `entityConfig.access.ownershipFilter.roles`.  If so, looks up the
 * linked record (resolved via `linkedBy` config where `userField = userId`)
 * and returns the filter value to append to the query.
 *
 * Runs identically for session and API-key auth — both resolve to a real
 * `team_members` role for `userId`/`teamId`, and there is nothing
 * auth-type-specific about the ownership check itself. Only an admin bypass
 * skips it (a superadmin/service-context request is not scoped by any single
 * team role).
 */
async function resolveOwnershipFilter(
  entityConfig: EntityConfig,
  userId: string,
  teamId: string,
  isBypass: boolean
): Promise<OwnershipFilterResult> {
  const ownershipFilter = entityConfig.access?.ownershipFilter
  if (!ownershipFilter) return { applies: false }

  // Admin bypass: no role-based restriction.
  if (isBypass) return { applies: false }

  // Get the user's team role
  const memberRow = await queryOneWithRLS<{ role: string }>(
    'SELECT role FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
    [teamId, userId],
    userId
  )

  if (!memberRow) return { applies: false }

  const userRole = memberRow.role
  if (!ownershipFilter.roles.includes(userRole)) {
    // Role is not restricted — unrestricted access
    return { applies: false }
  }

  // Direct-field ownership: the entity row already carries the owner id, so the
  // filter value is simply the current user's id — no linked lookup needed.
  if (!ownershipFilter.linkedBy) {
    return { applies: true, field: ownershipFilter.field, value: userId }
  }

  // Linked ownership: resolve the filter value from a linked record.
  // `deletedAt IS NULL` is only appended when the linked table is soft-deletable
  // (softDelete !== false). Entities without a `deletedAt` column set
  // `softDelete: false` to avoid a 42703 (undefined column) error.
  const { table, userField, valueField, softDelete } = ownershipFilter.linkedBy
  const softDeleteClause = softDelete === false ? '' : ' AND "deletedAt" IS NULL'
  const linkedRow = await queryOneWithRLS<Record<string, string>>(
    `SELECT "${valueField}" FROM "${table}" WHERE "${userField}" = $1 AND "teamId" = $2${softDeleteClause}`,
    [userId, teamId],
    userId
  )

  const filterValue = linkedRow ? linkedRow[valueField] ?? null : null
  return { applies: true, field: ownershipFilter.field, value: filterValue }
}

/**
 * Validate that user is a member of the specified team
 * Returns true if user is a member, false otherwise
 */
/**
 * Check entity-level, team-role-based permissions for the authenticated
 * identity — session user, or API-key owner (API keys carry the same real
 * `users.id` a session would, resolved to a `team_members` role the same
 * way). This runs IN ADDITION to the coarse `<slug>:read/write/delete` scope
 * check `hasRequiredScope` already performs earlier in each handler — API-key
 * auth now gets both layers, matching what session auth always had.
 * Returns null if allowed, or a NextResponse with 403 if denied.
 */
async function checkAuthPermission(
  authResult: DualAuthResult,
  entitySlug: string,
  action: string,
  teamId: string,
  request: NextRequest
): Promise<NextResponse | null> {
  if (!authResult.user?.id) return null

  const permission = `${entitySlug}.${action}` as Permission
  try {
    const allowed = await checkPermission(authResult.user.id, teamId, permission)
    if (!allowed) {
      const response = createApiError(
        `Permission denied: insufficient permissions for ${entitySlug}.${action}`,
        403,
        undefined,
        'PERMISSION_DENIED'
      )
      return addCorsHeaders(response, request)
    }
  } catch (error) {
    // FAIL CLOSED. A thrown error here is a genuine failure (e.g. a DB outage):
    // `checkPermission` returns `false` (it does not throw) for unregistered
    // permissions, so this catch only fires on real errors — which must NEVER
    // grant access. Surface a 500-class code so a transient DB failure is not
    // mislabeled as a clean authorization denial.
    console.error(`[GenericHandler] Permission check errored for ${entitySlug}.${action}:`, error)
    const response = createApiError(
      `Permission check failed for ${entitySlug}.${action}`,
      500,
      undefined,
      'PERMISSION_CHECK_FAILED'
    )
    return addCorsHeaders(response, request)
  }
  return null
}

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

// ==========================================
// AUDIT LOGGING (#105)
// ==========================================

/**
 * Run a handler implementation and record the outcome in api_audit_log.
 *
 * The implementation receives a mutable AuditContext and stores the
 * DualAuthResult in it as soon as the request is authenticated; whatever
 * status the handler ends up returning (200, 403, 429, 500…) is logged against
 * that principal. Unauthenticated requests are not logged (no principal).
 *
 * Logging is fire-and-forget: it is started before the response is returned
 * but never awaited, and logGenericHandlerUsage swallows its own errors, so a
 * failing audit write can never turn a successful response into an error.
 */
async function runWithAuditLog(
  request: NextRequest,
  run: (audit: AuditContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const startedAt = Date.now()
  const audit: AuditContext = { auth: null }
  let statusCode = 500
  try {
    const response = await run(audit)
    statusCode = response.status
    return response
  } finally {
    logGenericHandlerUsage(audit.auth, request, statusCode, Date.now() - startedAt).catch(error => {
      console.error('[generic-handler:audit] unexpected audit failure:', error)
    })
  }
}

/**
 * Generic LIST handler (GET /api/v1/[entity])
 */
export async function handleGenericList(request: NextRequest): Promise<NextResponse> {
  return runWithAuditLog(request, audit => handleGenericListImpl(request, audit))
}

async function handleGenericListImpl(request: NextRequest, audit: AuditContext): Promise<NextResponse> {
  try {
    // Resolve entity from URL
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)

    if (!resolution.isValidEntity || !resolution.entityConfig) {
      const response = createApiError('Entity not found', 404)
      return addCorsHeaders(response, request)
    }

    // Check if entity supports list operation
    if (!validateEntityOperation(resolution.entityConfig, 'list')) {
      const response = createApiError('List operation not supported for this entity', 405)
      return addCorsHeaders(response, request)
    }

    // Authenticate request
    const authResult = await authenticateRequest(request)
    audit.auth = authResult
    let userId: string | null = null
    let teamId: string | null = null
    let isBypass = false  // Track if admin bypass is active (skip userId filter)

    // For public entities, allow read access without authentication
    if (!authResult.success && resolution.entityConfig.access?.public) {
      // userId remains null for public access (no RLS filtering)
      teamId = request.headers.get('x-team-id') ?? null
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
        return addCorsHeaders(response, request)
      }

      userId = authResult.user!.id

      // Validate team context with admin bypass support
      const teamValidation = await validateTeamContextWithBypass(request, authResult, userId)
      if (!teamValidation.valid) {
        return teamValidation.error
      }
      teamId = teamValidation.teamId
      isBypass = teamValidation.isBypass

      // Entity-level, team-role-based permission check — runs for both
      // session and API-key auth, in addition to the coarse `:read` scope
      // check above. Skipped for admin bypass (superadmin/developer), who
      // are authorized at the platform level. A member without `entity.list`
      // → 403.
      if (!isBypass && teamId) {
        const permDenied = await checkAuthPermission(authResult, resolution.entityConfig.slug, 'list', teamId, request)
        if (permDenied) return permDenied
      }
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
    const customFilters: Record<string, string[]> = {}
    url.searchParams.forEach((value, key) => {
      if (!LIST_RESERVED_PARAMS.has(key) && value) {
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

    // ── #97: reject unknown / unsupported list parameters up front ─────────
    // Each of these used to degrade silently into a plausible-looking 200
    // (filter dropped, search ignored, default sort) — indistinguishable from
    // a correct answer for an automated caller.

    // Custom filter keys must be declared entity fields (or, for
    // taxonomy-enabled entities, the taxonomy filter params).
    const taxonomyFilterParams = entityConfig.taxonomies?.enabled ? TAXONOMY_FILTER_PARAMS : []
    const invalidFilterKeys = Object.keys(customFilters).filter(
      key => !isEntityField(entityConfig, key) && !taxonomyFilterParams.includes(key)
    )
    if (invalidFilterKeys.length > 0) {
      const response = createApiError(
        `Unknown filter parameter(s) for ${entityConfig.slug}: ${invalidFilterKeys.join(', ')}`,
        400,
        {
          invalidKeys: invalidFilterKeys,
          allowedKeys: [...entityConfig.fields.map((f: EntityField) => f.name), ...taxonomyFilterParams],
        },
        'INVALID_FILTER'
      )
      return addCorsHeaders(response, request)
    }

    // `search` only works against name/title/slug/content; an entity with none
    // of them cannot honour it, so say so instead of returning every row.
    const searchParam = url.searchParams.get('search')
    const searchableFields = SEARCHABLE_FIELDS.filter(name => isEntityField(entityConfig, name))
    if (searchParam && searchParam.trim() !== '' && searchableFields.length === 0) {
      const response = createApiError(
        `Entity ${entityConfig.slug} has no searchable field (${SEARCHABLE_FIELDS.join(', ')}); the search parameter is not supported`,
        400,
        { searchableFields: SEARCHABLE_FIELDS },
        'SEARCH_NOT_SUPPORTED'
      )
      return addCorsHeaders(response, request)
    }

    // `sortBy` (alias `sort`) must be an entity field or a base column — it is
    // interpolated as an identifier, so this check is also the SQL-injection guard.
    const sortByParam = url.searchParams.get('sortBy') || url.searchParams.get('sort')
    if (sortByParam && !isEntityField(entityConfig, sortByParam) && !SORTABLE_BASE_FIELDS.includes(sortByParam)) {
      const response = createApiError(
        `Invalid sortBy field for ${entityConfig.slug}: ${sortByParam}`,
        400,
        { allowedFields: [...SORTABLE_BASE_FIELDS, ...entityConfig.fields.map((f: EntityField) => f.name)] },
        'INVALID_SORT_FIELD'
      )
      return addCorsHeaders(response, request)
    }

    // Determine which fields to select
    let fields: string
    if (fieldsParam && distinctParam) {
      // For distinct field queries (like relation-prop), handle specially
      const fieldName = fieldsParam

      // #96: the name is interpolated as a SQL identifier below (and inside
      // handleDistinctJsonbField), so it must be a declared entity field.
      if (!isEntityField(entityConfig, fieldName)) {
        const response = createApiError(
          `Invalid field for distinct query: ${fieldName}`,
          400,
          undefined,
          'INVALID_FIELD'
        )
        return addCorsHeaders(response, request)
      }

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
      const validFields = requestedFields.filter(fieldName => isEntityField(entityConfig, fieldName))

      fields = ['id', ...validFields]
          .map(fieldName => {
            const columnName = /[A-Z]/.test(fieldName) ? `"${fieldName}"` : fieldName
            return `t.${columnName}`
          })
          .join(', ')
    } else {
      // All fields (default behavior)
      // Always include system fields (id, userId, teamId, createdAt, updatedAt) even if not in entity fields config
      const systemFields = ['id', 'userId', 'teamId', 'createdAt', 'updatedAt']

      // Add blocks for builder-enabled entities
      if (entityConfig.builder?.enabled) {
        systemFields.push('blocks')
      }

      // Add soft delete columns when table.softDelete is enabled
      if (entityConfig.table?.softDelete) {
        systemFields.push('deletedAt', 'deletedBy')
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

      // Add usageCount for patterns entity (computed field)
      if (entityConfig.slug === 'patterns') {
        fields += ', COALESCE(pu.usage_count, 0)::int as "usageCount"'
      }
    }

    // Build query based on access type and request type
    let query: string
    let queryParams: unknown[]
    let paramIndex = 1

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

    // Resolve ownership filter early so it's available for all query branches.
    // Only applies when userId and teamId are both present (authenticated, non-bypass).
    let ownershipFilter: OwnershipFilterResult = { applies: false }
    if (userId && teamId) {
      ownershipFilter = await resolveOwnershipFilter(
        entityConfig,
        userId,
        teamId,
        isBypass
      )
    }

    // If ownership filter applies but no linked record exists, return empty list immediately
    // to avoid leaking records that belong to other linked entities.
    if (ownershipFilter.applies && ownershipFilter.value === null) {
      const paginationMeta = createPaginationMeta(pagination.page, pagination.limit, 0)
      const response = createApiResponse([], paginationMeta)
      return addCorsHeaders(response, request)
    }

    if (specificIds && specificIds.length > 0) {
      // Query specific IDs - for getting details of selected items
      const idPlaceholders = specificIds.map(() => `$${paramIndex++}`).join(', ')
      query = `SELECT ${fields} FROM "${tableName}" t WHERE t.id IN (${idPlaceholders})`
      queryParams = [...specificIds]

      // Add team filter if team context provided (Phase 2)
      // Skip for public entities requesting published content (allows cross-team public access)
      if (teamId) {
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

      // Apply role-based ownership filter if configured
      if (ownershipFilter.applies && ownershipFilter.value !== null) {
        query += ` AND t."${ownershipFilter.field}" = $${paramIndex++}`
        queryParams.push(ownershipFilter.value)
      }

      // Soft delete filter: hide deleted rows for non-bypass users
      if (entityConfig.table?.softDelete && !isBypass) {
        query += ` AND t."deletedAt" IS NULL`
      }
    } else if (fieldsParam && distinctParam) {
      // Distinct field values query
      const fieldName = fieldsParam
      const parentId = url.searchParams.get('parentId')

      query = `SELECT ${fields} FROM "${tableName}" t WHERE 1=1`
      queryParams = []

      // Add team filter if team context provided (Phase 2)
      // Skip for public entities requesting published content
      if (teamId) {
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

      // Apply role-based ownership filter if configured
      if (ownershipFilter.applies && ownershipFilter.value !== null) {
        query += ` AND t."${ownershipFilter.field}" = $${paramIndex++}`
        queryParams.push(ownershipFilter.value)
      }

      // Soft delete filter: hide deleted rows for non-bypass users
      if (entityConfig.table?.softDelete && !isBypass) {
        query += ` AND t."deletedAt" IS NULL`
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
      if (teamId) {
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

      // Apply role-based ownership filter if configured
      if (ownershipFilter.applies && ownershipFilter.value !== null) {
        whereConditions.push(`t."${ownershipFilter.field}" = $${paramIndex++}`)
        queryParams.push(ownershipFilter.value)
      }

      // Soft delete filter: hide deleted rows for non-bypass users
      if (entityConfig.table?.softDelete && !isBypass) {
        whereConditions.push(`t."deletedAt" IS NULL`)
      }

      // Add search filter (searches in name, title, slug, and content fields).
      // Support for the entity was validated above (SEARCH_NOT_SUPPORTED).
      if (searchParam && searchParam.trim() !== '' && searchableFields.length > 0) {
        const searchTerm = searchParam.trim()
        const searchConditions = searchableFields.map(name => `t.${name} ILIKE $${paramIndex}`)
        whereConditions.push(`(${searchConditions.join(' OR ')})`)
        queryParams.push(`%${searchTerm}%`)
        paramIndex++
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

      // Add custom filters (keys were validated against entityConfig.fields
      // above; taxonomy params are not fields and are handled separately)
      Object.entries(customFilters).forEach(([key, values]) => {
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
          } else if (field.type === 'date' || field.type === 'datetime') {
            // #97: a bare calendar day compared with `=` against a
            // timestamp(tz) column never matches (the column carries a
            // time-of-day). Treat `?field=YYYY-MM-DD` as the whole day:
            // `>= day AND < day + 1`. Values with a time component keep
            // exact equality — the caller asked for a precise instant.
            const orConditions = values.map(value => {
              if (BARE_DATE_RE.test(value)) {
                const lower = paramIndex++
                const upper = paramIndex++
                queryParams.push(value, value)
                return `(t.${columnName} >= $${lower}::date AND t.${columnName} < $${upper}::date + 1)`
              }
              queryParams.push(value)
              return `t.${columnName} = $${paramIndex++}`
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

      // Add LEFT JOIN for patterns entity to include usageCount
      let joinClause = ''
      if (entityConfig.slug === 'patterns') {
        joinClause = `
          LEFT JOIN (
            SELECT "patternId", COUNT(*) as usage_count
            FROM pattern_usages
            GROUP BY "patternId"
          ) pu ON t.id = pu."patternId"
        `
      }

      // sortBy was validated against entity fields / base columns above
      // (INVALID_SORT_FIELD) — that check is what makes this interpolation safe.
      const sortOrderRaw = url.searchParams.get('sortOrder') || url.searchParams.get('order')
      const sortOrderParam = sortOrderRaw?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
      const orderByClause = sortByParam
        ? `t."${sortByParam}" ${sortOrderParam}`
        : 't."createdAt" DESC'

      // Use COUNT(*) OVER() window function to get total count in single query
      // This eliminates a separate COUNT query, saving ~230ms per request
      query = `
        SELECT ${fields}, COUNT(*) OVER() as total_count
        FROM "${tableName}" t
        ${joinClause}
        ${whereClause}
        ORDER BY ${orderByClause}
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

    // Filter public fields for unauthenticated requests
    const finalData = filterPublicFields(dataWithTaxonomies, entityConfig, userId)

    const response = createApiResponse(finalData, paginationMeta)
    return addCorsHeaders(response, request)

  } catch (error) {
    console.error('Error in generic list handler:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response, request)
  }
}

/**
 * Generic CREATE handler (POST /api/v1/[entity])
 */
export async function handleGenericCreate(request: NextRequest): Promise<NextResponse> {
  return runWithAuditLog(request, audit => handleGenericCreateImpl(request, audit))
}

async function handleGenericCreateImpl(request: NextRequest, audit: AuditContext): Promise<NextResponse> {
  try {
    // Resolve entity from URL
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)

    if (!resolution.isValidEntity || !resolution.entityConfig) {
      const response = createApiError('Entity not found', 404)
      return addCorsHeaders(response, request)
    }

    // Check if entity supports create operation
    if (!validateEntityOperation(resolution.entityConfig, 'create')) {
      const response = createApiError('Create operation not supported for this entity', 405)
      return addCorsHeaders(response, request)
    }

    // Authenticate request
    const authResult = await authenticateRequest(request)
    audit.auth = authResult

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
      return addCorsHeaders(response, request)
    }

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch {
      const response = createApiError('Invalid JSON body', 400)
      return addCorsHeaders(response, request)
    }

    // Separate metadata from entity data
    const { metas, ...entityData } = body

    // Extract userId from raw body BEFORE validation (for shared entities)
    const rawUserId = entityData.userId

    // Generate validation schema from entity configuration
    const entityConfig = resolution.entityConfig
    const tableName = getTableName(entityConfig)
    const schemas = generateEntitySchemas(entityConfig)
    const validation = schemas.create.safeParse(omitHandlerManagedKeys(entityConfig, entityData))

    if (!validation.success) {
      console.error(`[${entityConfig.slug}] Validation failed:`, {
        entityData,
        errors: validation.error.issues
      })
      const response = createApiError(
        validationErrorMessage(validation.error.issues),
        400,
        validation.error.issues,
        'VALIDATION_ERROR'
      )
      return addCorsHeaders(response, request)
    }

    let validatedData = validation.data as Record<string, unknown>

    // Reject HTML markup in name/title fields (stored-XSS prevention)
    const xssField = checkNameFieldXss(entityConfig, validatedData as Record<string, unknown>)
    if (xssField) {
      const xssResponse = createApiError(
        `Field '${xssField}' must not contain HTML markup`,
        400,
        undefined,
        'INVALID_FIELD_VALUE'
      )
      return addCorsHeaders(xssResponse, request)
    }

    // Determine ID generation strategy (default: uuid)
    const idStrategy = entityConfig.idStrategy?.type || 'uuid'

    // Build dynamic INSERT based on validated fields and ID strategy
    let insertFields: string[]
    let placeholders: string[]
    let values: unknown[]
    let paramCount: number

    // Determine the userId stored on the new row.
    //
    // For NON-shared entities the row is owned by its creator, so we always
    // stamp the authenticated user's id.
    //
    // For SHARED (team-scoped) entities the `userId` column is not an
    // ownership marker — callers may link the row to a *different* user, or to
    // no user at all (an unlinked / walk-in row). The legacy behaviour
    // (`isSharedEntity && rawUserId`) coerced an explicit `null` back to the
    // creator's id, which made it impossible to insert an unlinked row — fatal
    // for shared entities carrying a UNIQUE constraint on (teamId, userId),
    // where every creator-stamped row after the first collides.
    //
    // The change here is deliberately minimal and backward compatible — only
    // the explicit-`null` case changes:
    //   • userId absent           → creator  (legacy, unchanged)
    //   • userId === null         → null     (NEW: explicit unlinked row)
    //   • userId is non-empty str → that id  (legacy, unchanged)
    //   • userId === "" / falsy   → creator  (legacy, unchanged — never a
    //                                          deliberate value, kept as-is to
    //                                          avoid inserting an empty FK)
    const isSharedEntity = entityConfig.access?.shared === true
    let userIdToUse: string | null = authResult.user!.id
    if (isSharedEntity && Object.prototype.hasOwnProperty.call(entityData, 'userId')) {
      if (rawUserId === null) {
        userIdToUse = null
      } else if (typeof rawUserId === 'string' && rawUserId.trim() !== '') {
        userIdToUse = rawUserId
      }
      // any other value (empty string, etc.) keeps the creator fallback
    }

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
      return addCorsHeaders(response, request)
    }

    // Entity-level, team-role-based permission check — runs for both session
    // and API-key auth, in addition to the coarse `:write` scope check above.
    const permDenied = await checkAuthPermission(authResult, entityConfig.slug, 'create', teamId, request)
    if (permDenied) return permDenied

    // #118: pre-write extension point, mirroring the beforeEntityUpdate
    // contract. Plugins registered on `entity.<slug>.before_create` receive the
    // validated payload — plus the resolved `userId`/`teamId` for context (both
    // are stamped by the handler below and ignored if the hook changes them) —
    // and may return a modified payload, or throw to reject the create before
    // anything is persisted.
    try {
      validatedData = await beforeEntityCreate(
        entityConfig.slug,
        { ...validatedData, userId: userIdToUse, teamId },
        authResult.user!.id
      )
    } catch (hookError) {
      console.error(`[generic-handler] beforeEntityCreate rejected ${entityConfig.slug} create:`, hookError)
      const response = createApiError(
        hookError instanceof Error && hookError.message
          ? hookError.message
          : `Create rejected by ${entityConfig.slug} before_create hook`,
        hookRejectionStatus(hookError),
        undefined,
        'BEFORE_CREATE_REJECTED'
      )
      return addCorsHeaders(response, request)
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
      let blocksValue = (validatedData as Record<string, unknown>).blocks as unknown[]

      // Filter orphaned pattern references (lazy cleanup)
      blocksValue = await filterOrphanedPatternReferences(blocksValue, authResult.user!.id)

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
      // Skip read-only fields (e.g., createdAt, updatedAt with database defaults)
      if (field && !field.api?.readOnly) {
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
        // Handle relation-multi fields. Value may arrive as a JSON string
        // (historical Zod transform path) OR as a raw JS array when the
        // field declared `defaultValue: []` and the client omitted the key
        // from the payload. Normalize so the JSONB cast always receives a
        // valid JSON string — passing a raw `[]` JS array to pg-node casts
        // to the Postgres array literal `{}::jsonb`, which then breaks every
        // downstream consumer that assumes `Array.isArray(row.field) === true`.
        else if (field.type === 'relation-multi') {
          placeholders.push(`$${paramCount++}::jsonb`)
          values.push(
            typeof value === 'string'
              ? value
              : JSON.stringify(Array.isArray(value) ? value : []),
          )
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

    // ── Billing quota check ──────────────────────────────────────────
    // If the billing config has a limit mapping for "{entity}.create",
    // verify the team hasn't exceeded its plan quota before inserting.
    const createAction = `${entityConfig.slug}.create`
    const limitSlug = BILLING_REGISTRY?.actionMappings?.limits?.[createAction]

    if (limitSlug) {
      const actionResult = await SubscriptionService.canPerformAction(
        authResult.user!.id,
        teamId,
        createAction
      )
      if (!actionResult.allowed) {
        const statusCode = actionResult.reason === 'quota_exceeded' ? 429 : 403
        const response = createApiError(
          // @ts-expect-error — pre-existing type error, tracked in https://github.com/NextSpark-js/nextspark/issues/131
          actionResult.message || `Quota exceeded for ${entityConfig.slug}`,
          statusCode,
          undefined,
          actionResult.reason === 'quota_exceeded' ? 'QUOTA_EXCEEDED' : 'FEATURE_NOT_IN_PLAN'
        )
        return addCorsHeaders(response, request)
      }
    }

    const insertQuery = `
      INSERT INTO "${tableName}" (${insertFields.join(', ')})
      VALUES (${placeholders.join(', ')}) RETURNING *
    `

    const insertResult = await mutateWithRLS<Record<string, unknown>>(insertQuery, values, authResult.user!.id)

    // Extract the generated ID from the insert result
    const createdEntityId = String(insertResult.rows[0]?.id)

    // ── Usage tracking (fire-and-forget) ──────────────────────────────
    // After successful insert, increment the usage counter for this entity.
    if (limitSlug) {
      UsageService.track({
        teamId,
        userId: authResult.user!.id,
        limitSlug,
        delta: 1,
        action: createAction,
        resourceType: entityConfig.slug,
        resourceId: createdEntityId,
      }).catch(() => {}) // Silent — never break entity creation
    }

    // Get the created item with full data (include all fields for read operations)
    // Always include system fields (id, userId, teamId, createdAt, updatedAt)
    // userId is always included to track ownership even for shared entities
    // teamId is always included for team context in hooks
    const systemFields = ['id', 'userId', 'teamId', 'createdAt', 'updatedAt']

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
    return addCorsHeaders(response, request)

  } catch (error) {
    console.error('Error in generic create handler:', error)

    // Unique / check / foreign-key violations are caller-fixable → 4xx
    const constraintResponse = mapConstraintViolation(error, 'create')
    if (constraintResponse) {
      return addCorsHeaders(constraintResponse, request)
    }

    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response, request)
  }
}

/**
 * Generic READ handler (GET /api/v1/[entity]/[id])
 */
export async function handleGenericRead(request: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }): Promise<NextResponse> {
  return runWithAuditLog(request, audit => handleGenericReadImpl(request, audit, { params }))
}

async function handleGenericReadImpl(request: NextRequest, audit: AuditContext, { params }: { params: Promise<{ entity: string; id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params

    // Resolve entity from URL
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)

    if (!resolution.isValidEntity || !resolution.entityConfig) {
      const response = createApiError('Entity not found', 404)
      return addCorsHeaders(response, request)
    }

    // Check if entity supports read operation
    if (!validateEntityOperation(resolution.entityConfig, 'read')) {
      const response = createApiError('Read operation not supported for this entity', 405)
      return addCorsHeaders(response, request)
    }

    // Authenticate request
    const authResult = await authenticateRequest(request)
    audit.auth = authResult
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
        return addCorsHeaders(response, request)
      }

      userId = authResult.user!.id

      // Validate team context with admin bypass support
      const teamValidation = await validateTeamContextWithBypass(request, authResult, userId)
      if (!teamValidation.valid) {
        return teamValidation.error
      }
      teamId = teamValidation.teamId
      isBypass = teamValidation.isBypass

      // Entity-level, team-role-based permission check — runs for both
      // session and API-key auth, in addition to the coarse `:read` scope check
      // above. Skipped for admin bypass; a member without `entity.read` → 403.
      if (!isBypass && teamId) {
        const permDenied = await checkAuthPermission(authResult, resolution.entityConfig.slug, 'read', teamId, request)
        if (permDenied) return permDenied
      }
    }

    // Build dynamic query (include all fields for read operations)
    const entityConfig = resolution.entityConfig
    const tableName = getTableName(entityConfig)
    // Always include system fields (id, userId, teamId, createdAt, updatedAt)
    const systemFields = ['id', 'userId', 'teamId', 'createdAt', 'updatedAt']

    // Add blocks for builder-enabled entities
    if (entityConfig.builder?.enabled) {
      systemFields.push('blocks')
    }

    // Add soft delete columns when table.softDelete is enabled
    if (entityConfig.table?.softDelete) {
      systemFields.push('deletedAt', 'deletedBy')
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

    // Apply role-based ownership filter if configured
    if (userId && teamId) {
      const readOwnershipFilter = await resolveOwnershipFilter(
        entityConfig,
        userId,
        teamId,
        isBypass
      )
      if (readOwnershipFilter.applies) {
        if (readOwnershipFilter.value === null) {
          // No linked record found → deny access
          const response = createApiError('Item not found', 404)
          return addCorsHeaders(response, request)
        }
        query += ` AND t."${readOwnershipFilter.field}" = $${paramIndex++}`
        queryParams.push(readOwnershipFilter.value)
      }
    }

    // Soft delete filter: hide deleted rows for non-bypass users
    if (entityConfig.table?.softDelete && !isBypass) {
      query += ` AND t."deletedAt" IS NULL`
    }

    const items = await queryWithRLS(query, queryParams, userId)

    if (!items[0]) {
      const response = createApiError('Item not found', 404)
      return addCorsHeaders(response, request)
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

    // Filter public fields for unauthenticated requests
    const finalItem = filterPublicFields(itemWithTaxonomies, entityConfig, userId)

    const response = createApiResponse(finalItem)
    return addCorsHeaders(response, request)

  } catch (error) {
    console.error('Error in generic read handler:', error)
    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response, request)
  }
}

/**
 * Generic UPDATE handler (PATCH /api/v1/[entity]/[id])
 */
export async function handleGenericUpdate(request: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }): Promise<NextResponse> {
  return runWithAuditLog(request, audit => handleGenericUpdateImpl(request, audit, { params }))
}

async function handleGenericUpdateImpl(request: NextRequest, audit: AuditContext, { params }: { params: Promise<{ entity: string; id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params

    // Resolve entity from URL
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)

    if (!resolution.isValidEntity || !resolution.entityConfig) {
      const response = createApiError('Entity not found', 404)
      return addCorsHeaders(response, request)
    }

    // Check if entity supports update operation
    if (!validateEntityOperation(resolution.entityConfig, 'update')) {
      const response = createApiError('Update operation not supported for this entity', 405)
      return addCorsHeaders(response, request)
    }

    // Authenticate request
    const authResult = await authenticateRequest(request)
    audit.auth = authResult

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
      return addCorsHeaders(response, request)
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
      return addCorsHeaders(response, request)
    }

    // Entity-level, team-role-based permission check — runs for both session
    // and API-key auth, in addition to the coarse `:write` scope check above.
    const permDenied = await checkAuthPermission(authResult, resolution.entityConfig.slug, 'update', teamId, request)
    if (permDenied) return permDenied

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch {
      const response = createApiError('Invalid JSON body', 400)
      return addCorsHeaders(response, request)
    }

    // Separate metadata from entity data
    const { metas, ...entityData } = body

    // Generate validation schema from entity configuration
    const entityConfig = resolution.entityConfig

    // Apply field guards based on team role if configured. Runs for both
    // session and API-key auth — the guard is keyed on the identity's real
    // team role, same as checkAuthPermission/resolveOwnershipFilter above.
    const fieldGuards = entityConfig.access?.ownershipFilter?.fieldGuards
    if (fieldGuards && fieldGuards.length > 0 && authResult.user?.id) {
      const guardMemberRow = await queryOneWithRLS<{ role: string }>(
        'SELECT role FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
        [teamId, authResult.user!.id],
        authResult.user!.id
      )
      if (guardMemberRow) {
        for (const guard of fieldGuards) {
          if (guard.roles.includes(guardMemberRow.role)) {
            const forbidden = guard.denyFields.filter(f => f in entityData)
            if (forbidden.length > 0) {
              const response = createApiError(
                `Role '${guardMemberRow.role}' is not allowed to modify field(s): ${forbidden.join(', ')}`,
                403,
                undefined,
                'FIELD_MODIFICATION_DENIED'
              )
              return addCorsHeaders(response, request)
            }
          }
        }
      }
    }
    const tableName = getTableName(entityConfig)
    const schemas = generateEntitySchemas(entityConfig)
    const validation = schemas.update.safeParse(omitHandlerManagedKeys(entityConfig, entityData))

    if (!validation.success) {
      // Debug logging for validation errors
      console.log(`[${entityConfig.slug}] Validation failed:`, {
        entityData,
        errors: validation.error.issues
      })
      const response = createApiError(
        validationErrorMessage(validation.error.issues),
        400,
        validation.error.issues,
        'VALIDATION_ERROR'
      )
      return addCorsHeaders(response, request)
    }

    const validatedData = validation.data

    // Reject HTML markup in name/title fields (stored-XSS prevention)
    const updateXssField = checkNameFieldXss(entityConfig, validatedData as Record<string, unknown>)
    if (updateXssField) {
      const updateXssResponse = createApiError(
        `Field '${updateXssField}' must not contain HTML markup`,
        400,
        undefined,
        'INVALID_FIELD_VALUE'
      )
      return addCorsHeaders(updateXssResponse, request)
    }

    // Build dynamic UPDATE query
    const updates: string[] = []
    const values: unknown[] = []
    let paramCount = 1

    // Handle blocks field for builder-enabled entities
    // Blocks are only updated when: entity has builder.enabled AND request comes from builder
    const builderRequest = isBuilderRequest(request)
    const entityHasBuilder = entityConfig.builder?.enabled === true

    if (builderRequest && entityHasBuilder && 'blocks' in entityData) {
      let blocksData = entityData.blocks as unknown[]

      // Filter orphaned pattern references (lazy cleanup)
      blocksData = await filterOrphanedPatternReferences(blocksData, authResult.user!.id)

      updates.push(`"blocks" = $${paramCount++}::jsonb`)
      values.push(JSON.stringify(blocksData))
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
      // Skip read-only fields (e.g., createdAt, updatedAt with database defaults)
      if (field && !field.api?.readOnly) {
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
        // Handle relation-multi fields. Same normalization as the INSERT
        // path above: string passthrough; raw JS array → JSON.stringify so
        // the JSONB cast receives `[]` not the Postgres array literal `{}`.
        else if (field.type === 'relation-multi') {
          updates.push(`${columnName} = $${paramCount++}::jsonb`)
          values.push(
            typeof value === 'string'
              ? value
              : JSON.stringify(Array.isArray(value) ? value : []),
          )
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
      return addCorsHeaders(response, request)
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

      // Apply role-based ownership filter if configured
      const updateOwnershipFilter = await resolveOwnershipFilter(
        entityConfig,
        authResult.user!.id,
        teamId,
        teamValidation.isBypass
      )
      if (updateOwnershipFilter.applies) {
        if (updateOwnershipFilter.value === null) {
          // No linked record found for this user → treat as not found
          const response = createApiError('Item not found', 404)
          return addCorsHeaders(response, request)
        }
        whereConditions.push(`"${updateOwnershipFilter.field}" = $${paramCount++}`)
        values.push(updateOwnershipFilter.value)
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
        return addCorsHeaders(response, request)
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
        return addCorsHeaders(response, request)
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
    return addCorsHeaders(response, request)

  } catch (error) {
    console.error('Error in generic update handler:', error)

    // Unique / check / foreign-key violations are caller-fixable → 4xx
    const constraintResponse = mapConstraintViolation(error, 'update')
    if (constraintResponse) {
      return addCorsHeaders(constraintResponse, request)
    }

    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response, request)
  }
}

/**
 * Generic DELETE handler (DELETE /api/v1/[entity]/[id])
 */
export async function handleGenericDelete(request: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }): Promise<NextResponse> {
  return runWithAuditLog(request, audit => handleGenericDeleteImpl(request, audit, { params }))
}

async function handleGenericDeleteImpl(request: NextRequest, audit: AuditContext, { params }: { params: Promise<{ entity: string; id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params

    // Resolve entity from URL
    const resolution = await resolveEntityFromUrl(request.nextUrl.pathname)

    if (!resolution.isValidEntity || !resolution.entityConfig) {
      const response = createApiError('Entity not found', 404)
      return addCorsHeaders(response, request)
    }

    // Check if entity supports delete operation
    if (!validateEntityOperation(resolution.entityConfig, 'delete')) {
      const response = createApiError('Delete operation not supported for this entity', 405)
      return addCorsHeaders(response, request)
    }

    // Authenticate request
    const authResult = await authenticateRequest(request)
    audit.auth = authResult

    if (!authResult.success) {
      return NextResponse.json(
          { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
          { status: 401 }
      )
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse
    }

    // Check required permissions for all auth types. Delete is its own
    // scope (`<slug>:delete`, distinct from `:write`) — API_SCOPES already
    // defines it per entity; this previously checked `:write` instead, which
    // made a write-scoped key able to delete and made the `:delete` scope
    // itself pure decoration.
    if (!hasRequiredScope(authResult, `${resolution.entityConfig.slug}:delete`)) {
      const response = createApiError('Insufficient permissions', 403)
      return addCorsHeaders(response, request)
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
      return addCorsHeaders(response, request)
    }

    // Entity-level, team-role-based permission check — runs for both session
    // and API-key auth, in addition to the coarse `:delete` scope check above.
    const permDenied = await checkAuthPermission(authResult, resolution.entityConfig.slug, 'delete', teamId, request)
    if (permDenied) return permDenied

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

    let deleteQuery: string
    if (entityConfig.table?.softDelete) {
      // Soft delete: SET deletedAt + deletedBy instead of removing the row
      whereConditions.push(`"deletedAt" IS NULL`)
      deleteQuery = `
        UPDATE "${tableName}"
        SET "deletedAt" = NOW(), "deletedBy" = $${paramIndex++}
        WHERE ${whereConditions.join(' AND ')}
        RETURNING id
      `
      deleteParams.push(authResult.user!.id)
    } else {
      // Hard delete: remove the row
      deleteQuery = `
        DELETE FROM "${tableName}"
        WHERE ${whereConditions.join(' AND ')}
        RETURNING id
      `
    }

    const result = await mutateWithRLS(deleteQuery, deleteParams, authResult.user!.id)

    if (!result.rows || result.rows.length === 0) {
      const response = createApiError('Item not found', 404)
      return addCorsHeaders(response, request)
    }

    // Fire entity hooks for plugins to react
    try {
      await afterEntityDelete(entityConfig.slug, id, authResult.user!.id)
    } catch (hookError) {
      console.error(`[generic-handler] Error in afterEntityDelete hook for ${entityConfig.slug}:`, hookError)
      // Don't fail the request if hooks fail
    }

    // ── Usage tracking: decrement on delete (fire-and-forget) ────────
    const deleteAction = `${entityConfig.slug}.create`
    const deleteLimitSlug = BILLING_REGISTRY?.actionMappings?.limits?.[deleteAction]
    if (deleteLimitSlug) {
      UsageService.track({
        teamId,
        userId: authResult.user!.id,
        limitSlug: deleteLimitSlug,
        delta: -1,
        action: `${entityConfig.slug}.delete`,
        resourceType: entityConfig.slug,
        resourceId: id,
      }).catch(() => {}) // Silent — never break entity deletion
    }

    const response = createApiResponse({ success: true, id })
    return addCorsHeaders(response, request)

  } catch (error) {
    console.error('Error in generic delete handler:', error)

    // Foreign key violation → 409 Conflict (entity is referenced by other records)
    const constraintResponse = mapConstraintViolation(error, 'delete')
    if (constraintResponse) {
      return addCorsHeaders(constraintResponse, request)
    }

    const response = createApiError('Internal server error', 500)
    return addCorsHeaders(response, request)
  }
}

/**
 * Handle CORS preflight for all generic endpoints
 */
export async function handleGenericOptions(request: NextRequest): Promise<NextResponse> {
  return handleCorsPreflightRequest(request)
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
