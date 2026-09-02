/**
 * Regression coverage for #105: requests to the generic entity routes were
 * never written to `api_audit_log`, for either auth type. Every exported
 * handler now records one row per authenticated request (API key or session)
 * with endpoint, method, status and timing — fire-and-forget, so an audit
 * failure never alters the response.
 */

import { harness, makeRequest, listUrl, API_KEY_AUTH, SESSION_AUTH, flushPromises } from './__helpers__/generic-handler-harness'
import {
  handleGenericList,
  handleGenericCreate,
  handleGenericRead,
  handleGenericUpdate,
  handleGenericDelete,
} from '@/core/lib/api/entity/generic-handler'

const { mocks } = harness

type Res = { status: number }
const TEAM_HEADERS = { 'x-team-id': 'team-1', 'user-agent': 'jest-agent/1.0', 'x-forwarded-for': '203.0.113.7' }

function auditCalls(): Array<[string, unknown[], string]> {
  return mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => sql.includes('INSERT INTO "api_audit_log"')) as Array<[string, unknown[], string]>
}

/** Route entity writes to a canned row; audit inserts resolve to nothing. */
function routeMutate(entityRow: Record<string, unknown> = { id: 'pet-1', name: 'Rex' }) {
  mocks.mutateWithRLS.mockImplementation(async (sql: string) => {
    if (sql.includes('INSERT INTO "api_audit_log"')) return undefined
    return { rows: [entityRow] }
  })
}

beforeEach(() => {
  harness.reset()
  routeMutate()
})

describe('generic handlers — #105 audit logging', () => {
  it('logs an API-key LIST with the key id, owner, endpoint, method, status and timing', async () => {
    mocks.authenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:read']))

    const response = await handleGenericList(makeRequest({ url: listUrl({ limit: '5' }), headers: TEAM_HEADERS })) as unknown as Res
    await flushPromises()

    expect(response.status).toBe(200)
    expect(auditCalls()).toHaveLength(1)
    const [, params, rlsUserId] = auditCalls()[0]
    expect(params.slice(0, 7)).toEqual(['key-1', 'key-owner-1', '/api/v1/pets', 'GET', 200, '203.0.113.7', 'jest-agent/1.0'])
    expect(params[7]).toBeNull() // request body is never stored
    expect(typeof params[8]).toBe('number') // responseTime
    expect(rlsUserId).toBe('key-owner-1')
  })

  it('logs a session LIST with a NULL apiKeyId', async () => {
    mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())

    await handleGenericList(makeRequest({ headers: TEAM_HEADERS }))
    await flushPromises()

    expect(auditCalls()).toHaveLength(1)
    const [, params] = auditCalls()[0]
    expect(params[0]).toBeNull()
    expect(params[1]).toBe('session-user-1')
  })

  it('logs denied requests with their real status (403 from the team-role permission gate)', async () => {
    mocks.authenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:read']))
    mocks.checkPermission.mockResolvedValue(false)

    const response = await handleGenericList(makeRequest({ headers: TEAM_HEADERS })) as unknown as Res
    await flushPromises()

    expect(response.status).toBe(403)
    expect(auditCalls()).toHaveLength(1)
    expect(auditCalls()[0][1][4]).toBe(403)
  })

  it('does not log unauthenticated requests (nothing to attribute the row to)', async () => {
    mocks.authenticateRequest.mockResolvedValue({ success: false, type: 'none', user: null })

    const response = await handleGenericList(makeRequest({ headers: TEAM_HEADERS })) as unknown as Res
    await flushPromises()

    expect(response.status).toBe(401)
    expect(auditCalls()).toHaveLength(0)
  })

  it('covers CREATE, READ, UPDATE and DELETE with the right method and path', async () => {
    mocks.authenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:read', 'pets:write', 'pets:delete']))
    mocks.queryWithRLS.mockResolvedValue([{ id: 'pet-1', name: 'Rex' }])
    const ctx = { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) }

    await handleGenericCreate(makeRequest({ method: 'POST', url: 'http://localhost/api/v1/pets', headers: TEAM_HEADERS, body: { name: 'Rex' } }))
    await handleGenericRead(makeRequest({ method: 'GET', url: 'http://localhost/api/v1/pets/pet-1', headers: TEAM_HEADERS }), ctx)
    await handleGenericUpdate(makeRequest({ method: 'PATCH', url: 'http://localhost/api/v1/pets/pet-1', headers: TEAM_HEADERS, body: { name: 'Rex 2' } }), ctx)
    await handleGenericDelete(makeRequest({ method: 'DELETE', url: 'http://localhost/api/v1/pets/pet-1', headers: TEAM_HEADERS }), ctx)
    await flushPromises()

    const rows = auditCalls().map(([, params]) => [params[3], params[2], params[4]])
    expect(rows).toEqual([
      ['POST', '/api/v1/pets', 201],
      ['GET', '/api/v1/pets/pet-1', 200],
      ['PATCH', '/api/v1/pets/pet-1', 200],
      ['DELETE', '/api/v1/pets/pet-1', 200],
    ])
  })

  it('never lets an audit write failure change the response', async () => {
    mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
    mocks.mutateWithRLS.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO "api_audit_log"')) throw new Error('audit table unavailable')
      return { rows: [{ id: 'pet-1' }] }
    })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await handleGenericList(makeRequest({ headers: TEAM_HEADERS })) as unknown as Res
    await flushPromises()

    expect(response.status).toBe(200)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('api_audit_log'), expect.any(Error))
    errorSpy.mockRestore()
  })

  it('logs a 500 when the handler itself blows up after authentication', async () => {
    mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
    mocks.queryWithRLS.mockRejectedValue(new Error('connection reset'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const response = await handleGenericList(makeRequest({ headers: TEAM_HEADERS })) as unknown as Res
    await flushPromises()

    expect(response.status).toBe(500)
    expect(auditCalls()).toHaveLength(1)
    expect(auditCalls()[0][1][4]).toBe(500)
    errorSpy.mockRestore()
  })
})
