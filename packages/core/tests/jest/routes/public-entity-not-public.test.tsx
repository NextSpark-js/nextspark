/**
 * The public item and archive routes serve an entity only when its config has `access.public: true`: the route
 * answers notFound() for any other entity, renders
 * nothing (no template either) and its metadata has nothing from a row. Both item sources (ISR and Cache
 * Components) read no row for such an entity.
 */
const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
const query = jest.fn()
jest.mock('next/navigation', () => ({ notFound: () => notFound() }))
jest.mock('next/cache', () => ({ cacheLife: jest.fn(), cacheTag: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/db', () => ({ query: (...args: unknown[]) => query(...args) }))
jest.mock('@nextsparkjs/core/components/public/pageBuilder', () => ({ PageRenderer: () => null }))
jest.mock('@nextsparkjs/core/components/public/entities/PublicEntityGrid', () => ({ PublicEntityGrid: () => null }))
jest.mock('@nextsparkjs/core/lib/blocks/patterns-resolver.service', () => ({ PatternsResolverService: { getByIds: jest.fn(async () => []) } }))

import { Suspense } from 'react'
import * as isr from '../../../src/routes/_internal/public-item-route'
import * as cc from '../../../src/routes/_internal/public-item-route.cc'
import { createPublicArchiveRoute } from '../../../src/routes/_internal/public-archive-route'
import { fetchPublishedItem } from '../../../src/routes/_internal/public-entity-shared'
import type { EntityConfig } from '../../../src/lib/entities/types'

const ROW = { id: 'row-1', slug: 'roadmap', title: 'Row title', status: 'published', blocks: [], seoTitle: 'Row SEO title', seoDescription: 'Row SEO description', excerpt: 'Row excerpt', ogImage: '/og.png' }
const entity = (slug: string, access: Record<string, unknown>) =>
  ({ slug, tableName: slug, fields: [], enabled: true, names: { singular: slug, plural: slug }, access, ui: { public: { hasArchivePage: true } }, builder: { enabled: true } }) as unknown as EntityConfig
const props = (slug: string) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) })
type Route = (props: ReturnType<typeof props>) => unknown
/** Render a route, through the Suspense boundary the Cache Components module puts it behind. */
async function run(route: Route, slug: string) {
  const out = (await route(props(slug))) as { type?: unknown; props?: { children?: { type: Route; props: ReturnType<typeof props> } } } | null
  const inner = out?.type === Suspense ? out.props?.children : null
  return inner ? inner.type(inner.props) : out
}

const PRIVATE = {
  'public: false': entity('internal', { public: false, basePath: '/internal' }),
  'public missing': entity('unset', { basePath: '/unset' }),
  'public: "true" (not literally true)': entity('loose', { public: 'true', basePath: '/loose' }),
  'deprecated builder.public.basePath': { ...entity('legacy', { public: false }), builder: { enabled: true, public: { basePath: '/legacy' } } } as unknown as EntityConfig,
}

beforeEach(() => {
  notFound.mockClear()
  query.mockReset().mockResolvedValue({ rows: [ROW] })
})

describe.each([
  ['ISR', isr],
  ['Cache Components', cc],
])('%s item route of an entity without access.public: true', (_mode, routes) => {
  it.each(Object.entries(PRIVATE))('%s: answers notFound(), reads no row and renders no template', async (_label, config) => {
    const Template = jest.fn(() => null)
    await expect(run(routes.createPublicItemRoute(config) as Route, 'roadmap')).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(run(routes.createPublicItemRoute(config, Template) as Route, 'roadmap')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(Template).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it.each(Object.entries(PRIVATE))('%s: metadata has nothing from the row', async (_label, config) => {
    const metadata = await routes.createPublicItemMetadata(config)({ params: Promise.resolve({ slug: 'roadmap' }) })
    expect(metadata).toEqual({ title: 'Not Found' })
    expect(JSON.stringify(metadata)).not.toMatch(/Row /)
    expect(query).not.toHaveBeenCalled()
  })

  it('a public entity is still served, with its metadata', async () => {
    const config = entity(`blog${_mode.length}`, { public: true, basePath: '/blog' })
    const element = await run(routes.createPublicItemRoute(config) as Route, 'roadmap')
    expect(notFound).not.toHaveBeenCalled()
    expect(element).toBeTruthy()
    const metadata = await routes.createPublicItemMetadata(config)({ params: Promise.resolve({ slug: 'roadmap' }) })
    expect(metadata).toMatchObject({ title: 'Row SEO title', description: 'Row SEO description' })
  })
})

describe('archive route', () => {
  it.each(Object.entries(PRIVATE))('%s: answers notFound() and renders nothing', (_label, config) => {
    expect(() => createPublicArchiveRoute(config)({ searchParams: Promise.resolve({}) })).toThrow('NEXT_NOT_FOUND')
  })

  it('a public entity keeps its archive', () => {
    expect(createPublicArchiveRoute(entity('posts', { public: true, basePath: '/blog' }))({ searchParams: Promise.resolve({}) })).toBeTruthy()
  })
})

describe('the published-row readers', () => {
  it.each(Object.entries(PRIVATE))('%s: fetchPublishedItem and readPublishedItem read nothing', async (_label, config) => {
    expect(await fetchPublishedItem(config, 'roadmap')).toBeNull()
    cc.createPublicItemRoute(config)
    expect(await cc.readPublishedItem(config.slug, 'roadmap')).toBeNull()
    expect(query).not.toHaveBeenCalled()
  })
})
