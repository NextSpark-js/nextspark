/**
 * Regression coverage for #118: `handleGenericCreate` only fired
 * `afterEntityCreate` (after the INSERT) and never invoked
 * `beforeEntityCreate`, so plugins had no supported pre-write extension point
 * on the generic POST route — the `entity.<slug>.before_create` filter could
 * neither reject nor reshape a payload before it was persisted.
 */

import { harness, makeRequest, SESSION_AUTH } from './__helpers__/generic-handler-harness'
import { handleGenericCreate } from '@/core/lib/api/entity/generic-handler'

const { mocks } = harness

type Res = { status: number; body: { code?: string; error?: string; data?: unknown } }

/** No INSERT into the entity table (audit-log INSERTs from #105 don't count). */
function expectNoEntityWrite() {
  const entityWrites = mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => !sql.includes('api_audit_log'))
  expect(entityWrites).toHaveLength(0)
}

function createRequest(body: Record<string, unknown>) {
  return makeRequest({
    method: 'POST',
    url: 'http://localhost/api/v1/pets',
    headers: { 'x-team-id': 'team-1' },
    body,
  })
}

beforeEach(() => {
  harness.reset()
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  // INSERT ... RETURNING * → then the SELECT that re-reads the created row
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'pet-new' }] })
  mocks.queryWithRLS.mockResolvedValue([{ id: 'pet-new', name: 'Rex' }])
})

describe('handleGenericCreate — #118 beforeEntityCreate hook', () => {
  it('invokes beforeEntityCreate with the validated payload BEFORE the INSERT runs', async () => {
    const response = await handleGenericCreate(createRequest({ name: 'Rex', status: 'draft' })) as unknown as Res

    expect(response.status).toBe(201)
    expect(mocks.beforeEntityCreate).toHaveBeenCalledTimes(1)
    const [slug, data, userId] = mocks.beforeEntityCreate.mock.calls[0] as [string, Record<string, unknown>, string]
    expect(slug).toBe('pets')
    expect(data).toMatchObject({ name: 'Rex', status: 'draft' })
    expect(userId).toBe('session-user-1')

    // Ordering: the hook must run before the write hits the database.
    const hookOrder = mocks.beforeEntityCreate.mock.invocationCallOrder[0]
    const insertOrder = mocks.mutateWithRLS.mock.invocationCallOrder[0]
    expect(hookOrder).toBeLessThan(insertOrder)
  })

  it('persists the payload returned by the hook, not the original one', async () => {
    mocks.beforeEntityCreate.mockImplementation(async (_slug: string, data: Record<string, unknown>) => ({
      ...data,
      name: `${String(data.name)} (normalized)`,
    }))

    await handleGenericCreate(createRequest({ name: 'Rex' }))

    const insertCall = mocks.mutateWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('INSERT INTO "pets"'))
    expect(insertCall).toBeDefined()
    const [, values] = insertCall as [string, unknown[]]
    expect(values).toContain('Rex (normalized)')
    expect(values).not.toContain('Rex')
  })

  it('rejects the create (no INSERT) when the hook throws, surfacing the reason as a 4xx', async () => {
    mocks.beforeEntityCreate.mockRejectedValue(new Error('ownerId does not belong to this team'))

    const response = await handleGenericCreate(createRequest({ name: 'Rex', ownerId: 'someone-else' })) as unknown as Res

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('BEFORE_CREATE_REJECTED')
    expect(response.body.error).toContain('ownerId does not belong to this team')
    expectNoEntityWrite()
    expect(mocks.afterEntityCreate).not.toHaveBeenCalled()
  })

  it('lets the hook pick the status code by throwing an error that carries one', async () => {
    const forbidden = Object.assign(new Error('not yours'), { status: 403 })
    mocks.beforeEntityCreate.mockRejectedValue(forbidden)

    const response = await handleGenericCreate(createRequest({ name: 'Rex' })) as unknown as Res

    expect(response.status).toBe(403)
    expect(response.body.code).toBe('BEFORE_CREATE_REJECTED')
    expectNoEntityWrite()
  })

  it('still fires afterEntityCreate once the row is written', async () => {
    await handleGenericCreate(createRequest({ name: 'Rex' }))

    expect(mocks.afterEntityCreate).toHaveBeenCalledTimes(1)
    expect(mocks.beforeEntityCreate.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.afterEntityCreate.mock.invocationCallOrder[0])
  })
})
