/**
 * #273: the sitemap builder - which URLs, lastmod, extra and excluded paths, base path - and the rows it is given.
 */
import { buildSitemap, isExcluded, isSitemapEntity, type BuildSitemapInput, type SitemapEntity } from '@/core/lib/seo/sitemap'
import { readPublishedEntries } from '@/core/lib/seo/sitemap-entries'
import type { EntityConfig } from '@/core/lib/entities/types'
import { resolveSitemap } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data'

const entity = (overrides: Record<string, unknown> = {}): EntityConfig =>
  ({
    slug: 'posts',
    tableName: 'posts',
    access: { public: true, basePath: '/blog' },
    builder: { enabled: true },
    ui: { public: { hasArchivePage: true } },
    ...overrides,
  }) as unknown as EntityConfig

const BASE: BuildSitemapInput = {
  origin: 'https://example.com',
}

const urls = (sitemap: ReturnType<typeof buildSitemap>) => sitemap.map(entry => entry.url)

describe('buildSitemap', () => {
  it('lists static pages and published entries, once per URL, with no hreflang alternates', () => {
    const sitemap = buildSitemap({
      ...BASE,
      staticPaths: ['/', '/support'],
      entities: [{ config: entity(), rows: [{ slug: 'first-post', updatedAt: '2026-01-02T03:04:05.000Z' }] }],
    })

    expect(urls(sitemap)).toEqual(['https://example.com/', 'https://example.com/support', 'https://example.com/blog', 'https://example.com/blog/first-post'])
    expect(sitemap.at(-1)).toEqual({
      url: 'https://example.com/blog/first-post',
      lastModified: new Date('2026-01-02T03:04:05.000Z'),
    })
  })

  it('sets lastModified from updatedAt (a Date or a string) and none for static pages or an unreadable date', () => {
    const sitemap = buildSitemap({
      ...BASE,
      staticPaths: ['/support'],
      entities: [{ config: entity(), rows: [{ slug: 'a', updatedAt: new Date('2026-03-04T00:00:00Z') }, { slug: 'b', updatedAt: 'not a date' }, { slug: 'c', updatedAt: null }] }],
    })

    expect(sitemap.find(entry => entry.url.endsWith('/support'))).not.toHaveProperty('lastModified')
    expect(sitemap.find(entry => entry.url.endsWith('/a'))!.lastModified).toEqual(new Date('2026-03-04T00:00:00Z'))
    expect(sitemap.find(entry => entry.url.endsWith('/b'))).not.toHaveProperty('lastModified')
    expect(sitemap.find(entry => entry.url.endsWith('/c'))).not.toHaveProperty('lastModified')
  })

  it('serves an entity at the site root without a prefix, and nested slugs as paths', () => {
    const pages = entity({ slug: 'pages', access: { public: true, basePath: '/', allowNestedSlugs: true }, ui: {} })
    const sitemap = buildSitemap({ ...BASE, entities: [{ config: pages, rows: [{ slug: 'about' }, { slug: 'docs/intro' }] }] })

    expect(urls(sitemap)).toEqual(['https://example.com/about', 'https://example.com/docs/intro'])
  })

  it('follows the base path', () => {
    const sitemap = buildSitemap({ ...BASE, basePath: '/app', staticPaths: ['/', '/support'], entities: [{ config: entity(), rows: [{ slug: 'x' }] }] })

    expect(urls(sitemap)).toEqual(['https://example.com/app', 'https://example.com/app/support', 'https://example.com/app/blog', 'https://example.com/app/blog/x'])
  })

  it('leaves out an entity that is not public: no builder, no public access, no base path', () => {
    const rows = [{ slug: 'secret' }]
    const entities: SitemapEntity[] = [
      { config: entity({ access: { public: false, basePath: '/blog' } }), rows },
      { config: entity({ access: { basePath: '/blog' } }), rows },
      { config: entity({ builder: { enabled: false } }), rows },
      { config: entity({ builder: undefined }), rows },
      { config: entity({ access: { public: true } }), rows },
    ]

    expect(buildSitemap({ ...BASE, entities })).toEqual([])
    expect(entities.map(({ config }) => isSitemapEntity(config))).toEqual([false, false, false, false, false])
  })

  it('adds the archive of an entity only when it has one and is not at the root', () => {
    const noArchive = entity({ ui: {} })
    const root = entity({ access: { public: true, basePath: '/' }, ui: { public: { hasArchivePage: true } } })

    expect(urls(buildSitemap({ ...BASE, entities: [{ config: noArchive, rows: [] }] }))).toEqual([])
    expect(urls(buildSitemap({ ...BASE, entities: [{ config: root, rows: [] }] }))).toEqual([])
    expect(urls(buildSitemap({ ...BASE, entities: [{ config: entity(), rows: [] }] }))).toEqual(['https://example.com/blog'])
  })

  it('adds the extra urls and drops the excluded paths, exact or by prefix, from everything', () => {
    const sitemap = buildSitemap({
      ...BASE,
      staticPaths: ['/', '/support', '/legal/terms'],
      entities: [{ config: entity(), rows: [{ slug: 'keep' }, { slug: 'draft-idea' }, { slug: 'draft-two' }] }],
      urls: ['/pricing', '/support', 'relative', '/legal/privacy'],
      exclude: ['/support', '/blog/draft-*', '/legal/*'],
    })

    expect(urls(sitemap)).toEqual(['https://example.com/', 'https://example.com/blog', 'https://example.com/blog/keep', 'https://example.com/pricing'])
  })

  it('lists a URL once even when a path comes from two sources', () => {
    const sitemap = buildSitemap({ ...BASE, staticPaths: ['/blog'], entities: [{ config: entity(), rows: [{ slug: 'a' }] }], urls: ['/blog/a', '/blog'] })

    expect(urls(sitemap)).toEqual(['https://example.com/blog', 'https://example.com/blog/a'])
  })

  it('percent-encodes what a slug may carry', () => {
    const sitemap = buildSitemap({ ...BASE, entities: [{ config: entity(), rows: [{ slug: 'a b&c' }] }] })

    expect(urls(sitemap)).toContain('https://example.com/blog/a%20b%26c')
  })
})

describe('the rendered document', () => {
  it('is well-formed XML whatever the paths hold, with a & in a static page, an extra url and a slug', () => {
    const sitemap = buildSitemap({
      ...BASE,
      staticPaths: ['/terms&conditions', "/it's"],
      urls: ['/a&b=c', '/q"<x>'],
      entities: [{ config: entity(), rows: [{ slug: 'a&b' }] }],
    })
    const xml = resolveSitemap(sitemap)

    const parsed = new DOMParser().parseFromString(xml, 'application/xml')
    expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0)
    const locs = Array.from(parsed.getElementsByTagName('loc')).map(loc => loc.textContent)
    expect(locs).toContain('https://example.com/terms&conditions')
    expect(locs).toContain('https://example.com/a&b=c')
    expect(locs).toContain('https://example.com/blog/a%26b')
    expect(xml).toContain('<loc>https://example.com/terms&amp;conditions</loc>')
    expect(xml).not.toContain('xhtml:link')
  })
})

describe('isExcluded', () => {
  it('matches an exact path, or the prefix before a trailing *', () => {
    expect(isExcluded('/a', ['/a'])).toBe(true)
    expect(isExcluded('/a/b', ['/a'])).toBe(false)
    expect(isExcluded('/a/b', ['/a/*'])).toBe(true)
    expect(isExcluded('/a', ['/a/*'])).toBe(false)
    expect(isExcluded('/anything', undefined)).toBe(false)
  })
})

describe('readPublishedEntries', () => {
  const row = (slug: string) => ({ slug, updatedAt: '2026-01-01' })

  it('asks for published rows only, one per slug, through the entity table', async () => {
    const run = jest.fn().mockResolvedValue({ rows: [row('ok')] })

    await expect(readPublishedEntries(entity({ tableName: 'blog_posts' }), run, 10)).resolves.toEqual([row('ok')])

    const [sql, params] = run.mock.calls[0]
    expect(sql).toContain('FROM "blog_posts"')
    expect(sql).toContain("WHERE status = 'published'")
    expect(sql).toContain('GROUP BY slug')
    expect(params).toEqual([10])
  })

  it('drops slugs the public route answers not found for', async () => {
    const rows = ['ok', 'v1.0', 'logo.png', 'robots.txt', '-leading', 'with space', 'nested/slug', 'x'.repeat(201)].map(row)
    const run = jest.fn().mockResolvedValue({ rows })

    // base path /blog: `[...slug]`, so a nested slug is served
    expect((await readPublishedEntries(entity(), run)).map(r => r.slug)).toEqual(['ok', 'v1.0', 'nested/slug'])
    // the site root without nested slugs: `[slug]`, one segment only
    const root = entity({ access: { public: true, basePath: '/' } })
    expect((await readPublishedEntries(root, run)).map(r => r.slug)).toEqual(['ok', 'v1.0'])
  })

  it('drops a slug of an entity at the site root that one of core\'s routes answers', async () => {
    const run = jest.fn().mockResolvedValue({ rows: ['about', 'dashboard', 'Login', 'login-help', 'api/x'].map(row) })
    const root = entity({ access: { public: true, basePath: '/', allowNestedSlugs: true } })

    expect((await readPublishedEntries(root, run)).map(r => r.slug)).toEqual(['about', 'login-help'])
    // under a base path of its own nothing is shadowed
    expect((await readPublishedEntries(entity(), run)).map(r => r.slug)).toEqual(['about', 'dashboard', 'Login', 'login-help', 'api/x'])
  })

  it('refuses a table name that is not an identifier, without querying', async () => {
    const run = jest.fn()

    await expect(readPublishedEntries(entity({ tableName: 'posts"; DROP TABLE users; --' }), run)).resolves.toEqual([])
    expect(run).not.toHaveBeenCalled()
  })
})
