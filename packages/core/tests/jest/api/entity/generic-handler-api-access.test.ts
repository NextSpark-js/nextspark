/**
 * #312: `access.api: false` closes the generic REST handler to API-key requests
 * (every method and the child routes) with the same 404 as a slug that does not exist,
 * while session requests keep working. `true` / unset serve both.
 */

import { harness, makeRequest, listUrl, API_KEY_AUTH, SESSION_AUTH, PETS_ENTITY } from './__helpers__/generic-handler-harness'
import {
  handleGenericList, handleGenericRead, handleGenericCreate, handleGenericUpdate, handleGenericDelete,
  handleChildList, handleChildCreate, handleChildUpdate, handleChildDelete,
} from '@/core/lib/api/entity/generic-handler'
import { setEntityRegistry } from '@/core/lib/entities/queries'
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'
import type { EntityConfig } from '@/core/lib/entities/types'

jest.mock('@nextsparkjs/registries/entity-registry', () => ({
  ENTITY_REGISTRY: {
    pets: { name: 'pets', config: {}, tableName: 'pets', parent: null, children: ['visits'], depth: 0 },
    visits: {
      name: 'visits', tableName: 'pets_visits', parent: 'pets', children: [], depth: 1,
      config: { table: 'visits', fields: [{ name: 'note', type: 'text', required: false }, { name: 'parentId', type: 'text', required: true }] },
    },
  },
  ENTITY_METADATA: {},
}), { virtual: true })

const { mocks } = harness
type Res = { status: number; headers?: unknown; body: { success: boolean; error?: string; code?: string } }

const ID = '3f2b8c1e-5d4a-4b7e-9c10-2a6f8d1e4b90'
const CHILD_ID = '9a1c7e22-0b3d-4f6a-8e55-1d2c3b4a5f60'
const HEADERS = { 'x-team-id': 'team-1' }
const params = Promise.resolve({ entity: 'pets', id: ID, childType: 'visits', childId: CHILD_ID })
const req = (method: string, path: string) => makeRequest({ method, url: `http://localhost/api/v1/${path}`, headers: HEADERS, body: { name: 'Rex', note: 'checkup' } })

const calls: Record<string, () => Promise<unknown>> = {
  'GET list': () => handleGenericList(makeRequest({ url: listUrl({}), headers: HEADERS })),
  'GET read': () => handleGenericRead(req('GET', `pets/${ID}`), { params }),
  'POST': () => handleGenericCreate(req('POST', 'pets')),
  'PATCH': () => handleGenericUpdate(req('PATCH', `pets/${ID}`), { params }),
  'DELETE': () => handleGenericDelete(req('DELETE', `pets/${ID}`), { params }),
  'child GET': () => handleChildList(req('GET', `pets/${ID}/child/visits`), { params }),
  'child POST': () => handleChildCreate(req('POST', `pets/${ID}/child/visits`), { params }),
  'child PUT': () => handleChildUpdate(req('PUT', `pets/${ID}/child/visits/${CHILD_ID}`), { params }),
  'child DELETE': () => handleChildDelete(req('DELETE', `pets/${ID}/child/visits/${CHILD_ID}`), { params }),
}

const SCOPES = ['pets:read', 'pets:write', 'pets:delete']
const withAccess = (access: Record<string, unknown> | undefined) => ({ ...PETS_ENTITY, access }) as unknown as EntityConfig

function setup(entity: EntityConfig | null, auth: unknown) {
  mocks.resolveEntityFromUrl.mockResolvedValue(
    entity ? { isValidEntity: true, entityConfig: entity, entityName: 'pets' } : { isValidEntity: false, entityConfig: null, entityName: 'pets' }
  )
  mocks.authenticateRequest.mockResolvedValue(auth)
}

/** The same answer a slug that does not exist gets, for the same handler. */
async function missing(name: string) {
  setup(null, SESSION_AUTH())
  return (await calls[name]()) as Res
}

// the success status each call must answer when served
const OK: Record<string, number> = { 'GET list': 200, 'GET read': 200, 'POST': 201, 'PATCH': 200, 'DELETE': 200, 'child GET': 200, 'child POST': 200, 'child PUT': 200, 'child DELETE': 200 }

beforeEach(() => {
  harness.reset()
  mocks.queryWithRLS.mockResolvedValue([{ id: ID, name: 'Rex', userId: 'session-user-1', teamId: 'team-1' }])
  mocks.queryOneWithRLS.mockResolvedValue({ id: ID, name: 'Rex', userId: 'session-user-1', teamId: 'team-1' })
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: ID, name: 'Rex' }] })
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  // the child routes find `visits` through the registry the route files set
  setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)
})

describe.each(Object.keys(calls))('access.api — %s', name => {
  it('false: an API-key request gets exactly the answer a missing slug gets, and never reaches the data layer', async () => {
    const expected = await missing(name)
    harness.reset()
    setup(withAccess({ api: false }), API_KEY_AUTH(SCOPES))
    const res = (await calls[name]()) as Res
    expect(res.status).toBe(404)
    expect(res.body).toEqual(expected.body)
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
    const writes = mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => !sql.includes('api_audit_log'))
    expect(writes).toHaveLength(0)
  })

  it('false: a key rejected for scope or rate limit gets the same 404, not a 403', async () => {
    const expected = await missing(name)
    harness.reset()
    setup(withAccess({ api: false }), { success: false, type: 'api-key', user: null, error: 'Insufficient scope', code: 'INSUFFICIENT_SCOPE', statusCode: 403 })
    const res = (await calls[name]()) as Res
    expect(res.status).toBe(404)
    expect(res.body).toEqual(expected.body)
  })

  it('false: a session request is served', async () => {
    setup(withAccess({ api: false }), SESSION_AUTH())
    const res = (await calls[name]()) as Res
    expect(res.body.error).not.toBe('Entity not found')
    if (OK[name]) expect(res.status).toBe(OK[name])
  })

  it.each([['true', { api: true }], ['unset', undefined], ['without the flag', {}]])('%s: API key and session are both served', async (_label, access) => {
    for (const auth of [API_KEY_AUTH(SCOPES), SESSION_AUTH()]) {
      setup(withAccess(access), auth)
      const res = (await calls[name]()) as Res
      expect(res.body.error).not.toBe('Entity not found')
      if (OK[name]) expect(res.status).toBe(OK[name])
    }
  })

  it('enabled: false: the operation is refused (405) for both API key and session', async () => {
    const real = jest.requireActual('@/core/lib/api/entity/resolver') as typeof import('@/core/lib/api/entity/resolver')
    mocks.validateEntityOperation.mockImplementation(real.validateEntityOperation)
    for (const auth of [API_KEY_AUTH(SCOPES), SESSION_AUTH()]) {
      setup({ ...withAccess({ api: true }), enabled: false } as EntityConfig, auth)
      const res = (await calls[name]()) as Res
      // child routes resolve the parent only, so a disabled parent is not refused there
      if (!name.startsWith('child')) {
        expect(res.status).toBe(405)
        expect(res.body.error).toMatch(/operation not supported for this entity/)
      }
    }
  })

  it('a slug that does not exist: 404 for both API key and session', async () => {
    for (const auth of [API_KEY_AUTH(SCOPES), SESSION_AUTH()]) {
      setup(null, auth)
      const res = (await calls[name]()) as Res
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Entity not found')
    }
  })
})

it('child routes: a closed parent hides an invalid childType from an API key', async () => {
  setup(withAccess({ api: false }), API_KEY_AUTH(SCOPES))
  const res = (await handleChildList(req('GET', `pets/${ID}/child/nope`), { params: Promise.resolve({ entity: 'pets', id: ID, childType: 'nope' }) })) as unknown as Res
  expect(res.status).toBe(404)
  expect(res.body.error).toBe('Entity not found')
})
