/**
 * A slug with no published item (#423). With Cache Components the item route renders the not-found page in place (the
 * project's when the facade passes it, Next.js's own otherwise), so the server HTML carries it, and its metadata says
 * noindex; the status stays the 200 the shell already sent. The ISR route keeps throwing notFound(), its real 404.
 */
const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
const query = jest.fn()
jest.mock('next/navigation', () => ({ notFound: () => notFound() }))
jest.mock('next/cache', () => ({ cacheLife: jest.fn(), cacheTag: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/db', () => ({ query: (...args: unknown[]) => query(...args) }))
jest.mock('@nextsparkjs/core/components/public/pageBuilder', () => ({ PageRenderer: ({ page }: { page: { title: string } }) => <h1>{page.title}</h1> }))
jest.mock('@nextsparkjs/core/lib/blocks/patterns-resolver.service', () => ({ PatternsResolverService: { getByIds: jest.fn(async () => []) } }))

import { Suspense, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as isr from '../../../src/routes/_internal/public-item-route'
import * as cc from '../../../src/routes/_internal/public-item-route.cc'
import type { EntityConfig } from '../../../src/lib/entities/types'

const ROW = { id: 'row-1', slug: 'about', title: 'About us', status: 'published', blocks: [], teamId: 'team-1' }
const config = { slug: 'pages', tableName: 'pages', fields: [], enabled: true, names: { singular: 'page', plural: 'pages' }, access: { public: true, basePath: '/' }, builder: { enabled: true } } as unknown as EntityConfig
const props = (slug: string | string[]) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) })
type Route = (p: ReturnType<typeof props>) => unknown
async function run(route: Route, slug: string | string[]) {
  const out = (await route(props(slug))) as ReactElement<{ children?: ReactElement<ReturnType<typeof props>> }> | null
  const inner = out?.type === Suspense ? out.props.children : null
  return (inner ? await (inner.type as Route)(inner.props) : out) as ReactElement
}
const html = (element: ReactElement) => renderToStaticMarkup(element)
const metadataOf = (routes: typeof isr | typeof cc, slug: string) => routes.createPublicItemMetadata(config)({ params: Promise.resolve({ slug }) })

beforeEach(() => {
  notFound.mockClear()
  query.mockReset().mockImplementation(async (_sql: string, [slug]: string[]) => ({ rows: slug === ROW.slug || slug === 'docs/intro' ? [{ ...ROW, slug }] : [] }))
})

describe('Cache Components', () => {
  it('a missing slug renders Next.js not-found page in the HTML, without notFound()', async () => {
    const markup = html(await run(cc.createPublicItemRoute(config) as Route, 'no-such-page'))
    expect(markup).toContain('This page could not be found.')
    expect(notFound).not.toHaveBeenCalled()
  })

  it("the project's not-found replaces Next.js's when the facade passes it, also for a nested slug", async () => {
    const ProjectNotFound = () => <main data-cy="project-not-found">Lost?</main>
    const route = cc.createPublicItemRouteWithNotFound(config, ProjectNotFound) as Route
    expect(html(await run(route, 'no-such-page'))).toBe('<main data-cy="project-not-found">Lost?</main>')
    expect(html(await run(route, ['docs', 'missing']))).toContain('project-not-found')
    // A static-file request is answered the same way, without a read
    query.mockClear()
    expect(html(await run(route, 'missing.png'))).toContain('project-not-found')
    expect(query).not.toHaveBeenCalled()
  })

  it('an existing slug renders the item', async () => {
    const markup = html(await run(cc.createPublicItemRouteWithNotFound(config, () => <p>nf</p>) as Route, ['docs', 'intro']))
    expect(markup).toContain('data-cy="public-entity-page"')
    expect(markup).toContain('<h1>About us</h1>')
    expect(markup).not.toContain('nf')
  })

  it('the metadata of a missing slug says noindex, an existing one does not', async () => {
    expect(await metadataOf(cc, 'no-such-page')).toEqual({ title: 'Not Found', robots: { index: false } })
    expect(await metadataOf(cc, 'about')).not.toHaveProperty('robots')
  })
})

describe('ISR', () => {
  it('a missing slug still throws notFound() (a real 404), even when handed a not-found page', async () => {
    await expect(run(isr.createPublicItemRoute(config) as Route, 'no-such-page')).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(run(isr.createPublicItemRoute(config, undefined, () => <p>nf</p>) as Route, 'no-such-page')).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('an existing slug renders the item, and no metadata says noindex', async () => {
    expect(html(await run(isr.createPublicItemRoute(config) as Route, 'about'))).toContain('<h1>About us</h1>')
    expect(await metadataOf(isr, 'no-such-page')).toEqual({ title: 'Not Found' })
  })
})
