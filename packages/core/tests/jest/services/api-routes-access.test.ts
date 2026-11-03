/**
 * #376: the API explorer lists only the enabled operations of an entity with a per-operation `access.api`.
 */

import { ApiRoutesService } from '@/core/lib/services/api-routes.service'

let mockApi: unknown = true

jest.mock('@nextsparkjs/registries/route-handlers', () => ({
  API_ROUTES_METADATA: {
    core: [],
    theme: [],
    plugins: [],
    entities: [
      { path: '/api/v1/pets', methods: ['GET', 'POST'], category: 'entity', source: 'pets' },
      { path: '/api/v1/pets/[id]', methods: ['GET', 'PATCH', 'DELETE'], category: 'entity', source: 'pets' },
      { path: '/api/v1/ghosts', methods: ['GET', 'POST'], category: 'entity', source: 'ghosts' },
    ],
  },
  API_ROUTES_SUMMARY: {},
}), { virtual: true })

jest.mock('@nextsparkjs/registries/entity-registry', () => ({
  ENTITY_REGISTRY: {
    get pets() { return { config: { slug: 'pets', access: { api: mockApi } } } },
  },
}), { virtual: true })

const routes = () => ApiRoutesService.getEntityRoutes().filter(route => route.source === 'pets')

describe('API explorer entity routes', () => {
  it('lists every method for true', () => {
    mockApi = true
    expect(routes().map(route => route.methods)).toEqual([['GET', 'POST'], ['GET', 'PATCH', 'DELETE']])
  })

  it('{ read: true } lists only GET', () => {
    mockApi = { read: true }
    expect(routes().map(route => route.methods)).toEqual([['GET'], ['GET']])
  })

  it('{} drops both routes', () => {
    mockApi = {}
    expect(routes()).toEqual([])
  })

  it('a route whose entity is not in the registry is not listed (fail-closed)', () => {
    mockApi = true
    expect(ApiRoutesService.getEntityRoutes().some(route => route.source === 'ghosts')).toBe(false)
  })
})
