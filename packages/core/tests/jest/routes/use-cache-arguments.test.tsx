/**
 * The 'use cache' functions of core's routes are server references: whoever reaches one can call it with any
 * arguments. Each takes only plain identifiers, validates them first and derives the rest itself, so an argument
 * that does not fit answers "not found" (null, [], notFound()), not data.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const query = jest.fn()
const cacheTag = jest.fn()
const getByIds = jest.fn()
const parseMarkdownFile = jest.fn()
const requireAreaAccess = jest.fn()
const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

jest.mock('next/cache', () => ({ cacheLife: jest.fn(), cacheTag: (...a: unknown[]) => cacheTag(...a) }))
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

import { readPublishedItem, readPatterns, createPublicItemRoute, createPublicItemMetadata } from '../../../src/routes/_internal/public-item-route.cc'
import { resolveRegistryDoc } from '../../../src/lib/docs/registry-doc'
import { generateMetadata as publicMetadata } from '../../../src/routes/(public)/docs/[section]/[page]/page.cc'
import PublicDocsPage from '../../../src/routes/(public)/docs/[section]/[page]/page.cc'
import SuperadminDocsPage from '../../../src/routes/superadmin/docs/[section]/[page]/page.cc'
import type { EntityConfig } from '../../../src/lib/entities/types'

// docs files on disk: the root check resolves real paths
const projectDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 's166-')))
for (const rel of ['docs/public/01-guide/01-intro.md', 'docs/superadmin/01-guide/01-intro.md', 'docs/superadmin/01-ops/01-run.md']) {
  fs.mkdirSync(path.dirname(path.join(projectDir, rel)), { recursive: true })
  fs.writeFileSync(path.join(projectDir, rel), '# x')
}
beforeAll(() => void jest.spyOn(process, 'cwd').mockReturnValue(projectDir))
afterAll(() => {
  jest.restoreAllMocks()
  fs.rmSync(projectDir, { recursive: true, force: true })
})

const pages = { slug: 'pages', tableName: 'pages', fields: [{ name: 'slug' }, { name: 'excerpt' }], access: { public: true, basePath: '/' } } as unknown as EntityConfig
const legacy = { slug: 'posts', tableName: 'posts', fields: [], access: { public: true }, builder: { enabled: true, public: { basePath: '/blog' } } } as unknown as EntityConfig
const oddTable = { slug: 'odd', tableName: 'odd"; DROP TABLE users;--', fields: [], access: { public: true, basePath: '/odd' } } as unknown as EntityConfig
const props = (slug: string) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) })

beforeEach(() => {
  query.mockReset().mockResolvedValue({ rows: [{ id: '1', slug: 'about', title: 'About', blocks: [] }] })
  getByIds.mockReset().mockResolvedValue([])
  cacheTag.mockClear()
  parseMarkdownFile.mockReset().mockResolvedValue({ metadata: { title: 'T' }, html: '<p>x</p>' })
  requireAreaAccess.mockReset().mockResolvedValue(undefined)
  notFound.mockClear()
})

describe('readPublishedItem', () => {
  // the facade of a route hands its config to the factories when its module loads: that is where the cached read learns an entity
  beforeAll(() => {
    createPublicItemRoute(pages)
    createPublicItemMetadata(legacy)
    createPublicItemRoute(oddTable)
  })
  beforeEach(() => query.mockClear())

  it('reads the published row of a registered entity, with its table and columns derived inside', async () => {
    await expect(readPublishedItem('pages', 'about')).resolves.toMatchObject({ slug: 'about' })
    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('FROM "pages" WHERE slug = $1 AND status = \'published\'')
    expect(params).toEqual(['about'])
  })

  it('tags a read with the entity and the item, for revalidateTag', async () => {
    await readPublishedItem('pages', 'about')
    expect(cacheTag).toHaveBeenCalledWith('entity:pages', 'public-item:pages:about')
  })

  it('serves an entity that declares its base path the deprecated way (builder.public.basePath)', async () => {
    await expect(readPublishedItem('posts', 'hello')).resolves.toMatchObject({ slug: 'about' })
    expect(query.mock.calls[0][0]).toContain('FROM "posts"')
  })

  it('answers null, without a query, for an entity whose table name is not an identifier', async () => {
    await expect(readPublishedItem('odd', 'about')).resolves.toBeNull()
    expect(query).not.toHaveBeenCalled()
  })

  it('throws, rather than answering a cacheable null, for a well-formed entity no route registered', async () => {
    await expect(readPublishedItem('unregistered', 'about')).rejects.toThrow(/no route/)
    expect(query).not.toHaveBeenCalled()
    expect(cacheTag).not.toHaveBeenCalled()
    createPublicItemRoute({ ...pages, slug: 'unregistered', tableName: 'unregistered' } as EntityConfig)
    await expect(readPublishedItem('unregistered', 'about')).resolves.toMatchObject({ slug: 'about' })
  })

  it.each([
    ['an entity slug that is not an identifier', 'pages"; DROP TABLE users;--', 'about'],
    ['an empty slug', 'pages', ''],
    ['a slug with a quote', 'pages', "x' OR '1'='1"],
    ['a slug with traversal', 'pages', '../etc/passwd'],
    ['a slug that is too long', 'pages', 'a'.repeat(201)],
  ])('answers null, without a query or a tag, for %s', async (_label, entity, slug) => {
    await expect(readPublishedItem(entity, slug)).resolves.toBeNull()
    expect(query).not.toHaveBeenCalled()
    expect(cacheTag).not.toHaveBeenCalled()
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
  it('reads the published patterns of valid ids, tagged for revalidation', async () => {
    getByIds.mockResolvedValue([{ id: 'abc-123' }])
    await expect(readPatterns(['abc-123', '2f1c0a9e-aaaa-bbbb-cccc-000000000001'])).resolves.toEqual([{ id: 'abc-123' }])
    expect(cacheTag).toHaveBeenCalledWith('patterns')
  })

  it('returns only what a page renders of a pattern: its id and blocks', async () => {
    const blocks = [{ id: 'b1', blockSlug: 'hero', props: {} }]
    getByIds.mockResolvedValue([{ id: 'abc-123', userId: 'u1', teamId: 't1', title: 'T', slug: 's', status: 'published', description: 'd', blocks, createdAt: 'c', updatedAt: 'u' }])
    const patterns = await readPatterns(['abc-123'])
    expect(patterns).toStrictEqual([{ id: 'abc-123', blocks }])
  })

  it('drops only the malformed ids, the others are still read', async () => {
    await readPatterns(['good-1', "x') OR 1=1 --", 7 as never, 'good-2'])
    expect(getByIds).toHaveBeenCalledWith(['good-1', 'good-2'])
  })

  it.each([
    ['a string', 'abc'],
    ['nothing', undefined],
    ['an empty list', []],
    ['only malformed ids', ["x') OR 1=1 --", { id: 1 }]],
    ['an object', { length: 1, 0: 'a' }],
    ['too many ids', Array.from({ length: 51 }, (_, i) => `id${i}`)],
  ])('answers [] without a query for %s', async (_label, ids) => {
    await expect(readPatterns(ids as never)).resolves.toEqual([])
    expect(getByIds).not.toHaveBeenCalled()
    expect(cacheTag).not.toHaveBeenCalled()
  })
})

describe('resolveRegistryDoc', () => {
  const sections = [{ slug: 'ops', title: 'Ops', pages: [{ slug: 'run', path: 'docs/superadmin/01-ops/01-run.md' }, { slug: 'out', path: '../secret.md' }, { slug: 'pub', path: 'docs/public/01-guide/01-intro.md' }, { slug: 'txt', path: 'docs/superadmin/01-ops/notes.txt' }, { slug: 'gone', path: 'docs/superadmin/01-ops/gone.md' }, { slug: 'link', path: 'docs/superadmin/01-ops/link.md' }] }]
  beforeAll(() => {
    fs.writeFileSync(path.join(projectDir, 'docs/superadmin/01-ops/notes.txt'), 'x')
    fs.writeFileSync(path.join(projectDir, 'outside.md'), 'x')
    fs.symlinkSync(path.join(projectDir, 'outside.md'), path.join(projectDir, 'docs/superadmin/01-ops/link.md'))
  })

  it('resolves a registry page under its docs root', () => {
    expect(resolveRegistryDoc(sections, 'superadmin', 'ops', 'run', projectDir)).toEqual({ sectionTitle: 'Ops', filePath: path.join(projectDir, 'docs/superadmin/01-ops/01-run.md') })
  })

  it.each([
    ['a page outside the project', 'ops', 'out'],
    ['a page of the other category', 'ops', 'pub'],
    ['a file that is not markdown', 'ops', 'txt'],
    ['a file that does not exist', 'ops', 'gone'],
    ['a symlink that points outside the root', 'ops', 'link'],
    ['an unknown page', 'ops', 'nope'],
    ['a traversing section', '../ops', 'run'],
    ['a traversing page', 'ops', '..'],
    ['a separator', 'ops/x', 'run'],
    ['a leading dot', '.ops', 'run'],
    ['the placeholder', '_', '_'],
    ['non-strings', 1 as never, ['run'] as never],
  ])('answers null for %s', (_label, section, page) => {
    expect(resolveRegistryDoc(sections, 'superadmin', section, page, projectDir)).toBeNull()
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
