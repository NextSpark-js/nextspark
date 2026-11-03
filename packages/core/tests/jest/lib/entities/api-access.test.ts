/**
 * #376: the one decision point for per-operation `access.api`, and what builds on it that needs no handler:
 * validation, the OpenAPI document and the MCP tools.
 */

import { isApiOperationEnabled, allowedMethods, apiAccessErrors } from '@/core/lib/entities/api-access'
import { generateOpenAPISpec } from '@/core/lib/entities/external-api-generator'
import { createMcpEngine } from '@/core/lib/mcp/engine'
import type { EntityConfig } from '@/core/lib/entities/types'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/core/lib/entities/registry', () => ({ getEntityConfig: jest.fn() }))
jest.mock('@/core/lib/entities/api-generator', () => ({ generateEntityAPI: jest.fn() }))
jest.mock('@/core/lib/rate-limit', () => ({ rateLimit: jest.fn() }))
jest.mock('@/core/lib/auth/api-keys', () => ({ validateAPIKey: jest.fn() }))

import { getEntityConfig } from '@/core/lib/entities/registry'

const entity = (api: unknown) => ({
  slug: 'pets', enabled: true, names: { singular: 'Pet', plural: 'Pets' },
  access: { public: false, api, metadata: false, shared: false },
  fields: [{ name: 'name', type: 'text', required: true, display: { label: 'Name' }, api: { readOnly: false } }],
}) as unknown as EntityConfig

describe('isApiOperationEnabled', () => {
  it.each([true, false, undefined])('%s serves every operation (false only closes API keys, #312)', api => {
    for (const op of ['read', 'create', 'update', 'delete'] as const) expect(isApiOperationEnabled(entity(api), op)).toBe(true)
  })

  it('an object serves only what it names; a missing key is false', () => {
    const config = entity({ read: true, update: false })
    expect(isApiOperationEnabled(config, 'read')).toBe(true)
    expect(isApiOperationEnabled(config, 'update')).toBe(false)
    expect(isApiOperationEnabled(config, 'create')).toBe(false)
    expect(isApiOperationEnabled(config, 'delete')).toBe(false)
  })

  it('allowedMethods follows the method-to-operation mapping', () => {
    expect(allowedMethods(entity({ read: true }), 'collection')).toEqual(['GET', 'OPTIONS'])
    expect(allowedMethods(entity({ read: true, create: true, delete: true }), 'collection')).toEqual(['GET', 'POST', 'OPTIONS'])
    expect(allowedMethods(entity({ read: true, update: true, delete: true }), 'item')).toEqual(['GET', 'PATCH', 'DELETE', 'OPTIONS'])
    expect(allowedMethods(entity({ read: true }), 'childItem')).toEqual(['OPTIONS'])
    expect(allowedMethods(entity({ update: true }), 'childItem')).toEqual(['PUT', 'DELETE', 'OPTIONS'])
  })
})

describe('apiAccessErrors', () => {
  it('accepts booleans and objects of the four operations', () => {
    expect(apiAccessErrors(true)).toEqual([])
    expect(apiAccessErrors(false)).toEqual([])
    expect(apiAccessErrors({ read: true, create: false, update: false, delete: false })).toEqual([])
    expect(apiAccessErrors({})).toEqual([])
  })

  it('rejects an unknown key with a clear message', () => {
    expect(apiAccessErrors({ read: true, write: false })).toEqual(['access.api has an unknown operation "write" (use read, create, update, delete)'])
  })

  it('rejects a non-boolean value and a non-object', () => {
    expect(apiAccessErrors({ read: 'yes' })).toEqual(['access.api.read must be a boolean'])
    expect(apiAccessErrors('all')).toHaveLength(1)
    expect(apiAccessErrors(null)).toHaveLength(1)
    expect(apiAccessErrors([])).toHaveLength(1)
  })
})

describe('OpenAPI document', () => {
  const pathsFor = (api: unknown) => {
    ;(getEntityConfig as jest.Mock).mockReturnValue(entity(api))
    return generateOpenAPISpec('pets').paths as Record<string, Record<string, unknown>>
  }

  it('lists every operation for true', () => {
    const paths = pathsFor(true)
    expect(Object.keys(paths['/api/v1/pets']).sort()).toEqual(['get', 'post'])
    expect(Object.keys(paths['/api/v1/pets/{id}']).sort()).toEqual(['delete', 'get', 'patch'])
  })

  it('a read-only entity has no write paths', () => {
    const paths = pathsFor({ read: true })
    expect(Object.keys(paths['/api/v1/pets'])).toEqual(['get'])
    expect(Object.keys(paths['/api/v1/pets/{id}'])).toEqual(['get'])
  })

  it('an entity with nothing enabled has no paths', () => {
    expect(pathsFor({})).toEqual({})
  })
})

describe('MCP tools', () => {
  const toolNames = (api: unknown) => {
    const engine = createMcpEngine({ pets: entity(api) }, { toolPrefix: 'app', executor: jest.fn() })
    return engine.tools.map(tool => tool.name).sort()
  }

  it('registers only the operations the entity enables', () => {
    const all = toolNames(true)
    expect(all).toHaveLength(5)
    const readOnly = toolNames({ read: true })
    expect(readOnly).toHaveLength(2)
    expect(readOnly.every(name => /list|get/.test(name))).toBe(true)
  })
})
