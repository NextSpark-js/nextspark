/**
 * ⚠️  DEPRECATED: Auto-API Generation System
 *
 * This system is deprecated due to anti-hardcoding policy violations.
 * All mock functions and hardcoded logic have been removed.
 *
 * Use specific entity API endpoints instead:
 * - /api/v1/{entityType} for list operations
 * - /api/v1/{entityType}/{id} for single operations
 *
 * @deprecated Use registry-based specific endpoints instead
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityConfig, ChildEntityDefinition, HookContext } from './types'
import { getEntityConfig } from './registry'
import { executeEntityHooks } from './hooks'
import { auth } from '../auth'
import type { UserRole } from '../../types/user.types'

export interface APIGeneratorOptions {
  enableAuth?: boolean
  enableRateLimit?: boolean
  enableCORS?: boolean
  enableChildEntities?: boolean
  customValidation?: Record<string, z.ZodSchema>
  customMiddleware?: APIMiddleware[]
}

export interface APIMiddleware {
  name: string
  execute: (req: NextRequest, context: APIContext) => Promise<NextRequest>
}

export interface APIContext {
  entityName: string
  entityConfig: EntityConfig
  user?: Record<string, unknown>
  action: 'create' | 'read' | 'update' | 'delete'
  data?: Record<string, unknown>
}

export interface GeneratedAPIResponse {
  data?: unknown
  children?: Record<string, unknown[]>
  meta?: {
    total?: number
    page?: number
    limit?: number
    hasMore?: boolean
  }
  error?: string
  validationErrors?: Record<string, string>
}

/**
 * Generate CRUD API routes for an entity
 */
export function generateEntityAPI(
  entityName: string,
  options: APIGeneratorOptions = {}
) {
  const entityConfig = getEntityConfig(entityName)
  if (!entityConfig) {
    throw new Error(`Entity configuration not found: ${entityName}`)
  }

  const {
    enableAuth = true,
    enableChildEntities = true,
    customValidation = {},
    customMiddleware = []
  } = options

  return {
    GET: createGETHandler(entityConfig, { enableAuth, enableChildEntities, customMiddleware }),
    POST: createPOSTHandler(entityConfig, { enableAuth, enableChildEntities, customValidation, customMiddleware }),
    PATCH: createPATCHHandler(entityConfig, { enableAuth, enableChildEntities, customValidation, customMiddleware }),
    DELETE: createDELETEHandler(entityConfig, { enableAuth, customMiddleware }),
  }
}

/**
 * Create GET handler (list and single item)
 */
function createGETHandler(
  entityConfig: EntityConfig,
  options: {
    enableAuth: boolean
    enableChildEntities: boolean
    customMiddleware: APIMiddleware[]
  }
) {
  return async (request: NextRequest, context?: { params?: { id?: string } }) => {
    try {
      // Authentication
      let user = null
      if (options.enableAuth) {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }
        user = session.user
      }

      // All authenticated users can access all enabled entities now
      // Permission system has been simplified

      // Execute custom middleware
      for (const middleware of options.customMiddleware) {
        await middleware.execute(request, {
          entityName: entityConfig.slug,
          entityConfig,
          user: user as Record<string, unknown>,
          action: 'read'
        })
      }

      const { searchParams } = new URL(request.url)
      const id = context?.params?.id

      // Execute beforeQuery hooks
      const hookContext: HookContext = {
        entityName: entityConfig.slug,
        operation: 'query',
        user: user ? { id: user.id, role: user.role as UserRole } : { id: '', role: 'member' as UserRole },
        data: { id, searchParams: Object.fromEntries(searchParams) }
      }

      await executeEntityHooks(entityConfig.slug, 'beforeQuery', hookContext)

      let result: GeneratedAPIResponse

      if (id) {
        // Single item GET
        result = await handleSingleItemGet(entityConfig, id, searchParams, options.enableChildEntities)
      } else {
        // List GET
        result = await handleListGet(entityConfig, searchParams, options.enableChildEntities)
      }

      // Execute afterQuery hooks
      await executeEntityHooks(entityConfig.slug, 'afterQuery', { ...hookContext, data: result })

      return NextResponse.json(result)

    } catch (error) {
      console.error(`GET ${entityConfig.slug} error:`, error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Handle single item GET request
 */
async function handleSingleItemGet(
  entityConfig: EntityConfig,
  id: string,
  searchParams: URLSearchParams,
  enableChildEntities: boolean
): Promise<GeneratedAPIResponse> {
  // TODO: Implement actual database query using registry-based approach
  // This generic API generator is deprecated - use specific entity endpoints instead
  throw new Error(`Generic single item retrieval not implemented for ${entityConfig.slug}. Use specific API endpoint: /api/v1/${entityConfig.slug}/${id}`)
}

/**
 * Handle list GET request
 */
async function handleListGet(
  entityConfig: EntityConfig,
  searchParams: URLSearchParams,
  enableChildEntities: boolean
): Promise<GeneratedAPIResponse> {
  // TODO: Implement actual database query using registry-based approach
  // This generic API generator is deprecated - use specific entity endpoints instead
  throw new Error(`Generic list retrieval not implemented for ${entityConfig.slug}. Use specific API endpoint: /api/v1/${entityConfig.slug}`)
}

/**
 * Create POST handler (create new item)
 */
function createPOSTHandler(
  entityConfig: EntityConfig,
  options: {
    enableAuth: boolean
    enableChildEntities: boolean
    customValidation: Record<string, z.ZodSchema>
    customMiddleware: APIMiddleware[]
  }
) {
  return async (request: NextRequest) => {
    try {
      // Authentication
      let user = null
      if (options.enableAuth) {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }
        user = session.user
      }

      // All authenticated users can access all enabled entities now
      // Permission system has been simplified

      // Plan limits are no longer enforced - simplified system
      // All authenticated users have unlimited access to enabled entities

      const body = await request.json()

      // Validation
      const schema = generateCreateSchema(entityConfig, options.customValidation)
      const validation = schema.safeParse(body)
      
      if (!validation.success) {
        return NextResponse.json({
          error: 'Validation failed',
          validationErrors: validation.error.flatten().fieldErrors
        }, { status: 400 })
      }

      const validatedData = validation.data

      // Execute custom middleware
      for (const middleware of options.customMiddleware) {
        await middleware.execute(request, {
          entityName: entityConfig.slug,
          entityConfig,
          user: user as Record<string, unknown>,
          action: 'create',
          data: validatedData as Record<string, unknown>
        })
      }

      // Execute beforeCreate hooks
      const hookContext: HookContext = {
        entityName: entityConfig.slug,
        operation: 'create',
        user: user ? { id: user.id, role: user.role as UserRole } : { id: '', role: 'member' as UserRole },
        data: validatedData,
      }

      await executeEntityHooks(entityConfig.slug, 'beforeCreate', hookContext)

      // TODO: Implement actual database create using registry-based approach
      throw new Error(`Generic entity creation not implemented for ${entityConfig.slug}. Use specific API endpoint.`)

      // UNREACHABLE CODE - commented out due to throw above
      // // Handle child entities if provided
      // let childrenResult: Record<string, unknown[]> = {}
      // const validatedDataRecord = validatedData as Record<string, unknown>
      // if (options.enableChildEntities && validatedDataRecord.children && entityConfig.childEntities) {
      //   childrenResult = await createChildEntities(
      //     entityConfig,
      //     String(newItem.id),
      //     (validatedData as Record<string, unknown>).children as Record<string, unknown[]>,
      //     user as Record<string, unknown>
      //   )
      // }

      // // Execute afterCreate hooks
      // await executeEntityHooks(entityConfig.slug, 'afterCreate', {
      //   ...hookContext,
      //   data: { ...newItem, children: childrenResult }
      // })

      // const result: GeneratedAPIResponse = {
      //   data: newItem
      // }

      // if (Object.keys(childrenResult).length > 0) {
      //   result.children = childrenResult
      // }

      // return NextResponse.json(result, { status: 201 })

    } catch (error) {
      console.error(`POST ${entityConfig.slug} error:`, error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Create PATCH handler (update existing item)
 */
function createPATCHHandler(
  entityConfig: EntityConfig,
  options: {
    enableAuth: boolean
    enableChildEntities: boolean
    customValidation: Record<string, z.ZodSchema>
    customMiddleware: APIMiddleware[]
  }
) {
  return async (request: NextRequest, context?: { params?: { id?: string } }) => {
    try {
      // Authentication
      let user = null
      if (options.enableAuth) {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }
        user = session.user
      }

      // All authenticated users can access all enabled entities now
      // Permission system has been simplified

      const id = context?.params?.id
      if (!id) {
        return NextResponse.json({ error: 'ID required' }, { status: 400 })
      }

      const body = await request.json()

      // Validation
      const schema = generateUpdateSchema(entityConfig, options.customValidation)
      const validation = schema.safeParse(body)
      
      if (!validation.success) {
        return NextResponse.json({
          error: 'Validation failed',
          validationErrors: validation.error.flatten().fieldErrors
        }, { status: 400 })
      }

      const validatedData = validation.data

      // Check if item exists
      const existingItem = await mockDatabaseGet()
      if (!existingItem) {
        return NextResponse.json(
          { error: `${entityConfig.names.singular} not found` },
          { status: 404 }
        )
      }

      // Execute custom middleware
      for (const middleware of options.customMiddleware) {
        await middleware.execute(request, {
          entityName: entityConfig.slug,
          entityConfig,
          user: user as Record<string, unknown>,
          action: 'update',
          data: { ...(validatedData as Record<string, unknown>), id, existing: existingItem }
        })
      }

      // Execute beforeUpdate hooks
      const hookContext: HookContext = {
        entityName: entityConfig.slug,
        operation: 'update',
        user: user ? { id: user.id, role: user.role as UserRole } : { id: '', role: 'member' as UserRole },
        data: { ...(validatedData as Record<string, unknown>), id, existing: existingItem },
      }

      await executeEntityHooks(entityConfig.slug, 'beforeUpdate', hookContext)

      // Update main entity
      const updatedItem = await mockDatabaseUpdate() as unknown as Record<string, unknown>

      // Handle child entities if provided
      let childrenResult: Record<string, unknown[]> = {}
      if (options.enableChildEntities && (validatedData as Record<string, unknown>).children && entityConfig.childEntities) {
        childrenResult = await updateChildEntities(
          entityConfig,
          id,
          (validatedData as Record<string, unknown>).children as Record<string, unknown[]>,
          user as Record<string, unknown>
        )
      }

      // Execute afterUpdate hooks
      await executeEntityHooks(entityConfig.slug, 'afterUpdate', {
        ...hookContext,
        data: { ...updatedItem, children: childrenResult }
      })

      const result: GeneratedAPIResponse = {
        data: updatedItem
      }

      if (Object.keys(childrenResult).length > 0) {
        result.children = childrenResult
      }

      return NextResponse.json(result)

    } catch (error) {
      console.error(`PATCH ${entityConfig.slug} error:`, error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Create DELETE handler
 */
function createDELETEHandler(
  entityConfig: EntityConfig,
  options: {
    enableAuth: boolean
    customMiddleware: APIMiddleware[]
  }
) {
  return async (request: NextRequest, context?: { params?: { id?: string } }) => {
    try {
      // Authentication
      let user = null
      if (options.enableAuth) {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }
        user = session.user
      }

      // All authenticated users can access all enabled entities now
      // Permission system has been simplified

      const id = context?.params?.id
      if (!id) {
        return NextResponse.json({ error: 'ID required' }, { status: 400 })
      }

      // Check if item exists
      const existingItem = await mockDatabaseGet()
      if (!existingItem) {
        return NextResponse.json(
          { error: `${entityConfig.names.singular} not found` },
          { status: 404 }
        )
      }

      // Execute custom middleware
      for (const middleware of options.customMiddleware) {
        await middleware.execute(request, {
          entityName: entityConfig.slug,
          entityConfig,
          user: user as Record<string, unknown>,
          action: 'delete',
          data: { id, existing: existingItem }
        })
      }

      // Execute beforeDelete hooks
      const hookContext: HookContext = {
        entityName: entityConfig.slug,
        operation: 'delete',
        user: user ? { id: user.id, role: user.role as UserRole } : { id: '', role: 'member' as UserRole },
        data: { id, existing: existingItem },
      }

      await executeEntityHooks(entityConfig.slug, 'beforeDelete', hookContext)

      // Delete child entities first (cascade delete)
      if (entityConfig.childEntities) {
        await deleteAllChildEntities(entityConfig, id)
      }

      // Delete main entity
      await mockDatabaseDelete()

      // Execute afterDelete hooks
      await executeEntityHooks(entityConfig.slug, 'afterDelete', hookContext)

      return NextResponse.json({ success: true })

    } catch (error) {
      console.error(`DELETE ${entityConfig.slug} error:`, error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Generate Zod schema for entity creation
 */
function generateCreateSchema(
  entityConfig: EntityConfig,
  customValidation: Record<string, z.ZodSchema> = {}
): z.ZodSchema {
  const fields: Record<string, z.ZodTypeAny> = {}

  entityConfig.fields.forEach(field => {
    if (field.api.readOnly) return

    let zodField: z.ZodTypeAny

    // Use custom validation if provided
    if (customValidation[field.name]) {
      zodField = customValidation[field.name]
    } else {
      // Generate based on field type
      switch (field.type) {
        case 'text':
        case 'textarea':
          zodField = z.string()
          break
        case 'email':
          zodField = z.string().email()
          break
        case 'url':
          zodField = z.string().url()
          break
        case 'number':
          zodField = z.number()
          break
        case 'boolean':
          zodField = z.boolean()
          break
        case 'date':
        case 'datetime':
          zodField = z.string().datetime()
          break
        case 'select':
          if (field.options && field.options.length > 0) {
            const values = field.options.map(opt => opt.value) as [string, ...string[]]
            zodField = z.enum(values)
          } else {
            zodField = z.string()
          }
          break
        case 'multiselect':
          zodField = z.array(z.string())
          break
        case 'json':
          zodField = z.unknown()
          break
        default:
          zodField = z.unknown()
      }
    }

    // Make optional if not required
    if (!field.required) {
      zodField = zodField.optional()
    }

    fields[field.name] = zodField
  })

  // Add child entities validation
  if (entityConfig.childEntities) {
    const childrenFields: Record<string, z.ZodTypeAny> = {}
    
    Object.entries(entityConfig.childEntities).forEach(([childName, childConfig]) => {
      childrenFields[childName] = z.array(generateChildEntitySchema(childConfig)).optional()
    })

    if (Object.keys(childrenFields).length > 0) {
      fields.children = z.object(childrenFields).optional()
    }
  }

  return z.object(fields)
}

/**
 * Generate Zod schema for entity updates
 */
function generateUpdateSchema(
  entityConfig: EntityConfig,
  customValidation: Record<string, z.ZodSchema> = {}
): z.ZodSchema {
  const createSchema = generateCreateSchema(entityConfig, customValidation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createSchema as any).partial() // Make all fields optional for updates
}

/**
 * Generate Zod schema for child entity
 */
function generateChildEntitySchema(childConfig: ChildEntityDefinition): z.ZodSchema {
  const fields: Record<string, z.ZodTypeAny> = {}

  childConfig.fields.forEach(field => {
    let zodField: z.ZodTypeAny

    switch (field.type) {
      case 'text':
      case 'textarea':
        zodField = z.string()
        break
      case 'email':
        zodField = z.string().email()
        break
      case 'url':
        zodField = z.string().url()
        break
      case 'number':
        zodField = z.number()
        break
      case 'boolean':
        zodField = z.boolean()
        break
      case 'date':
      case 'datetime':
        zodField = z.string().datetime()
        break
      case 'json':
        zodField = z.unknown()
        break
      default:
        zodField = z.unknown()
    }

    if (!field.required) {
      zodField = zodField.optional()
    }

    fields[field.name] = zodField
  })

  return z.object(fields)
}

/**
 * Get child entities for a parent item
 */
async function getChildEntitiesForItem(
  entityConfig: EntityConfig,
  parentId: string,
  childNames: string[]
): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {}

  if (!entityConfig.childEntities) return result

  for (const childName of childNames) {
    if (entityConfig.childEntities[childName]) {
      // TODO: Replace with actual database query
      result[childName] = await mockGetChildEntities()
    }
  }

  return result
}

/**
 * Create child entities for a parent item
 */
async function createChildEntities(
  entityConfig: EntityConfig,
  parentId: string,
  childrenData: Record<string, unknown[]>,
  user: Record<string, unknown>
): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {}

  if (!entityConfig.childEntities) return result

  for (const [childName, childItems] of Object.entries(childrenData)) {
    if (entityConfig.childEntities[childName] && Array.isArray(childItems)) {
      result[childName] = []
      
      for (const childData of childItems) {
        // TODO: Replace with actual database create
        const createdChild = await mockCreateChildEntity()
        result[childName].push(createdChild)
      }
    }
  }

  return result
}

/**
 * Update child entities for a parent item
 */
async function updateChildEntities(
  entityConfig: EntityConfig,
  parentId: string,
  childrenData: Record<string, unknown[]>,
  user: Record<string, unknown>
): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {}

  if (!entityConfig.childEntities) return result

  for (const [childName, childItems] of Object.entries(childrenData)) {
    if (entityConfig.childEntities[childName] && Array.isArray(childItems)) {
      result[childName] = []
      
      for (const childData of childItems) {
        const childDataRecord = childData as Record<string, unknown>
        let updatedChild
        
        if (childDataRecord.id) {
          // Update existing child
          updatedChild = await mockUpdateChildEntity()
        } else {
          // Create new child
          updatedChild = await mockCreateChildEntity()
        }
        
        result[childName].push(updatedChild)
      }
    }
  }

  return result
}

/**
 * Delete all child entities for a parent item
 */
async function deleteAllChildEntities(
  entityConfig: EntityConfig,
  parentId: string
): Promise<void> {
  if (!entityConfig.childEntities) return

  for (const childName of Object.keys(entityConfig.childEntities)) {
    // TODO: Replace with actual database delete
    await mockDeleteAllChildEntities()
  }
}

/**
 * ============================================================================
 * DEPRECATED STUBS: Mock database functions removed
 * ============================================================================
 *
 * All hardcoded mock functions have been removed to comply with anti-hardcoding policies.
 * These stubs prevent compilation errors but should not be used.
 */

// Deprecated stub functions - DO NOT USE
async function mockDatabaseGet(): Promise<never> {
  throw new Error('mockDatabaseGet removed - use specific entity endpoints')
}

async function mockDatabaseList(): Promise<never> {
  throw new Error('mockDatabaseList removed - use specific entity endpoints')
}

async function mockDatabaseCreate(): Promise<never> {
  throw new Error('mockDatabaseCreate removed - use specific entity endpoints')
}

async function mockDatabaseUpdate(): Promise<never> {
  throw new Error('mockDatabaseUpdate removed - use specific entity endpoints')
}

async function mockDatabaseDelete(): Promise<never> {
  throw new Error('mockDatabaseDelete removed - use specific entity endpoints')
}

async function mockGetChildEntities(): Promise<never> {
  throw new Error('mockGetChildEntities removed - use specific entity endpoints')
}

async function mockCreateChildEntity(): Promise<never> {
  throw new Error('mockCreateChildEntity removed - use specific entity endpoints')
}

async function mockUpdateChildEntity(): Promise<never> {
  throw new Error('mockUpdateChildEntity removed - use specific entity endpoints')
}

async function mockDeleteAllChildEntities(): Promise<never> {
  throw new Error('mockDeleteAllChildEntities removed - use specific entity endpoints')
}