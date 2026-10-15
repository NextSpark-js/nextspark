/**
 * S192 — input validation of /api/v1/blocks (GET), /api/v1/blocks/[slug] (GET) and /api/v1/blocks/validate (POST).
 * The registries are plain objects, so a slug that names an object property ("constructor") is a lookup that
 * must still answer "not found".
 */

import { NextRequest } from 'next/server'
import { makeReq, asJson, describeMalformedBodies, describeRejectedValues, expectCleanRejection, bodyOf } from './__helpers__/route-harness'

const mockBlock = { slug: 'hero', name: 'Hero', description: 'd', category: 'content', icon: 'Star', fieldDefinitions: [], scope: ['pages'] }
jest.mock('@nextsparkjs/registries/block-registry', () => ({ BLOCK_REGISTRY: { hero: mockBlock }, BLOCK_CATEGORIES: ['content'] }), { virtual: true })
jest.mock('@nextsparkjs/registries/block-schemas', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const z = require('zod')
  return { BLOCK_SCHEMAS: { hero: z.object({ title: z.string().max(50) }) } }
}, { virtual: true })

import { GET as listBlocks } from '@/app/api/v1/blocks/route'
import { GET as getBlock } from '@/app/api/v1/blocks/[slug]/route'
import { POST as validateBlock } from '@/app/api/v1/blocks/validate/route'

type Body = Parameters<typeof makeReq>[2]
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => undefined) })

describe('GET /api/v1/blocks — query parameters', () => {
  test.each([
    ['unknown parameters', '?colour=brown'],
    ['repeated parameters (the first is read)', '?category=content&category=nothing'],
    ['a category that does not exist', '?category=nothing'],
    ['a scope that does not exist', '?scope=nothing'],
    ['empty values', '?category=&scope='],
    ['a long category', `?category=${'x'.repeat(20_000)}`],
  ])('answers %s with a normal 200', async (_label, query) => {
    const response = await listBlocks(new NextRequest(`http://localhost/api/v1/blocks${query}`), undefined as never)
    expect(response.status).toBe(200)
  })
})

describe('GET /api/v1/blocks/[slug]', () => {
  const get = (slug: string) => getBlock(new NextRequest('http://localhost/api/v1/blocks/x'), { params: Promise.resolve({ slug }) })

  test.each([
    ['text', 'no-such-block'],
    ['an over-long string', 'a'.repeat(5000)],
    ['non-ASCII text', 'bloque-日本語'],
    ['an empty string', ''],
  ])('a slug of %s is answered 404', async (_label, slug) => {
    expect((await get(slug)).status).toBe(404)
  })

  // The registry is a plain object: these names are found on its prototype and answered 200 with empty fields.
  test.each([['constructor'], ['toString'], ['hasOwnProperty'], ['__proto__']])('the slug %s is answered 404', async (slug) => {
    expect((await get(slug)).status).toBe(404)
  })
})

describe('POST /api/v1/blocks/validate', () => {
  const invoke = (body: Body) => validateBlock(makeReq('POST', '/api/v1/blocks/validate', body), undefined as never)

  describeMalformedBodies(invoke, { code: 'VALIDATION_ERROR' })

  describeRejectedValues(invoke, [
    ['an empty object', {}],
    ['a block slug given a number', { blockSlug: 5, props: {} }],
    ['props given text', { blockSlug: 'hero', props: 'x' }],
    ['props given an array', { blockSlug: 'hero', props: [] }],
    ['props given null', { blockSlug: 'hero', props: null }],
    ['props missing', { blockSlug: 'hero' }],
  ], { code: 'VALIDATION_ERROR' })

  test('a block that does not exist is answered 404', async () => {
    expect((await invoke(asJson({ blockSlug: 'no-such-block', props: {} }))).status).toBe(404)
  })

  test('props that fail the block schema are answered 400 with valid=false', async () => {
    const response = await invoke(asJson({ blockSlug: 'hero', props: { title: 'x'.repeat(51) } }))
    expect(response.status).toBe(400)
    expect((await bodyOf(response)).valid).toBe(false)
  })

  test('props of the wrong type are answered 400 with valid=false', async () => {
    const response = await invoke(asJson({ blockSlug: 'hero', props: { title: 5 } }))
    expect(response.status).toBe(400)
  })

  test('unusual Unicode props are valid and answered 200', async () => {
    const response = await invoke(asJson({ blockSlug: 'hero', props: { title: 'Ünïcödé 日本語 🐕‍🦺 ريكس' } }))
    expect(response.status).toBe(200)
  })

  test.each([['constructor'], ['toString'], ['hasOwnProperty']])('the block slug %s is answered 404, not 500', async (blockSlug) => {
    await expectCleanRejection(await invoke(asJson({ blockSlug, props: {} })), { status: 404 })
  })
})
