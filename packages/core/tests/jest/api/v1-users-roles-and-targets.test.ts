/**
 * /api/v1/users and /api/v1/users/:id follow the superadmin users route:
 * - the only roles assigned are member and developer, and only a developer grants developer;
 * - nobody changes or deletes another superadmin, nobody changes their own role, and a suspended user is restored
 *   only through unsuspend.
 */
import { NextRequest, NextResponse } from 'next/server'

const authenticateRequest = jest.fn()
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => authenticateRequest(...args),
  createAuthFailureResponse: () => NextResponse.json({}, { status: 401 }),
  hasRequiredScope: () => true,
}))
jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  createApiResponse: (data: unknown, _meta?: unknown, status = 200) => NextResponse.json(data, { status }),
  createApiError: (error: string, status: number) => NextResponse.json({ error }, { status }),
  withApiLogging: (handler: unknown) => handler,
  handleCorsPreflightRequest: jest.fn(),
  addCorsHeaders: (response: unknown) => response,
  parseMetaParams: () => ({}),
  includeEntityMetadataForSingle: async (_t: string, entity: unknown) => entity,
  handleEntityMetadataInResponse: async (_t: string, entity: unknown) => entity,
  processEntityMetadata: jest.fn(),
  parsePaginationParams: () => ({ page: 1, limit: 10, offset: 0 }),
  parseFilters: () => ({}),
  createPaginationMeta: () => ({}),
  includeEntityMetadata: async (_t: string, rows: unknown) => rows,
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))

const USERS: Record<string, string> = { sa: 'superadmin', sa2: 'superadmin', dev: 'developer', dev2: 'developer', mem: 'member', mem2: 'member', sus: 'suspended' }
const queryOneWithRLS = jest.fn(async (_sql: string, [id]: string[]) => (USERS[id] ? { id, email: `${id}@x`, role: USERS[id] } : null))
const queryWithRLS = jest.fn(async () => [])
const mutateWithRLS = jest.fn(async (_sql: string, values: unknown[]) => ({ rows: [{ id: values[values.length - 1] }] }))
jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryOneWithRLS: (...args: [string, string[]]) => queryOneWithRLS(...args),
  queryWithRLS: (...args: []) => queryWithRLS(...args),
  mutateWithRLS: (...args: [string, unknown[]]) => mutateWithRLS(...args),
}))

import { PATCH, DELETE } from '../../../src/routes/api/v1/users/[id]/route'
import { POST } from '../../../src/routes/api/v1/users/route'

function as(id: string) {
  authenticateRequest.mockResolvedValue({ success: true, type: 'session', user: { id, email: `${id}@x`, role: USERS[id] } })
}
const patch = async (target: string, body: Record<string, unknown>) =>
  (await PATCH(new NextRequest(`http://localhost/api/v1/users/${target}`, { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: target }) } as never)).status
const del = async (target: string) =>
  (await DELETE(new NextRequest(`http://localhost/api/v1/users/${target}`, { method: 'DELETE' }), { params: Promise.resolve({ id: target }) } as never)).status
const create = async (body: Record<string, unknown>) =>
  (await POST(new NextRequest('http://localhost/api/v1/users', { method: 'POST', body: JSON.stringify({ email: 'n@x.test', firstName: 'N', lastName: 'N', country: 'AR', ...body }) }), undefined as never)).status
const roleWrites = () => mutateWithRLS.mock.calls.filter(([sql]) => /UPDATE "users"[\s\S]*role = /.test(sql))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('PATCH /api/v1/users/:id, the role', () => {
  it('only a developer grants the developer role', async () => {
    as('sa')
    expect(await patch('mem', { role: 'developer' })).toBe(403)
    expect(roleWrites()).toHaveLength(0)
    as('dev')
    expect(await patch('mem', { role: 'developer' })).toBe(200)
    expect(roleWrites()).toHaveLength(1)
  })

  it.each(['sa', 'dev'])('%s assigns member, and never superadmin or suspended', async (actor) => {
    as(actor)
    expect(await patch('mem2', { role: 'member' })).toBe(200)
    expect(await patch('mem2', { role: 'superadmin' })).toBe(400)
    expect(await patch('mem2', { role: 'suspended' })).toBe(400)
  })

  it.each(['sa', 'dev'])('%s does not change their own role, nor a suspended user\'s', async (actor) => {
    as(actor)
    expect(await patch(actor, { role: 'member' })).toBe(400)
    expect(await patch('sus', { role: 'member' })).toBe(400)
    expect(roleWrites()).toHaveLength(0)
  })

  it('a member changes no role, their own included', async () => {
    as('mem')
    expect(await patch('mem', { role: 'developer' })).toBe(403)
    expect(await patch('mem', { firstName: 'Me' })).toBe(200)
  })
})

describe('superadmin targets, as on the superadmin route', () => {
  it.each(['sa', 'dev'])('%s neither changes nor deletes another superadmin', async (actor) => {
    as(actor)
    const target = actor === 'sa' ? 'sa2' : 'sa'
    expect(await patch(target, { firstName: 'X' })).toBe(403)
    expect(await del(target)).toBe(403)
    expect(mutateWithRLS).not.toHaveBeenCalled()
  })

  it.each(['sa', 'dev'])('%s changes and deletes a developer or a member, as the superadmin route allows', async (actor) => {
    as(actor)
    expect(await patch('dev2', { firstName: 'X' })).toBe(200)
    expect(await del('dev2')).toBe(200)
    expect(await del('mem2')).toBe(200)
  })

  it('a member deletes nobody', async () => {
    as('mem')
    expect(await del('mem2')).toBe(403)
  })
})

describe('POST /api/v1/users, the role', () => {
  it('creates a member by default; only a developer creates a developer; nobody creates a superadmin', async () => {
    as('sa')
    expect(await create({})).toBe(201)
    expect(await create({ role: 'developer' })).toBe(403)
    expect(await create({ role: 'superadmin' })).toBe(400)
    as('dev')
    expect(await create({ role: 'developer' })).toBe(201)
    expect(await create({ role: 'superadmin' })).toBe(400)
  })
})
