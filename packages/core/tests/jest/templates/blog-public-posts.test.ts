/**
 * @jest-environment node
 *
 * Blog public post reads: the database is mocked, so the SQL is what is checked. Only a published post whose
 * publishedAt has come may reach a public page (#493). Both reads are cached ('use cache', tag `entity:posts`, which
 * core expires on every write of a post): uncached, the post page could not be prerendered and the browser got a
 * hydration error (React #419) on every post.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const queryWithRLS = jest.fn()
const cacheTag = jest.fn()
const cacheLife = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({ queryWithRLS: (...args: unknown[]) => queryWithRLS(...args) }))
jest.mock('next/cache', () => ({ cacheTag: (...a: unknown[]) => cacheTag(...a), cacheLife: (...a: unknown[]) => cacheLife(...a) }))

import { getPublishedPostBySlug, getRelatedPosts } from '../../../templates/projects/blog/lib/public-posts'

beforeEach(() => {
  queryWithRLS.mockReset().mockResolvedValue([])
  cacheTag.mockReset()
  cacheLife.mockReset()
})

test('the post read asks for a published post whose date has come, by slug', async () => {
  expect(await getPublishedPostBySlug('a-post')).toBeNull()
  const [sql, params] = queryWithRLS.mock.calls[0]
  expect(sql).toContain("status = 'published'")
  expect(sql).toContain('("publishedAt" IS NULL OR "publishedAt" <= NOW())')
  expect(params).toEqual(['a-post'])
})

test('the related read asks for published posts whose date has come, other than the current one', async () => {
  await getRelatedPosts('p1')
  const [sql, params] = queryWithRLS.mock.calls[0]
  expect(sql).toContain("status = 'published'")
  expect(sql).toContain('("publishedAt" IS NULL OR "publishedAt" <= NOW())')
  expect(params).toEqual(['p1', 3])
})

test('a published post with no date is public now and sorts after the dated ones, as in core\'s public reads (#542)', async () => {
  await getPublishedPostBySlug('undated')
  await getRelatedPosts('p1')
  for (const [sql] of queryWithRLS.mock.calls) {
    expect(sql).toContain('"publishedAt" IS NULL OR')
    expect(sql).toContain('ORDER BY "publishedAt" DESC NULLS LAST')
  }
})

test('no public read of the blog template requires a date: every one lets an undated published post through (#542)', () => {
  const blog = join(__dirname, '../../../templates/projects/blog')
  const files = ['lib/public-posts.ts', 'config/hooks/proxy.ts', 'api/posts/public/route.ts', 'api/authors/route.ts', 'api/authors/[username]/route.ts', 'entities/posts/migrations/001_posts_table.sql']
  for (const file of files) {
    const source = readFileSync(join(blog, file), 'utf8')
    const dateRules = source.match(/(?:[a-z]\.)?"publishedAt" <= NOW\(\)/g) ?? []
    const withNull = source.match(/\((?:[a-z]\.)?"publishedAt" IS NULL OR (?:[a-z]\.)?"publishedAt" <= NOW\(\)\)/g) ?? []
    expect([file, dateRules.length]).toEqual([file, withNull.length])
    expect(dateRules.length).toBeGreaterThan(0)
    expect(source).not.toMatch(/ORDER BY (?:[a-z]\.)?"publishedAt" DESC(?! NULLS LAST)/)
  }
  // the request hook's single query (slug or id, for the 404 and the id-to-slug redirect of #540) is one of them
  const proxy = readFileSync(join(blog, 'config/hooks/proxy.ts'), 'utf8')
  expect(proxy).toMatch(/WHERE \(slug = \$1 OR id = \$1\) AND status = 'published' AND \("publishedAt" IS NULL OR "publishedAt" <= NOW\(\)\)/)
})

test('both reads are cached functions, tagged with the tag core expires when a post is written', async () => {
  const source = readFileSync(join(__dirname, '../../../templates/projects/blog/lib/public-posts.ts'), 'utf8')
  for (const name of ['getPublishedPostBySlug', 'getRelatedPosts']) {
    expect(source).toMatch(new RegExp(`export async function ${name}\\([^)]*\\)[^{]*\\{\\s*'use cache'\\n`))
  }
  await getPublishedPostBySlug('a-post')
  await getRelatedPosts('p1')
  expect(cacheTag.mock.calls).toEqual([['entity:posts'], ['entity:posts']])
  expect(cacheLife).toHaveBeenCalledTimes(2)
})

test('an argument that is not a plain value is not a cache key and reads nothing', async () => {
  expect(await getPublishedPostBySlug({} as never)).toBeNull()
  expect(await getPublishedPostBySlug('x'.repeat(201))).toBeNull()
  expect(await getRelatedPosts('p1', 10_000)).toEqual([])
  expect(queryWithRLS).not.toHaveBeenCalled()
})
