/**
 * Shared test harness for the generic entity handlers
 * (`packages/core/src/lib/api/entity/generic-handler.ts`).
 *
 * Registers every module mock the handlers need to run outside a generated
 * project (DB, dual-auth, resolver, permissions, helpers, hooks, billing) and
 * exposes the mock functions plus small request/auth/entity fixtures.
 *
 * Usage — the harness MUST be imported before the handler module so the
 * `jest.mock` registrations run first:
 *
 *   import { harness } from './__helpers__/generic-handler-harness'
 *   import { handleGenericList } from '@/core/lib/api/entity/generic-handler'
 *
 *   beforeEach(() => harness.reset())
 *
 * The mock implementations mirror the real, config-free helpers closely enough
 * for the paths under test (no `metas`/`child` params are sent by these
 * fixtures, so the "not requested" branches are what's exercised).
 */

import type { EntityConfig } from '@/core/lib/entities/types'

// ---------------------------------------------------------------------------
// Module mocks (variables must be `mock`-prefixed to be usable in factories)
// ---------------------------------------------------------------------------

const mockResolveEntityFromUrl = jest.fn()
const mockValidateEntityOperation = jest.fn()
jest.mock('@/core/lib/api/entity/resolver', () => ({
  resolveEntityFromUrl: (...args: unknown[]) => mockResolveEntityFromUrl(...args),
  validateEntityOperation: (...args: unknown[]) => mockValidateEntityOperation(...args),
}))

// Full mock — the real dual-auth.ts transitively loads lib/auth.ts (Better
// Auth + DB bootstrapping). hasRequiredScope mirrors the real implementation.
const mockAuthenticateRequest = jest.fn()
const mockCanBypassTeamContext = jest.fn()
jest.mock('@/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => mockAuthenticateRequest(...args),
  canBypassTeamContext: (...args: unknown[]) => mockCanBypassTeamContext(...args),
  hasRequiredScope: (authResult: { type: string; scopes?: string[] }, requiredScope: string) => {
    if (authResult.type === 'session') return true
    if (authResult.type === 'api-key' && authResult.scopes) {
      return authResult.scopes.includes(requiredScope) || authResult.scopes.includes('*')
    }
    return false
  },
}))

const mockCheckPermission = jest.fn()
jest.mock('@/core/lib/permissions/check', () => ({
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
}))

const mockQueryWithRLS = jest.fn()
const mockQueryOneWithRLS = jest.fn()
const mockMutateWithRLS = jest.fn()
jest.mock('@/core/lib/db', () => ({
  queryWithRLS: (...args: unknown[]) => mockQueryWithRLS(...args),
  queryOneWithRLS: (...args: unknown[]) => mockQueryOneWithRLS(...args),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
}))

const mockGenerateEntitySchemas = jest.fn()
jest.mock('@/core/lib/entities/schema-generator', () => ({
  generateEntitySchemas: (...args: unknown[]) => mockGenerateEntitySchemas(...args),
}))

const mockBeforeEntityCreate = jest.fn()
const mockAfterEntityCreate = jest.fn()
const mockBeforeEntityUpdate = jest.fn()
const mockAfterEntityUpdate = jest.fn()
const mockAfterEntityDelete = jest.fn()
jest.mock('@/core/lib/entities/entity-hooks', () => ({
  beforeEntityCreate: (...args: unknown[]) => mockBeforeEntityCreate(...args),
  afterEntityCreate: (...args: unknown[]) => mockAfterEntityCreate(...args),
  beforeEntityUpdate: (...args: unknown[]) => mockBeforeEntityUpdate(...args),
  afterEntityUpdate: (...args: unknown[]) => mockAfterEntityUpdate(...args),
  afterEntityDelete: (...args: unknown[]) => mockAfterEntityDelete(...args),
}))

jest.mock('@nextsparkjs/registries/billing-registry', () => ({
  BILLING_REGISTRY: { actionMappings: { limits: {} } },
}))

jest.mock('@/core/lib/services/pattern-usage.service', () => ({
  PatternUsageService: { track: jest.fn(), untrack: jest.fn() },
}))
jest.mock('@/core/lib/services/subscription.service', () => ({
  SubscriptionService: { getActive: jest.fn(), canPerformAction: jest.fn() },
}))
jest.mock('@/core/lib/services/usage.service', () => ({
  UsageService: { track: jest.fn(), checkLimit: jest.fn() },
}))

// Full mock — helpers.ts imports `../auth` (Better Auth + DB bootstrapping).
jest.mock('@/core/lib/api/helpers', () => ({
  createApiResponse: (data: unknown, meta?: Record<string, unknown>, status = 200) => ({
    status,
    body: { success: true, data, info: { timestamp: new Date().toISOString(), ...meta } },
    async json() { return this.body },
  }),
  createApiError: (message: string, status = 400, details?: unknown, code?: string) => ({
    status,
    body: { success: false, error: message, code: code || `HTTP_${status}`, details },
    async json() { return this.body },
  }),
  addCorsHeaders: async (response: unknown) => response,
  handleCorsPreflightRequest: async () => ({ status: 200 }),
  parsePaginationParams: (request: { url: string }) => {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    return { page, limit, offset: (page - 1) * limit }
  },
  createPaginationMeta: (page: number, limit: number, total: number) => ({
    page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total,
  }),
  parseMetaParams: () => ({ includeMetadata: false, includeAll: false }),
  parseChildParams: () => ({ includeChildren: false, includeAll: false }),
  includeEntityMetadata: async (_entityType: string, entities: unknown[]) => entities,
  includeEntityChildren: async (_entityName: string, entities: unknown[]) => entities,
  handleEntityMetadataInResponse: async (_entityType: string, entity: unknown) => entity,
  processEntityMetadata: async () => ({ success: true, errors: [] }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export interface MockResponse {
  status: number
  body: { success: boolean; data?: unknown; error?: string; code?: string; details?: unknown }
  json(): Promise<MockResponse['body']>
}

export function makeRequest(options: {
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: unknown
}) {
  const headerMap = new Map(Object.entries(options.headers ?? {}))
  const url = options.url ?? 'http://localhost/api/v1/pets'
  return {
    method: options.method ?? 'GET',
    url,
    nextUrl: new URL(url),
    headers: { get: (key: string) => headerMap.get(key) ?? null },
    cookies: { get: () => undefined },
    json: async () => options.body ?? {},
  } as unknown as import('next/server').NextRequest
}

/** Build a list URL with properly encoded query params. */
export function listUrl(params: Record<string, string>, entity = 'pets') {
  const url = new URL(`http://localhost/api/v1/${entity}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return url.toString()
}

export const API_KEY_AUTH = (scopes: string[], userRole = 'user') => ({
  success: true,
  type: 'api-key' as const,
  user: { id: 'key-owner-1', email: 'owner@test.com', role: userRole },
  scopes,
  keyId: 'key-1',
})

export const SESSION_AUTH = (userId = 'session-user-1', userRole = 'user') => ({
  success: true,
  type: 'session' as const,
  user: { id: userId, email: 'user@test.com', role: userRole },
})

/**
 * Plain team-scoped entity, no ownership filter. Field mix covers the
 * branches under test: text, select, datetime and a JSONB `tags` field.
 */
export const PETS_ENTITY: EntityConfig = {
  slug: 'pets',
  tableName: 'pets',
  fields: [
    { name: 'name', type: 'text', api: { readOnly: false } } as never,
    { name: 'status', type: 'select', api: { readOnly: false } } as never,
    { name: 'ownerId', type: 'text', api: { readOnly: false } } as never,
    { name: 'adoptedAt', type: 'datetime', api: { readOnly: false } } as never,
    { name: 'hashtags', type: 'tags', api: { readOnly: false } } as never,
  ],
  access: { api: true },
} as unknown as EntityConfig

/** Route the `team_members` lookups the handlers perform. */
export function routeQueryOneWithRLS(teamRole: string | null, memberExists = true) {
  mockQueryOneWithRLS.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id FROM "team_members"')) {
      return memberExists ? { id: 'membership-1' } : null
    }
    if (sql.includes('SELECT role FROM "team_members"')) {
      return teamRole ? { role: teamRole } : null
    }
    return null
  })
}

/** Flush pending microtasks (for fire-and-forget side effects). */
export async function flushPromises() {
  await new Promise(resolve => setImmediate(resolve))
}

function reset() {
  jest.clearAllMocks()
  mockResolveEntityFromUrl.mockResolvedValue({
    isValidEntity: true,
    entityConfig: PETS_ENTITY,
    entityName: 'pets',
    hasCustomOverride: false,
  })
  mockValidateEntityOperation.mockReturnValue(true)
  mockQueryWithRLS.mockResolvedValue([])
  mockCanBypassTeamContext.mockResolvedValue(false)
  mockCheckPermission.mockResolvedValue(true)
  routeQueryOneWithRLS('member')
  // Pass-through hooks by default (mirrors the real no-plugin behaviour)
  mockBeforeEntityCreate.mockImplementation(async (_slug: string, data: unknown) => data)
  mockBeforeEntityUpdate.mockImplementation(async (_slug: string, _id: string, changes: unknown) => changes)
  mockGenerateEntitySchemas.mockReturnValue({
    create: { safeParse: (data: unknown) => ({ success: true, data }) },
    update: { safeParse: (data: unknown) => ({ success: true, data }) },
  })
}

export const harness = {
  reset,
  mocks: {
    resolveEntityFromUrl: mockResolveEntityFromUrl,
    validateEntityOperation: mockValidateEntityOperation,
    authenticateRequest: mockAuthenticateRequest,
    canBypassTeamContext: mockCanBypassTeamContext,
    checkPermission: mockCheckPermission,
    queryWithRLS: mockQueryWithRLS,
    queryOneWithRLS: mockQueryOneWithRLS,
    mutateWithRLS: mockMutateWithRLS,
    generateEntitySchemas: mockGenerateEntitySchemas,
    beforeEntityCreate: mockBeforeEntityCreate,
    afterEntityCreate: mockAfterEntityCreate,
    beforeEntityUpdate: mockBeforeEntityUpdate,
    afterEntityUpdate: mockAfterEntityUpdate,
    afterEntityDelete: mockAfterEntityDelete,
  },
}
