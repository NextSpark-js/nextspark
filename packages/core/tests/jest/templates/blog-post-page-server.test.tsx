/**
 * @jest-environment node
 *
 * Blog public post page: it is a server component, so the HTML carries the post, the metadata is the post's, and a slug
 * with no published post is a real notFound() (#493). As a client component it fetched in an effect: the server HTML
 * was empty and an unknown slug answered like an existing one.
 */
import { Suspense, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

class NotFound extends Error {}
jest.mock('next/navigation', () => ({ notFound: () => { throw new NotFound('NEXT_NOT_FOUND') } }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))
// sanitize-html is ESM, which this jest cannot load; what it removes is tested in tests/node/block-html-sanitizing.test.ts
const sanitizeBlockHtml = jest.fn((html: string) => html.replace(/<script[\s\S]*?<\/script>/g, ''))
jest.mock('@nextsparkjs/core/lib/blocks/sanitize-html', () => ({ sanitizeBlockHtml: (html: string) => sanitizeBlockHtml(html) }))
jest.mock('@nextsparkjs/core/lib/seo/page-metadata', () => ({
  pageMetadata: (m: { title: string; description: string; path: string }) => ({ title: m.title, description: m.description, alternates: { canonical: m.path } }),
}))
// the old client page's own import: lets the suite reach its assertions
jest.mock('@/lib/sanitize-post-html', () => ({ sanitizePostHtml: (html: string) => html }), { virtual: true })
jest.mock('@/lib/article-css', () => ({ ARTICLE_CSS: '.article-content{margin:0}' }), { virtual: true })
jest.mock('@/components/public/ReadingProgress', () => ({ ReadingProgress: () => null }), { virtual: true })
jest.mock('@/components/public/PostDate', () => ({ PostDate: ({ value }: { value: string }) => <time>date:{value}</time> }), { virtual: true })
jest.mock('@/components/public/AuthorBio', () => ({ AuthorBio: () => null }), { virtual: true })
jest.mock('@/components/public/RelatedPosts', () => ({ RelatedPosts: ({ posts }: { posts: { title: string }[] }) => <ul>{posts.map(p => <li key={p.title}>{p.title}</li>)}</ul> }), { virtual: true })

const getPublishedPostBySlug = jest.fn()
const getRelatedPosts = jest.fn()
jest.mock('@/lib/public-posts', () => ({
  getPublishedPostBySlug: (slug: string) => getPublishedPostBySlug(slug),
  getRelatedPosts: (id: string) => getRelatedPosts(id),
}), { virtual: true })

import PostPage, * as postPage from '../../../templates/projects/blog/templates/(public)/posts/[slug]/page'

const post = {
  id: 'p1',
  title: 'A post about caching',
  slug: 'a-post-about-caching',
  content: '<p>The body of the post.</p><script>globalThis.pwned = 1</script>',
  excerpt: 'Why caching matters',
  featuredImage: null,
  category: null,
  publishedAt: '2026-01-02T00:00:00.000Z',
  createdAt: '2025-12-30T00:00:00.000Z',
}

beforeEach(() => {
  getPublishedPostBySlug.mockReset().mockImplementation(async (slug: string) => (slug === post.slug ? post : null))
  getRelatedPosts.mockReset().mockResolvedValue([{ id: 'p2', title: 'Another post', slug: 'another', featuredImage: null, content: null }])
})

const params = (slug: string) => Promise.resolve({ slug })

/**
 * The page awaits `params` behind a Suspense boundary of its own (Cache Components: without it the dev server reports
 * runtime data outside <Suspense> and a navigation to a post waits for the request). Renders what is inside it.
 */
async function renderPost(slug: string) {
  const page = PostPage({ params: params(slug) }) as ReactElement<{ children: ReactElement<{ params: Promise<{ slug: string }> }> }>
  expect(page.type).toBe(Suspense)
  const post = page.props.children
  return (post.type as (props: typeof post.props) => Promise<ReactElement>)(post.props)
}

test('is not a client component', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const source = require('fs').readFileSync(require.resolve('../../../templates/projects/blog/templates/(public)/posts/[slug]/page.tsx'), 'utf8')
  expect(source).not.toMatch(/^\s*['"]use client['"]/m)
})

test('the server render carries the title, the body and the related posts, with the body sanitised', async () => {
  const html = renderToStaticMarkup(await renderPost(post.slug))
  expect(html).toContain('A post about caching')
  expect(html).toContain('The body of the post.')
  expect(html).toContain('Another post')
  expect(sanitizeBlockHtml).toHaveBeenCalledWith(post.content)
  expect(html).not.toContain('<script')
})

test('the category is shown as text, not as a link to a page the template does not have (#511)', async () => {
  getPublishedPostBySlug.mockResolvedValue({ ...post, category: 'Technology' })
  const html = renderToStaticMarkup(await renderPost(post.slug))
  expect(html).toContain('>Technology</span>')
  expect(html).not.toContain('/category/')
})

test('a markdown body gets its headings, paragraphs, code and lists, with the items inside their list (#512)', async () => {
  const markdown = '# Title\n\nIntro with **bold** and `a<b>`.\n\n## Points\n\n- one\n- two\n\n1. first\n2. second\n\n```ts\nconst x = 1 < 2\n```\n\nThe end.'
  getPublishedPostBySlug.mockResolvedValue({ ...post, content: markdown })
  await renderPost(post.slug)
  expect(sanitizeBlockHtml).toHaveBeenLastCalledWith(
    '<h1>Title</h1><p>Intro with <strong>bold</strong> and <code>a&lt;b&gt;</code>.</p><h2>Points</h2>' +
      '<ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol><pre><code>const x = 1 &lt; 2</code></pre><p>The end.</p>',
  )
})

test('the post page carries the article styles inline, and imports no stylesheet that a link to a post would preload (#552)', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const source = require('fs').readFileSync(require.resolve('../../../templates/projects/blog/templates/(public)/posts/[slug]/page.tsx'), 'utf8')
  expect(source).not.toMatch(/^import '.*\.css'$/m)
  expect(renderToStaticMarkup(await renderPost(post.slug))).toContain('<style>.article-content{margin:0}</style>')
})

test('the inline article styles are the rules of .article-content, with no stylesheet file left behind (#552)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync, existsSync } = require('fs')
  const css = readFileSync(require.resolve('../../../templates/projects/blog/lib/article-css.ts'), 'utf8')
  expect(css).toContain('export const ARTICLE_CSS')
  expect(css).toContain('.article-content h2')
  expect(existsSync(require.resolve('../../../templates/projects/blog/package.json').replace('package.json', 'styles/article.css'))).toBe(false)
})

test('a post published without a date shows its creation date instead of a placeholder (#542)', async () => {
  expect(renderToStaticMarkup(await renderPost(post.slug))).toContain('date:2026-01-02T00:00:00.000Z')
  getPublishedPostBySlug.mockResolvedValue({ ...post, publishedAt: null })
  expect(renderToStaticMarkup(await renderPost(post.slug))).toContain('date:2025-12-30T00:00:00.000Z')
})

test('a slug with no published post is a notFound(), and the related posts are not read', async () => {
  await expect(renderPost('does-not-exist')).rejects.toBeInstanceOf(NotFound)
  expect(getRelatedPosts).not.toHaveBeenCalled()
})

test('generateMetadata gives the post its own title and description', async () => {
  const metadata = await postPage.generateMetadata({ params: params(post.slug) })
  expect(metadata).toMatchObject({ title: 'A post about caching', description: 'Why caching matters' })
})

test('generateMetadata of an unknown slug is not indexed', async () => {
  const metadata = await postPage.generateMetadata({ params: params('does-not-exist') })
  expect(metadata.robots).toMatchObject({ index: false })
})
