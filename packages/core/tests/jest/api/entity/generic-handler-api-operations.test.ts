/**
 * #376: `access.api` as an object serves only the generic operations it enables. A disabled operation
 * answers 405 with an `Allow` header listing the enabled methods, the same for a session and an API key,
 * before the data layer is touched. `true` / `false` keep their meaning (see generic-handler-api-access).
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
type Res = { status: number; headers: Headers; body: { success: boolean; error?: string } }

const ID = '3f2b8c1e-5d4a-4b7e-9c10-2a6f8d1e4b90'
const CHILD_ID = '9a1c7e22-0b3d-4f6a-8e55-1d2c3b4a5f60'
const HEADERS = { 'x-team-id': 'team-1' }
const params = Promise.resolve({ entity: 'pets', id: ID, childType: 'visits', childId: CHILD_ID })
const req = (method: string, path: string) => makeRequest({ method, url: `http://localhost/api/v1/${path}`, headers: HEADERS, body: { name: 'Rex', note: 'checkup' } })

// call -> [operation it needs, success status]
const calls: Record<string, [() => Promise<unknown>, string, number]> = {
  'GET list': [() => handleGenericList(makeRequest({ url: listUrl({}), headers: HEADERS })), 'read', 200],
  'GET read': [() => handleGenericRead(req('GET', `pets/${ID}`), { params }), 'read', 200],
  'POST': [() => handleGenericCreate(req('POST', 'pets')), 'create', 201],
  'PATCH': [() => handleGenericUpdate(req('PATCH', `pets/${ID}`), { params }), 'update', 200],
  'DELETE': [() => handleGenericDelete(req('DELETE', `pets/${ID}`), { params }), 'delete', 200],
  'child GET': [() => handleChildList(req('GET', `pets/${ID}/child/visits`), { params }), 'read', 200],
  'child POST': [() => handleChildCreate(req('POST', `pets/${ID}/child/visits`), { params }), 'update', 200],
  'child PUT': [() => handleChildUpdate(req('PUT', `pets/${ID}/child/visits/${CHILD_ID}`), { params }), 'update', 200],
  'child DELETE': [() => handleChildDelete(req('DELETE', `pets/${ID}/child/visits/${CHILD_ID}`), { params }), 'update', 200],
}
// the Allow header each route answers for `{ read: true }`
const ALLOW_READ_ONLY: Record<string, string> = {
  'GET list': 'GET, OPTIONS', 'POST': 'GET, OPTIONS',
  'GET read': 'GET, OPTIONS', 'PATCH': 'GET, OPTIONS', 'DELETE': 'GET, OPTIONS',
  'child GET': 'GET, OPTIONS', 'child POST': 'GET, OPTIONS', 'child PUT': 'OPTIONS', 'child DELETE': 'OPTIONS',
}

const SCOPES = ['pets:read', 'pets:write', 'pets:delete']
const withApi = (api: unknown) => ({ ...PETS_ENTITY, access: { api } }) as unknown as EntityConfig

function setup(entity: EntityConfig, auth: unknown) {
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: entity, entityName: 'pets' })
  mocks.authenticateRequest.mockResolvedValue(auth)
}

beforeEach(() => {
  harness.reset()
  mocks.queryWithRLS.mockResolvedValue([{ id: ID, name: 'Rex', userId: 'session-user-1', teamId: 'team-1' }])
  mocks.queryOneWithRLS.mockResolvedValue({ id: ID, name: 'Rex', userId: 'session-user-1', teamId: 'team-1' })
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: ID, name: 'Rex' }] })
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)
})

describe.each(Object.keys(calls))('access.api { read: true } — %s', name => {
  const [call, operation, ok] = calls[name]
  const readOnly = { read: true }

  it.each([['session', () => SESSION_AUTH()], ['API key', () => API_KEY_AUTH(SCOPES)]])('%s: %s', async (_label, auth) => {
    setup(withApi(readOnly), auth())
    const res = (await call()) as Res
    if (operation === 'read') {
      expect(res.status).toBe(ok)
      return
    }
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toBe(ALLOW_READ_ONLY[name])
    // refused before authentication, the body and the data layer
    expect(mocks.authenticateRequest).not.toHaveBeenCalled()
    expect(mocks.queryWithRLS).not.toHaveBeenCalled()
    expect(mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => !sql.includes('api_audit_log'))).toHaveLength(0)
  })

  it('a missing key is false (fail-closed): {} refuses everything', async () => {
    setup(withApi({}), SESSION_AUTH())
    expect(((await call()) as Res).status).toBe(405)
  })

  it('enabling the needed operation serves it', async () => {
    setup(withApi({ [operation]: true }), SESSION_AUTH())
    expect(((await call()) as Res).status).toBe(ok)
  })

  it.each([['true', true], ['unset', undefined]])('%s serves the operation as before', async (_label, api) => {
    setup(withApi(api), SESSION_AUTH())
    expect(((await call()) as Res).status).toBe(ok)
  })
})

it('Allow lists every method the route still serves', async () => {
  setup(withApi({ read: true, update: true }), SESSION_AUTH())
  const res = (await handleGenericCreate(req('POST', 'pets'))) as unknown as Res
  expect(res.status).toBe(405)
  expect(res.headers.get('Allow')).toBe('GET, OPTIONS')
  const item = (await handleGenericDelete(req('DELETE', `pets/${ID}`), { params })) as unknown as Res
  expect(item.status).toBe(405)
  expect(item.headers.get('Allow')).toBe('GET, PATCH, OPTIONS')
})
