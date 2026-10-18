/**
 * #273: core's /sitemap.xml route - which entities are read, the visibility of what is listed, and the cache.
 */
const mockQuery = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }))
jest.mock('@nextsparkjs/registries/entity-registry', () => {
  const config = (slug: string, access: Record<string, unknown>, builder: Record<string, unknown> | undefined = { enabled: true }) => ({
    slug,
    tableName: slug,
    access,
    builder,
    ui: { public: { hasArchivePage: true } },
  })
  return {
    ENTITY_REGISTRY: {
      posts: { source: 'project', config: config('posts', { public: true, basePath: '/blog' }) },
      pages: { source: 'project', config: config('pages', { public: true, basePath: '/' }) },
      // team-scoped / private / not built by the host: never read
      tasks: { source: 'project', config: config('tasks', { public: false, shared: false }, undefined) },
      notes: { source: 'project', config: config('notes', { public: false, basePath: '/notes' }) },
      drafts: { source: 'project', config: config('drafts', { basePath: '/drafts' }) },
      plain: { source: 'project', config: config('plain', { public: true }, { enabled: false }) },
      users: { source: 'core', config: config('users', { public: true, basePath: '/users' }) },
    },
  }
})

import { createSitemapRoute, projectEntities, readSitemap } from '@/app/_internal/sitemap-route'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL

beforeEach(() => {
  mockQuery.mockReset()
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
})

afterEach(() => {
  if (APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = APP_URL
})

describe('which entities are read', () => {
  it('never a core entity', () => {
    expect(projectEntities().map(config => config.slug)).not.toContain('users')
  })

  it('queries only the builder entities with a base path and public access, for published rows only', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    await readSitemap({})

    expect(mockQuery).toHaveBeenCalledTimes(2)
    for (const [sql] of mockQuery.mock.calls) expect(sql).toContain("status = 'published'")
    expect(mockQuery.mock.calls.map(([sql]) => /FROM "(\w+)"/.exec(sql)![1])).toEqual(['posts', 'pages'])
  })
})

describe('readSitemap', () => {
  it('builds the document from the rows the database returns', async () => {
    mockQuery.mockImplementation(async (sql: string) => ({
      rows: sql.includes('"posts"') ? [{ slug: 'hello', updatedAt: '2026-02-01T00:00:00.000Z' }] : [{ slug: 'about', updatedAt: null }],
    }))

    const { sitemap, failed } = await readSitemap({ staticPaths: ['/support'], urls: ['/pricing'], exclude: ['/pricing'] })

    expect(failed).toBe(false)
    expect(sitemap.map(entry => entry.url)).toEqual(['https://example.com/support', 'https://example.com/blog', 'https://example.com/blog/hello', 'https://example.com/about'])
    expect(Object.keys(sitemap[0].alternates!.languages!)).toContain('x-default')
  })

  it('lists what the other entities returned when one cannot be read, and says it failed', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('"posts"')) throw new Error('relation "posts" does not exist')
      return { rows: [{ slug: 'about' }] }
    })

    const { sitemap, failed } = await readSitemap({})

    expect(failed).toBe(true)
    expect(sitemap.map(entry => entry.url)).toEqual(['https://example.com/about'])
    error.mockRestore()
  })

  it('cuts the list at 50,000 URLs', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockQuery.mockResolvedValue({ rows: [] })

    const { sitemap } = await readSitemap({ urls: Array.from({ length: 50_005 }, (_, index) => `/p${index}`) })

    expect(sitemap).toHaveLength(50_000)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('the cache', () => {
  const doc = (url: string) => [{ url }]

  it('reads once an hour, and a burst of requests shares one read', async () => {
    let now = 1_000
    const read = jest.fn().mockResolvedValue({ sitemap: doc('a'), failed: false })
    const sitemap = createSitemapRoute({}, read, () => now)

    await Promise.all([sitemap(), sitemap(), sitemap()])
    now += 59 * 60 * 1000
    await sitemap()
    expect(read).toHaveBeenCalledTimes(1)

    now += 2 * 60 * 1000
    await sitemap()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('tries again after a minute when an entity could not be read', async () => {
    let now = 0
    const read = jest.fn().mockResolvedValue({ sitemap: doc('partial'), failed: true })
    const sitemap = createSitemapRoute({}, read, () => now)

    await sitemap()
    now += 30_000
    await sitemap()
    expect(read).toHaveBeenCalledTimes(1)
    now += 31_000
    await sitemap()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('keeps serving the last good document when a refresh fails, and fails when there is none', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    let now = 0
    const read = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ sitemap: doc('good'), failed: false }).mockRejectedValue(new Error('down'))
    const sitemap = createSitemapRoute({}, read, () => now)

    await expect(sitemap()).rejects.toThrow('down')
    await expect(sitemap()).resolves.toEqual(doc('good'))
    now += 2 * 60 * 60 * 1000
    await expect(sitemap()).resolves.toEqual(doc('good'))
    error.mockRestore()
  })

  it('passes the options it was made with to the read', async () => {
    const read = jest.fn().mockResolvedValue({ sitemap: [], failed: false })
    const options = { staticPaths: ['/support'], urls: ['/pricing'], exclude: ['/legal/*'] }

    await createSitemapRoute(options, read)()

    expect(read).toHaveBeenCalledWith(options)
  })
})
