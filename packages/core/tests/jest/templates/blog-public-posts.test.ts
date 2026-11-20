/**
 * @jest-environment node
 *
 * Blog public post reads: the database is mocked, so the SQL is what is checked. Only a published post whose
 * publishedAt has come may reach a public page (#493).
 */
const queryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({ queryWithRLS: (...args: unknown[]) => queryWithRLS(...args) }))

import { getPublishedPostBySlug, getRelatedPosts } from '../../../templates/projects/blog/lib/public-posts'

beforeEach(() => queryWithRLS.mockReset().mockResolvedValue([]))

test('the post read asks for a published post whose date has come, by slug', async () => {
  expect(await getPublishedPostBySlug('a-post')).toBeNull()
  const [sql, params] = queryWithRLS.mock.calls[0]
  expect(sql).toContain("status = 'published'")
  expect(sql).toContain('"publishedAt" <= NOW()')
  expect(params).toEqual(['a-post'])
})

test('the related read asks for published posts whose date has come, other than the current one', async () => {
  await getRelatedPosts('p1')
  const [sql, params] = queryWithRLS.mock.calls[0]
  expect(sql).toContain("status = 'published'")
  expect(sql).toContain('"publishedAt" <= NOW()')
  expect(params).toEqual(['p1', 3])
})
