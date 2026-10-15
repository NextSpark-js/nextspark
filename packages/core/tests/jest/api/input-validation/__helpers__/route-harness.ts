/**
 * Shared harness for the route-level input-validation suites (S192).
 *
 * Registers the module mocks a route needs to run outside a generated project (database, dual auth, rate limit,
 * and the heavy imports of lib/api/helpers) while keeping the REAL helpers (createApiError, parsePaginationParams,
 * parseFilters, ...) so the response shape under test is the one the route really sends.
 *
 * The harness MUST be imported before the route module, so the `jest.mock` registrations run first.
 */

import { NextRequest, NextResponse } from 'next/server'
import { bodyOf, expectCleanRejection, jsonReaderFor, MALFORMED_BODIES, writesFrom, type BodyKind, type ResponseLike } from './clean-rejection'

// ---------------------------------------------------------------------------
// Module mocks (variables must be `mock`-prefixed to be usable in factories)
// ---------------------------------------------------------------------------

const mockQueryWithRLS = jest.fn()
const mockQueryOneWithRLS = jest.fn()
const mockMutateWithRLS = jest.fn()
const mockTxMutate = jest.fn()
const mockTxQuery = jest.fn()
const mockTxCommit = jest.fn()
const mockTxRollback = jest.fn()
jest.mock('@/core/lib/db', () => ({
  queryWithRLS: (...args: unknown[]) => mockQueryWithRLS(...args),
  queryOneWithRLS: (...args: unknown[]) => mockQueryOneWithRLS(...args),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
  queryWithService: (...args: unknown[]) => mockQueryWithRLS(...args),
  mutateWithService: (...args: unknown[]) => mockMutateWithRLS(...args),
  getTransactionClient: async () => ({
    query: (...args: unknown[]) => mockTxQuery(...args),
    mutate: (...args: unknown[]) => mockTxMutate(...args),
    commit: async () => mockTxCommit(),
    rollback: async () => mockTxRollback(),
  }),
}))

const mockAuthenticateRequest = jest.fn()
jest.mock('@/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => mockAuthenticateRequest(...args),
  hasRequiredScope: () => true,
  canBypassTeamContext: async () => false,
  createAuthFailureResponse: (authResult: { error?: { code: string; status: number; message: string } }) => {
    const failure = authResult.error ?? { code: 'AUTHENTICATION_FAILED', status: 401, message: 'Authentication required' }
    return NextResponse.json({ success: false, error: failure.message, code: failure.code }, { status: failure.status })
  },
}))

jest.mock('@/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
  withAddressRateLimit: (handler: unknown) => handler,
  checkRateLimit: jest.fn(),
  addRateLimitHeaders: jest.fn(),
  apiKeyRateLimitResponse: jest.fn(),
}))

// What lib/api/helpers imports and the routes under test do not exercise.
jest.mock('@/core/lib/api/auth', () => ({ validateApiKey: jest.fn(), getValidatedApiKey: jest.fn(() => null) }))
jest.mock('@/core/lib/auth', () => ({ auth: { api: { getSession: jest.fn() } } }))
jest.mock('@/core/lib/config', () => ({ getApplicationConfig: jest.fn(() => ({})) }))
jest.mock('@/core/lib/services/meta.service', () => ({ MetaService: {} }))
jest.mock('@/core/lib/services/scope.service', () => ({
  ScopeService: { getAllowedFilters: () => ['role'], getBaseScopes: () => [], getRoleScopes: () => [], getFlagScopes: () => [], getRestrictionRules: () => ({}) },
}))
jest.mock('@/core/lib/entities/registry', () => ({ getEntityConfig: jest.fn() }))
jest.mock('@/core/lib/entities/queries', () => ({ getChildEntities: jest.fn(), getEntity: jest.fn(), setEntityRegistry: jest.fn() }))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const SUPERADMIN = { id: 'admin-1', email: 'admin@test.com', role: 'superadmin' }
export const DEVELOPER = { id: 'dev-1', email: 'dev@test.com', role: 'developer' }
export const MEMBER = { id: 'user-1', email: 'user@test.com', role: 'member' }

export const sessionAs = (user: { id: string; email: string; role: string }) => ({ success: true, type: 'session' as const, user })

export const VALID_UUID = '3f2b8c1e-5d4a-4b7e-9c10-2a6f8d1e4b90'
export const OTHER_UUID = '9a1c7e22-0b3d-4f6a-8e55-1d2c3b4a5f60'

/** A NextRequest whose `json()` behaves like the platform's for the given body class. */
export function makeReq(method: string, url: string, body?: BodyKind, headers: Record<string, string> = {}): NextRequest {
  const request = new NextRequest(url.startsWith('http') ? url : `http://localhost${url}`, { method, headers })
  if (body) (request as unknown as { json: () => Promise<unknown> }).json = jsonReaderFor(body)
  return request
}

export const asJson = (value: unknown): BodyKind => ({ kind: 'json', value })

export const idParams = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) })

/** Every statement that writes, through any of the database paths a route can take. */
export function allWrites(): Array<[string, unknown[]]> {
  return [
    ...writesFrom(mockMutateWithRLS),
    ...writesFrom(mockQueryWithRLS),
    ...writesFrom(mockQueryOneWithRLS),
    ...writesFrom(mockTxMutate),
    ...writesFrom(mockTxQuery),
  ]
}

function reset() {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  mockQueryWithRLS.mockResolvedValue([])
  mockQueryOneWithRLS.mockResolvedValue(null)
  mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })
  mockTxMutate.mockResolvedValue({ rows: [], rowCount: 0 })
  mockTxQuery.mockResolvedValue({ rows: [], rowCount: 0 })
  mockAuthenticateRequest.mockResolvedValue(sessionAs(SUPERADMIN))
}

export const routeHarness = {
  reset,
  mocks: {
    queryWithRLS: mockQueryWithRLS,
    queryOneWithRLS: mockQueryOneWithRLS,
    mutateWithRLS: mockMutateWithRLS,
    txMutate: mockTxMutate,
    txQuery: mockTxQuery,
    txCommit: mockTxCommit,
    txRollback: mockTxRollback,
    authenticateRequest: mockAuthenticateRequest,
  },
}

// ---------------------------------------------------------------------------
// Matrices
// ---------------------------------------------------------------------------

/** A case that misbehaves today: `test.failing`, or a plain `test` when S192_SHOW_DEFECTS=1 (to read the failure reasons). */
const knownDefect: typeof test = (process.env.S192_SHOW_DEFECTS === '1' ? test : test.failing) as typeof test

export const noWrites = () => expect(allWrites()).toEqual([])

/**
 * One test per malformed-body class for an endpoint that takes a JSON object. `defects` lists the classes that
 * misbehave today (S192 findings); they run as `test.failing` so the suite stays green and the defect stays visible.
 */
export function describeMalformedBodies(
  invoke: (body: BodyKind) => Promise<ResponseLike>,
  options: { defects?: string[]; status?: number; code?: string | RegExp } = {},
) {
  const defects = new Set(options.defects ?? [])
  describe.each(MALFORMED_BODIES)('%s', (label, body) => {
    const run = async () => {
      const response = await invoke(body)
      await expectCleanRejection(response, { status: options.status ?? 400, code: options.code })
      noWrites()
    }
    if (defects.has(label)) knownDefect('is rejected with 4xx and writes nothing', run)
    else test('is rejected with 4xx and writes nothing', run)
  })
}

/** Value-level rejections for one endpoint: [label, body] pairs that must come back 4xx with nothing written. */
export function describeRejectedValues(
  invoke: (body: BodyKind) => Promise<ResponseLike>,
  cases: Array<[string, unknown]>,
  options: { defects?: string[]; status?: number; code?: string | RegExp } = {},
) {
  const defects = new Set(options.defects ?? [])
  describe.each(cases)('%s', (label, value) => {
    const run = async () => {
      const response = await invoke(asJson(value))
      await expectCleanRejection(response, { status: options.status ?? 400, code: options.code })
      noWrites()
    }
    if (defects.has(label)) knownDefect('is rejected with 4xx and writes nothing', run)
    else test('is rejected with 4xx and writes nothing', run)
  })
}

export { bodyOf, expectCleanRejection }
