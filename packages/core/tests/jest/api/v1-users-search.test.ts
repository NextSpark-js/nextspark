/**
 * #249: GET /api/v1/users?search=…&searchField=… (a relation select with `titleField: 'email'`). The route searches
 * email, name, first and last name; `searchField` must be one of those, and the column names written into the SQL are the
 * route's own constants.
 */
import { NextRequest, NextResponse } from 'next/server'

const authenticateRequest = jest.fn()
let filters: Record<string, string> = {}
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => authenticateRequest(...args),
  createAuthFailureResponse: () => NextResponse.json({}, { status: 401 }),
  hasRequiredScope: () => true,
}))
jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  createApiResponse: (data: unknown, _meta?: unknown, status = 200) => NextResponse.json(data, { status }),
  createApiError: (error: string, status: number, _details?: unknown, code?: string) => NextResponse.json({ error, code }, { status }),
  withApiLogging: (handler: unknown) => handler,
  handleCorsPreflightRequest: jest.fn(),
  addCorsHeaders: (response: unknown) => response,
  parseMetaParams: () => ({}),
  parsePaginationParams: () => ({ page: 1, limit: 10, offset: 0 }),
  parseFilters: () => filters,
  createPaginationMeta: () => ({}),
  includeEntityMetadata: async (_t: string, rows: unknown) => rows,
  handleEntityMetadataInResponse: async (_t: string, entity: unknown) => entity,
  processEntityMetadata: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))

const queryWithRLS = jest.fn(async (_sql: string, _params: unknown[]) => [] as unknown[])
jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryWithRLS: (...args: [string, unknown[]]) => queryWithRLS(...args),
  mutateWithRLS: jest.fn(),
}))

import { GET } from '../../../src/routes/api/v1/users/route'

const get = async (query: string) => {
  const response = await GET(new NextRequest(`http://localhost/api/v1/users${query}`), undefined as never)
  return { status: response.status, body: await response.json() }
}
const listCall = () => queryWithRLS.mock.calls.find(([sql]) => sql.includes('LIMIT')) as [string, unknown[]]

beforeEach(() => {
  jest.clearAllMocks()
  filters = {}
  authenticateRequest.mockResolvedValue({ success: true, type: 'session', user: { id: 'sa', email: 'sa@x.test', role: 'superadmin' } })
})

describe('GET /api/v1/users — search', () => {
  it('finds users by email, name and first or last name', async () => {
    const { status } = await get('?search=ann%40&searchField=email')

    expect(status).toBe(200)
    const [sql, params] = listCall()
    expect(sql).toContain('("email" ILIKE $1 OR "name" ILIKE $1 OR "firstName" ILIKE $1 OR "lastName" ILIKE $1)')
    expect(params).toEqual(['%ann@%', 10, 0])
  })

  it('refuses a caller that is not an admin before it reads or searches anything', async () => {
    authenticateRequest.mockResolvedValue({ success: true, type: 'session', user: { id: 'm', email: 'm@x.test', role: 'member' } })

    const { status } = await get('?search=a&searchField=email')

    expect(status).toBe(403)
    expect(queryWithRLS).not.toHaveBeenCalled()
  })

  it('searches the same fields without searchField, and not at all for a blank term', async () => {
    await get('?search=Ann')
    expect(listCall()[1]).toEqual(['%Ann%', 10, 0])

    queryWithRLS.mockClear()
    await get('?search=%20%20&searchField=email')
    expect(listCall()[0]).not.toContain('ILIKE')
  })

  it('keeps the role filter beside the search, with its parameters in order', async () => {
    filters = { role: 'member' }

    const { status } = await get('?search=ann')

    expect(status).toBe(200)
    const [sql, params] = listCall()
    expect(sql).toContain('WHERE 1=1 AND role = $1 AND ("email" ILIKE $2 OR "name" ILIKE $2 OR "firstName" ILIKE $2 OR "lastName" ILIKE $2)')
    expect(params).toEqual(['member', '%ann%', 10, 0])
  })

  it.each(['password', 'role', 'emailVerified', `email", (SELECT 1) AS "x`])('refuses searchField=%s with 400 INVALID_SEARCH_FIELD and never queries', async (searchField) => {
    const { status, body } = await get(`?search=ann&searchField=${encodeURIComponent(searchField)}`)

    expect(status).toBe(400)
    expect(body.code).toBe('INVALID_SEARCH_FIELD')
    expect(queryWithRLS).not.toHaveBeenCalled()
  })
})
