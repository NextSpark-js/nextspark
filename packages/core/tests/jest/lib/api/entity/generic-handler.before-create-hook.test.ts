/**
 * Generic Entity Handler — beforeEntityCreate hook wiring
 *
 * Verifies that handleGenericCreate invokes the beforeEntityCreate hook
 * before the INSERT, uses its return value to build the row, and aborts
 * the create (without writing) when a registered `before_create` filter
 * throws.
 *
 * This exercises the REAL EntityHookManager / HookSystem (registering an
 * actual filter via `addFilter`), not a mock of the hook manager. Mocking
 * `entity-hooks` here would hide exactly the class of bug this suite
 * guards against: `HookSystem.applyFilters` swallows callback errors
 * (see `lib/plugins/hook-system.ts`), so a filter that throws would never
 * have reached `generic-handler.ts`'s catch block unless the manager
 * actually propagates it — the `applyFiltersStrict` wiring below.
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { NextResponse } from 'next/server'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'

// ---------------------------------------------------------------------------
// Mocks — one per direct dependency of generic-handler.ts, EXCEPT
// entity-hooks / hook-system (kept real — see file header).
// ---------------------------------------------------------------------------

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn(),
  hasRequiredScope: jest.fn(),
  canBypassTeamContext: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/api/entity/resolver', () => ({
  resolveEntityFromUrl: jest.fn(),
  validateEntityOperation: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/entities/schema-generator', () => ({
  generateEntitySchemas: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
  queryOneWithRLS: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  createApiResponse: jest.fn(),
  createApiError: jest.fn(),
  parsePaginationParams: jest.fn(),
  createPaginationMeta: jest.fn(),
  parseMetaParams: jest.fn(),
  parseChildParams: jest.fn(),
  includeEntityMetadata: jest.fn(),
  includeEntityChildren: jest.fn(),
  processEntityMetadata: jest.fn(),
  handleEntityMetadataInResponse: jest.fn(),
  addCorsHeaders: jest.fn(),
  handleCorsPreflightRequest: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/permissions/check', () => ({
  checkPermission: jest.fn(),
}))
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
const mockCheckPermission = checkPermission as jest.Mock

jest.mock('@nextsparkjs/core/lib/blocks/pattern-resolver', () => ({
  extractPatternIds: jest.fn(),
}))

jest.mock('@nextsparkjs/core/types/pattern-reference', () => ({
  isPatternReference: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/services/pattern-usage.service', () => ({
  PatternUsageService: { getExistingPatternIds: jest.fn() },
}))

jest.mock('@nextsparkjs/core/lib/services/subscription.service', () => ({
  SubscriptionService: { canPerformAction: jest.fn() },
}))

jest.mock('@nextsparkjs/core/lib/services/usage.service', () => ({
  UsageService: { track: jest.fn() },
}))

// entity-hooks.ts registers pattern/block-usage tracking as a side effect
// of being imported (`initPatternUsageHooks()` at module scope), which
// pulls in the entity registry and the scheduled-actions system — neither
// relevant here and neither safe to load outside a generated project. It
// only wires ACTION hooks ('entity.created' etc.), so neutralizing it does
// not touch the before_create FILTER hook under test.
jest.mock('@nextsparkjs/core/lib/entities/pattern-usage-hooks', () => ({
  initPatternUsageHooks: jest.fn(),
}))

import { handleGenericCreate } from '@nextsparkjs/core/lib/api/entity/generic-handler'
import {
  authenticateRequest,
  hasRequiredScope,
  canBypassTeamContext,
} from '@nextsparkjs/core/lib/api/auth/dual-auth'
import {
  resolveEntityFromUrl,
  validateEntityOperation,
} from '@nextsparkjs/core/lib/api/entity/resolver'
import { generateEntitySchemas } from '@nextsparkjs/core/lib/entities/schema-generator'
import { queryWithRLS, mutateWithRLS, queryOneWithRLS } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  addCorsHeaders,
  handleEntityMetadataInResponse,
} from '@nextsparkjs/core/lib/api/helpers'
// Real hook system — used to register genuine `before_create` filters so
// these tests go through the actual EntityHookManager -> HookSystem path
// that generic-handler.ts now calls into.
import { addFilter, getGlobalHooks } from '@nextsparkjs/core/lib/plugins/hook-system'

const mockAuthenticateRequest = authenticateRequest as jest.Mock
const mockHasRequiredScope = hasRequiredScope as jest.Mock
const mockCanBypassTeamContext = canBypassTeamContext as jest.Mock
const mockResolveEntityFromUrl = resolveEntityFromUrl as jest.Mock
const mockValidateEntityOperation = validateEntityOperation as jest.Mock
const mockGenerateEntitySchemas = generateEntitySchemas as jest.Mock
const mockQueryWithRLS = queryWithRLS as jest.Mock
const mockMutateWithRLS = mutateWithRLS as jest.Mock
const mockQueryOneWithRLS = queryOneWithRLS as jest.Mock
const mockCreateApiResponse = createApiResponse as jest.Mock
const mockCreateApiError = createApiError as jest.Mock
const mockAddCorsHeaders = addCorsHeaders as jest.Mock
const mockHandleEntityMetadataInResponse = handleEntityMetadataInResponse as jest.Mock

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockEntityConfig = {
  slug: 'items',
  enabled: true,
  names: { singular: 'item', plural: 'Items' },
  fields: [{ name: 'title', type: 'text', api: { readOnly: false } }],
  access: { public: false, api: true, metadata: false, shared: false },
} as unknown as EntityConfig

function buildRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return {
    url: 'http://localhost/api/v1/items',
    nextUrl: { pathname: '/api/v1/items', origin: 'http://localhost' },
    headers: new Headers({ 'x-team-id': 'team-1', ...headers }),
    json: async () => body,
  } as any
}

describe('handleGenericCreate - beforeEntityCreate hook wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Real hook system: start every test with a clean slate so a filter
    // registered in one test can't leak into the next.
    getGlobalHooks().clear()

    mockResolveEntityFromUrl.mockResolvedValue({
      entityName: 'items',
      entityConfig: mockEntityConfig,
      hasCustomOverride: false,
      isValidEntity: true,
    })
    mockValidateEntityOperation.mockReturnValue(true)

    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      type: 'api-key',
      user: { id: 'user-1', email: 'user@example.com', role: 'member' },
      scopes: ['items:write'],
    })
    mockHasRequiredScope.mockReturnValue(true)
    mockCanBypassTeamContext.mockResolvedValue(true)
    // generic-handler.ts now runs checkAuthPermission() (entity-level,
    // team-role permission check) before firing beforeEntityCreate — that
    // wasn't true when this test was first written, since the hook used to
    // fire earlier in the pipeline. Must resolve truthy or every request
    // in this file 403s before ever reaching the hook under test.
    mockCheckPermission.mockResolvedValue(true)

    // Pass-through "validator" — real Zod schema generation is exercised by
    // schema-generator's own tests, not by this handler-level suite.
    mockGenerateEntitySchemas.mockReturnValue({
      create: { safeParse: (data: unknown) => ({ success: true, data }) },
    })

    mockQueryOneWithRLS.mockResolvedValue(null)
    mockMutateWithRLS.mockResolvedValue({
      rows: [{ id: 'entity-1' }],
      rowCount: 1,
    })
    mockQueryWithRLS.mockResolvedValue([
      { id: 'entity-1', userId: 'user-1', teamId: 'team-1', title: 'placeholder' },
    ])

    mockHandleEntityMetadataInResponse.mockImplementation(async (_type: string, entity: unknown) => entity)

    mockCreateApiResponse.mockImplementation(
      (data: unknown, meta?: Record<string, unknown>, status = 200) =>
        NextResponse.json(
          { success: true, data, info: { timestamp: new Date().toISOString(), ...meta } },
          { status }
        )
    )
    mockCreateApiError.mockImplementation(
      (message: string, status = 400, details?: unknown, code?: string) =>
        NextResponse.json(
          {
            success: false,
            error: message,
            code: code || `HTTP_${status}`,
            details,
            info: { timestamp: new Date().toISOString() },
          },
          { status }
        )
    )
    mockAddCorsHeaders.mockImplementation(async (response: unknown) => response)
  })

  test('no hook registered: create behaves exactly as before this change', async () => {
    // No `entity.items.before_create` filter registered at all — the
    // baseline every existing project (not using this hook) is in today.
    const request = buildRequest({ title: 'Espacio Zen' })

    const response = await handleGenericCreate(request)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.success).toBe(true)

    const insertValues = mockMutateWithRLS.mock.calls[0][1]
    expect(insertValues).toContain('Espacio Zen')
  })

  test('hook transforms the payload: the INSERT receives the transformed data', async () => {
    // A real filter registered on the real hook system, exactly like a
    // plugin would via `addFilter('entity.<slug>.before_create', ...)`.
    // EntityHookManager.beforeEntityCreate wraps the payload in
    // `{ entityName, entityConfig, data, userId, operation }` before
    // handing it to the filter, and unwraps `.data` from whatever the
    // filter returns — so the callback must return that same shape back.
    addFilter('entity.items.before_create', (hookData: any) => ({
      ...hookData,
      data: { ...hookData.data, title: `${hookData.data.title} (validated)` },
    }))

    const request = buildRequest({ title: 'Espacio Zen' })
    const response = await handleGenericCreate(request)

    expect(response.status).toBe(201)

    // #105's audit-log wrapper also calls mutateWithRLS (INSERT INTO
    // api_audit_log) for every request, success or failure — filter it out
    // to isolate the actual entity-table INSERT this test cares about.
    const entityWrites = mockMutateWithRLS.mock.calls.filter(([sql]: [string]) => !sql.includes('api_audit_log'))
    expect(entityWrites).toHaveLength(1)

    const insertValues = entityWrites[0][1]
    expect(insertValues).toContain('Espacio Zen (validated)')
    expect(insertValues).not.toContain('Espacio Zen')
  })

  test('hook throws: the create is aborted, no INSERT runs, and the error maps to a 400', async () => {
    // This is the exact bug class this suite guards against: before this
    // fix, HookSystem.applyFilters would catch this throw, log it, and
    // let the (unmodified) payload continue straight to the INSERT. With
    // applyFiltersStrict wired into beforeEntityCreate, the throw now
    // propagates out of the real hook manager and generic-handler.ts's
    // own try/catch turns it into a 400.
    addFilter('entity.items.before_create', () => {
      throw new Error('referenced resource belongs to another tenant')
    })

    const request = buildRequest({ title: 'Espacio Zen' })
    const response = await handleGenericCreate(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.code).toBe('BEFORE_CREATE_REJECTED')
    expect(json.error).toBe('referenced resource belongs to another tenant')

    // #105's audit-log wrapper still logs the (denied) request — that INSERT
    // is expected. What must not happen is an entity-table write.
    const entityWrites = mockMutateWithRLS.mock.calls.filter(([sql]: [string]) => !sql.includes('api_audit_log'))
    expect(entityWrites).toHaveLength(0)
  })
})
