/**
 * POST /api/v1/blocks/validate (core route, #203) validates a block's props with the
 * schema the generated registry imports statically (BLOCK_SCHEMAS, by slug). It used to
 * `import(block.schemaPath)` at runtime: that path is a project alias
 * (`@/blocks/<slug>/schema`) Node cannot resolve in a production build, so every
 * validation answered 500. Here the registry entry keeps such an unresolvable
 * schemaPath: the route passes only if it never loads anything by that path.
 */
import { NextRequest } from 'next/server'
import { schema as heroSchema } from '../../../../../apps/dev/blocks/hero/schema'

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
}))
jest.mock('@nextsparkjs/registries/block-registry', () => ({
  BLOCK_REGISTRY: {
    hero: { slug: 'hero', schemaPath: '@/blocks/hero/schema' },
    'no-schema': { slug: 'no-schema', schemaPath: '@/blocks/no-schema/schema' },
  },
}))
jest.mock('@nextsparkjs/registries/block-schemas', () => ({
  BLOCK_SCHEMAS: { hero: jest.requireActual('../../../../../apps/dev/blocks/hero/schema').schema },
}))

import { POST } from '../../../src/routes/api/v1/blocks/validate/route'

function validate(body: unknown) {
  return (POST as unknown as (request: NextRequest) => Promise<Response>)(
    new NextRequest('http://localhost:3000/api/v1/blocks/validate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
  )
}

describe('POST /api/v1/blocks/validate', () => {
  it('uses the real hero schema', () => {
    expect(heroSchema.safeParse({ textColor: 'dark' }).success).toBe(true)
  })

  it('answers valid for props the block schema accepts', async () => {
    const response = await validate({ blockSlug: 'hero', props: { title: 'Welcome', textColor: 'dark' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ valid: true })
  })

  it('answers 400 with the schema issues for props it rejects', async () => {
    const response = await validate({ blockSlug: 'hero', props: { textColor: 'purple', backgroundImage: 'not a url' } })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.valid).toBe(false)
    expect(body.errors.map((issue: { path: string[] }) => issue.path[0]).sort()).toEqual(['backgroundImage', 'textColor'])
  })

  it('answers 404 for an unknown block and 500 for a block without a schema entry', async () => {
    expect((await validate({ blockSlug: 'missing', props: {} })).status).toBe(404)
    const response = await validate({ blockSlug: 'no-schema', props: {} })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Block schema not found' })
  })

  it('answers 400 with the API validation error shape for a body that does not match the request schema', async () => {
    for (const body of [{}, { blockSlug: 42, props: {} }, { blockSlug: 'hero' }, { blockSlug: 'hero', props: 'x' }]) {
      const response = await validate(body)
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toMatchObject({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR' })
      expect(Array.isArray(json.details) && json.details.length > 0).toBe(true)
    }
  })

  it('answers 400 for a body that is not JSON', async () => {
    const response = await (POST as unknown as (request: NextRequest) => Promise<Response>)(
      new NextRequest('http://localhost:3000/api/v1/blocks/validate', { method: 'POST', body: 'not json' })
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
