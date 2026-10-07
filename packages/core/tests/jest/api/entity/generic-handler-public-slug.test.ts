/**
 * #215: the generic create and update handlers refuse an invalid or reserved slug of a public entity with a
 * 400 VALIDATION_ERROR that names the `slug` field (not a database constraint error), and accept a valid one.
 * Uses the real schema generator through the harness mock.
 */

import { harness, makeRequest, SESSION_AUTH } from './__helpers__/generic-handler-harness'
import { handleGenericCreate, handleGenericUpdate } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness

type Res = { status: number; body: { success: boolean; code?: string; error?: string; details?: Array<{ path: string[]; message: string }> } }
const TEAM_HEADERS = { 'x-team-id': 'team-1' }

const field = (name: string, required: boolean) => ({
  name,
  type: 'text',
  required,
  display: { label: name, description: '', showInList: true, showInDetail: true, showInForm: true, order: 1 },
  validation: {},
  api: { searchable: false, sortable: false, readOnly: false },
})

const entity = (name: string, access: Record<string, unknown>) =>
  ({ slug: name, tableName: name, access: { api: true, ...access }, fields: [field('title', true), field('slug', true)] }) as unknown as EntityConfig

function use(config: EntityConfig) {
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: config, entityName: config.slug })
}

const post = (name: string, body: Record<string, unknown>) =>
  handleGenericCreate(
    makeRequest({ method: 'POST', url: `http://localhost/api/v1/${name}`, headers: TEAM_HEADERS, body }),
    { params: Promise.resolve({ entity: name }) }
  ) as unknown as Promise<Res>

const patch = (name: string, body: Record<string, unknown>) =>
  handleGenericUpdate(
    makeRequest({ method: 'PATCH', url: `http://localhost/api/v1/${name}/row-1`, headers: TEAM_HEADERS, body }),
    { params: Promise.resolve({ entity: name, id: 'row-1' }) }
  ) as unknown as Promise<Res>

// The entity's own writes, not the audit-log row every request leaves (#105)
const writes = (verb: 'INSERT' | 'UPDATE') =>
  mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => sql.trimStart().startsWith(verb) && !sql.includes('api_audit_log'))

beforeEach(() => {
  harness.reset()
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  const { generateEntitySchemas } = jest.requireActual('@/core/lib/entities/schema-generator') as typeof import('@/core/lib/entities/schema-generator')
  mocks.generateEntitySchemas.mockImplementation(generateEntitySchemas)
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'row-1', title: 'T', slug: 'about' }] })
})

describe.each([
  ['pages (root)', 'pages', { public: true, basePath: '/' }],
  ['posts (/blog)', 'posts', { public: true, basePath: '/blog' }],
  ['a custom public entity', 'events', { public: true }],
])('%s', (_label, name, access) => {
  beforeEach(() => use(entity(name, access)))

  it.each([
    ['create', (slug: string) => post(name, { title: 'T', slug })],
    ['update', (slug: string) => patch(name, { slug })],
  ])('%s: an invalid slug is a 400 on the slug field and nothing is written', async (_verb, write) => {
    const response = await write('Not A Slug!')

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('VALIDATION_ERROR')
    expect(response.body.details?.[0].path).toEqual(['slug'])
    expect(response.body.error).toMatch(/Slug/)
    expect(writes('INSERT')).toHaveLength(0)
    expect(writes('UPDATE')).toHaveLength(0)
  })

  it('a dotted slug is refused like any other character outside the format', async () => {
    const response = await post(name, { title: 'T', slug: 'v1.2' })
    expect(response.status).toBe(400)
    expect(response.body.details?.[0].path).toEqual(['slug'])
  })
})

describe('reserved slugs', () => {
  it('are refused for a root entity, on create and on update', async () => {
    use(entity('pages', { public: true, basePath: '/' }))
    for (const response of [await post('pages', { title: 'T', slug: 'dashboard' }), await patch('pages', { slug: 'api' })]) {
      expect(response.status).toBe(400)
      expect(response.body.details?.[0]).toMatchObject({ path: ['slug'], message: expect.stringContaining('reserved') })
    }
  })

  it('do not apply below /blog', async () => {
    use(entity('posts', { public: true, basePath: '/blog' }))
    expect((await post('posts', { title: 'T', slug: 'dashboard' })).status).toBe(201)
  })
})

describe('a slug that is not changing (rows written before the rule)', () => {
  beforeEach(() => use(entity('pages', { public: true, basePath: '/' })))

  it.each(['a', 'home-', 'about--us'])('PATCH resending the stored invalid slug %j is let through', async slug => {
    mocks.queryWithRLS.mockResolvedValue([{ slug }])
    const response = await patch('pages', { title: 'Edited', slug })
    expect(response.status).toBe(200)
    expect(writes('UPDATE')).toHaveLength(1)
  })

  it('PATCH changing it to another invalid slug is a 400 on the slug field', async () => {
    mocks.queryWithRLS.mockResolvedValue([{ slug: 'a' }])
    const response = await patch('pages', { slug: 'Not Valid' })
    expect(response.status).toBe(400)
    expect(response.body.details?.[0].path).toEqual(['slug'])
    expect(writes('UPDATE')).toHaveLength(0)
  })

  it('create has no stored slug: an invalid one is refused', async () => {
    expect((await post('pages', { title: 'T', slug: 'a' })).status).toBe(400)
  })
})

describe('valid slugs', () => {
  it('are created and updated', async () => {
    use(entity('pages', { public: true, basePath: '/' }))
    expect((await post('pages', { title: 'T', slug: 'about-us' })).status).toBe(201)
    expect((await patch('pages', { slug: 'about-us' })).status).toBe(200)
  })

  it('an update that leaves the slug alone is not judged', async () => {
    use(entity('pages', { public: true, basePath: '/' }))
    expect((await patch('pages', { title: 'Renamed' })).status).toBe(200)
  })

  it('an entity whose slug is not public keeps accepting free text', async () => {
    use(entity('internal', { public: false }))
    expect((await post('internal', { title: 'T', slug: 'Free Text' })).status).toBe(201)
  })
})
