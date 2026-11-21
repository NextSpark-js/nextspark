/**
 * @jest-environment node
 *
 * Blog request hook: `/posts/<slug>` of a post that is not published is rewritten to the path no route matches, so it
 * answers a 404 (under Cache Components the page's notFound() arrives after the 200 is sent) (#493).
 */
import type { NextRequest } from 'next/server'

jest.mock('next/server', () => ({
  NextResponse: {
    rewrite: (url: { pathname: string }) => ({ rewrittenTo: url.pathname }),
    redirect: (url: { pathname: string }, status: number) => ({ redirectedTo: url.pathname, status }),
  },
}))
const queryWithRLS = jest.fn()
jest.mock('@nextsparkjs/core/lib/db', () => ({ queryWithRLS: (...args: unknown[]) => queryWithRLS(...args) }))
jest.mock('@nextsparkjs/registries/root-files', () => ({ NOT_FOUND_REWRITE: { path: '/_ns/not-found' } }), { virtual: true })

import { proxyHook } from '../../../templates/projects/blog/config/hooks/proxy'

const get = (pathname: string) => proxyHook({ nextUrl: { pathname, clone: () => ({ pathname }) } } as unknown as NextRequest)
const rewriteOf = (response: unknown) => (response as { rewrittenTo?: string } | null)?.rewrittenTo ?? null

beforeEach(() => queryWithRLS.mockReset())

test('a published post passes', async () => {
  queryWithRLS.mockResolvedValue([{ slug: 'a-post' }])
  expect(await get('/posts/a-post')).toBeNull()
  expect(queryWithRLS.mock.calls[0][1]).toEqual(['a-post'])
  // the mock cannot filter: the SQL has to ask for published posts whose date has come
  expect(queryWithRLS.mock.calls[0][0]).toContain("status = 'published'")
  expect(queryWithRLS.mock.calls[0][0]).toContain('"publishedAt" <= NOW()')
})

test('the id of a published post redirects to its slug, the URL of its page (the archive cards link by id, #540)', async () => {
  queryWithRLS.mockResolvedValue([{ slug: 'a post' }])
  expect(await get('/posts/post-1')).toEqual({ redirectedTo: '/posts/a%20post', status: 308 })
  expect(queryWithRLS.mock.calls[0][0]).toContain('(slug = $1 OR id = $1)')
  expect(queryWithRLS.mock.calls[0][1]).toEqual(['post-1'])
})

test('a slug with no published post is rewritten to the not-found path', async () => {
  queryWithRLS.mockResolvedValue([])
  expect(rewriteOf(await get('/posts/no-existe'))).toBe('/_ns/not-found')
})

test('a malformed escape is a missing post, without reading the database', async () => {
  expect(rewriteOf(await get('/posts/%E0%A4%A'))).toBe('/_ns/not-found')
  expect(queryWithRLS).not.toHaveBeenCalled()
})

test('a failed read leaves the answer to the page', async () => {
  queryWithRLS.mockRejectedValue(new Error('down'))
  jest.spyOn(console, 'error').mockImplementation(() => {})
  expect(await get('/posts/a-post')).toBeNull()
})

test('other paths are not touched', async () => {
  expect(await get('/authors')).toBeNull()
  expect(await get('/posts')).toBeNull()
  expect(queryWithRLS).not.toHaveBeenCalled()
})
