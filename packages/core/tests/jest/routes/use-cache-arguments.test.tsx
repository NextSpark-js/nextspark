/**
 * The 'use cache' functions of core's routes are server references: whoever reaches one can call it with any
 * arguments. Each takes only plain identifiers, validates them first and derives the rest itself, so an argument
 * that does not fit answers "not found" (null, [], notFound()), not data.
 */
const query = jest.fn()
const getByIds = jest.fn()
const parseMarkdownFile = jest.fn()
const requireAreaAccess = jest.fn()
const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

jest.mock('next/cache', () => ({ cacheLife: jest.fn(), cacheTag: jest.fn() }))
jest.mock('next/navigation', () => ({ notFound: () => notFound() }))
jest.mock('@nextsparkjs/core/lib/db', () => ({ query: (...a: unknown[]) => query(...a) }))
jest.mock('@nextsparkjs/core/lib/blocks/patterns-resolver.service', () => ({ PatternsResolverService: { getByIds: (...a: unknown[]) => getByIds(...a) } }))
jest.mock('@nextsparkjs/core/components/public/pageBuilder', () => ({ PageRenderer: () => null }))
jest.mock('@nextsparkjs/core/lib/docs/parser', () => ({ parseMarkdownFile: (...a: unknown[]) => parseMarkdownFile(...a) }))
jest.mock('@nextsparkjs/core/components/docs/docs-breadcrumbs', () => ({ DocsBreadcrumbs: () => null }))
jest.mock('@nextsparkjs/core/components/docs/docs-content', () => ({ DocsContent: () => null }))
jest.mock('@nextsparkjs/core/components/docs/superadmin-docs-sidebar', () => ({ SuperadminDocsSidebar: () => null }))
jest.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }))
jest.mock('../../../src/routes/_internal/area-access', () => ({ requireAreaAccess: (a: string) => requireAreaAccess(a) }))
jest.mock('../../../src/routes/_internal/suspended-route', () => ({ behindSuspense: (x: unknown) => x }))
jest.mock('@nextsparkjs/registries/docs-registry', () => {
  const path = require('path')
  const page = (kind: string) => ({ slug: 'intro', title: 'Intro', order: 1, source: kind, path: path.join('docs', kind, '01-guide', '01-intro.md') })
  return {
    DOCS_REGISTRY: {
      public: [{ slug: 'guide', title: 'Guide', pages: [page('public'), { ...page('public'), slug: 'escape', path: path.join('docs', 'superadmin', '01-guide', '01-intro.md') }] }],
      superadmin: [{ slug: 'ops', title: 'Ops', pages: [{ ...page('superadmin'), slug: 'run', path: path.join('docs', 'superadmin', '01-ops', '01-run.md') }] }],
    },
  }
})

import { readPublishedItem, readPatterns, createPublicItemRoute } from '../../../src/routes/_internal/public-item-route.cc'
import { resolveRegistryDoc } from '../../../src/lib/docs/registry-doc'
import { generateMetadata as publicMetadata } from '../../../src/routes/(public)/docs/[section]/[page]/page.cc'
import PublicDocsPage from '../../../src/routes/(public)/docs/[section]/[page]/page.cc'
import SuperadminDocsPage from '../../../src/routes/superadmin/docs/[section]/[page]/page.cc'
import type { EntityConfig } from '../../../src/lib/entities/types'

const pages = { slug: 'pages', tableName: 'pages', fields: [{ name: 'slug' }, { name: 'excerpt' }], access: { basePath: '/' } } as unknown as EntityConfig
const secrets = { slug: 'secrets', tableName: 'secrets', fields: [], access: {} } as unknown as EntityConfig
const props = (slug: string) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) })

beforeEach(() => {
  query.mockReset().mockResolvedValue({ rows: [{ id: '1', slug: 'about', title: 'About', blocks: [] }] })
  getByIds.mockReset().mockResolvedValue([])
  parseMarkdownFile.mockReset().mockResolvedValue({ metadata: { title: 'T' }, html: '<p>x</p>' })
  requireAreaAccess.mockReset().mockResolvedValue(undefined)
  notFound.mockClear()
})

describe('readPublishedItem', () => {
  // an entity is known to the cached read only once a route of this process has been given its config
  beforeEach(async () => {
    await createPublicItemRoute(pages)(props('about')).catch(() => undefined)
    query.mockClear()
  })

  it('reads the published row of a registered entity, with its table and columns derived inside', async () => {
    await expect(readPublishedItem('pages', 'about')).resolves.toMatchObject({ slug: 'about' })
    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('FROM "pages" WHERE slug = $1 AND status = \'published\'')
    expect(params).toEqual(['about'])
  })

  it.each([
    ['an unknown entity', 'nope', 'about'],
    ['an entity without a public base path', 'secrets', 'about'],
    ['an entity slug that is not an identifier', 'pages"; DROP TABLE users;--', 'about'],
    ['an empty slug', 'pages', ''],
    ['a slug with a quote', 'pages', "x' OR '1'='1"],
    ['a slug with traversal', 'pages', '../etc/passwd'],
    ['a slug that is too long', 'pages', 'a'.repeat(201)],
  ])('answers null, without a query, for %s', async (_label, entity, slug) => {
    await createPublicItemRoute(secrets)(props('x')).catch(() => undefined)
    query.mockClear()
    await expect(readPublishedItem(entity, slug)).resolves.toBeNull()
    expect(query).not.toHaveBeenCalled()
  })

  it.each([[undefined, 'a'], ['pages', undefined], [{ toString: () => 'pages' }, 'a'], ['pages', ['a']], [null, null], [42, 42]])('answers null for the arguments %j', async (entity, slug) => {
    await expect(readPublishedItem(entity as never, slug as never)).resolves.toBeNull()
    expect(query).not.toHaveBeenCalled()
  })

  it.each(['release-1.0', 'v2.5', 'qa/block/home-qa-us'])('still accepts the slug %s', async slug => {
    await readPublishedItem('pages', slug)
    expect(query).toHaveBeenCalledWith(expect.any(String), [slug])
  })
})

describe('readPatterns', () => {
  it('reads the published patterns of valid ids', async () => {
    getByIds.mockResolvedValue([{ id: 'abc-123' }])
    await expect(readPatterns(['abc-123', '2f1c0a9e-aaaa-bbbb-cccc-000000000001'])).resolves.toEqual([{ id: 'abc-123' }])
  })

  it.each([
    ['a string', 'abc'],
    ['nothing', undefined],
    ['an empty list', []],
    ['an id with a quote', ["x') OR 1=1 --"]],
    ['a non-string id', [{ id: 1 }]],
    ['an object', { length: 1, 0: 'a' }],
    ['too many ids', Array.from({ length: 51 }, (_, i) => `id${i}`)],
  ])('answers [] without a query for %s', async (_label, ids) => {
    await expect(readPatterns(ids as never)).resolves.toEqual([])
    expect(getByIds).not.toHaveBeenCalled()
  })
})

describe('resolveRegistryDoc', () => {
  const sections = [{ slug: 'ops', title: 'Ops', pages: [{ slug: 'run', path: 'docs/superadmin/01-ops/01-run.md' }, { slug: 'out', path: '../secret.md' }, { slug: 'pub', path: 'docs/public/01-ops/01-pub.md' }, { slug: 'txt', path: 'docs/superadmin/01-ops/notes.txt' }] }]

  it('resolves a registry page under its docs root', () => {
    expect(resolveRegistryDoc(sections, 'superadmin', 'ops', 'run', '/proj')).toEqual({ sectionTitle: 'Ops', filePath: '/proj/docs/superadmin/01-ops/01-run.md' })
  })

  it.each([
    ['a page outside the project', 'ops', 'out'],
    ['a page of the other category', 'ops', 'pub'],
    ['a file that is not markdown', 'ops', 'txt'],
    ['an unknown page', 'ops', 'nope'],
    ['a traversing section', '../ops', 'run'],
    ['a traversing page', 'ops', '..'],
    ['a separator', 'ops/x', 'run'],
    ['a leading dot', '.ops', 'run'],
    ['the placeholder', '_', '_'],
    ['non-strings', 1 as never, ['run'] as never],
  ])('answers null for %s', (_label, section, page) => {
    expect(resolveRegistryDoc(sections, 'superadmin', section, page, '/proj')).toBeNull()
  })
})

describe('the docs pages', () => {
  const docProps = (section: string, page: string) => ({ params: Promise.resolve({ section, page }) })

  it('render a listed public doc', async () => {
    await expect(PublicDocsPage(docProps('guide', 'intro'))).resolves.toBeTruthy()
    expect(parseMarkdownFile).toHaveBeenCalledWith(expect.stringMatching(/docs\/public\/01-guide\/01-intro\.md$/))
    await expect(publicMetadata(docProps('guide', 'intro'))).resolves.toMatchObject({ title: 'T | Documentation' })
  })

  it.each([['superadmin-only section', 'ops', 'run'], ['page whose file is outside docs/public', 'guide', 'escape'], ['traversal', '..', '..'], ['a path', 'guide/../ops', 'run']])('answer not found for a public %s, without reading a file', async (_l, section, page) => {
    await expect(PublicDocsPage(docProps(section, page))).rejects.toThrow('NEXT_NOT_FOUND')
    expect((await publicMetadata(docProps(section, page))).title).toBe('Page Not Found')
    expect(parseMarkdownFile).not.toHaveBeenCalled()
  })

  it('render a listed superadmin doc only after the access check', async () => {
    const order: string[] = []
    requireAreaAccess.mockImplementation(async () => void order.push('access'))
    parseMarkdownFile.mockImplementation(async () => (order.push('read'), { metadata: { title: 'T' }, html: '' }))
    await expect(SuperadminDocsPage(docProps('ops', 'run'))).resolves.toBeTruthy()
    expect(order).toEqual(['access', 'read'])
    expect(requireAreaAccess).toHaveBeenCalledWith('superadmin')
  })

  it('read nothing when the access check refuses', async () => {
    requireAreaAccess.mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(SuperadminDocsPage(docProps('ops', 'run'))).rejects.toThrow('NEXT_REDIRECT')
    expect(parseMarkdownFile).not.toHaveBeenCalled()
  })

  it.each([['a public section', 'guide', 'intro'], ['traversal', '..', 'run'], ['a path', 'ops/..', 'run']])('answer not found for a superadmin request for %s', async (_l, section, page) => {
    await expect(SuperadminDocsPage(docProps(section, page))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(parseMarkdownFile).not.toHaveBeenCalled()
  })
})
