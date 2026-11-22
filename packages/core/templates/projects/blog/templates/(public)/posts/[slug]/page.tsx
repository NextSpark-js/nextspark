/**
 * Blog Post Page
 *
 * Clean, minimal single post view with reading progress bar,
 * centered content, and optimized typography.
 *
 * Rendered on the server: the published post is read here, so the HTML carries its content and metadata,
 * and a slug with no published post is a not-found. Only the reading progress bar and the date (locale) are client islands.
 *
 * Cache Components: the post is read with cached functions (lib/public-posts.ts), and the part that awaits `params` is
 * behind its own Suspense boundary, so the layout shell is prerendered and a navigation to a post does not wait for
 * request data (#493). A slug with no published post never gets here: the request hook answers it with a 404.
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Calendar, Clock, Share2, Bookmark } from 'lucide-react'
import { sanitizeBlockHtml } from '@nextsparkjs/core/lib/blocks/sanitize-html'
import { pageMetadata } from '@nextsparkjs/core/lib/seo/page-metadata'
import { ARTICLE_CSS } from '@/lib/article-css'
import { getPublishedPostBySlug, getRelatedPosts } from '@/lib/public-posts'
import { ReadingProgress } from '@/components/public/ReadingProgress'
import { PostDate } from '@/components/public/PostDate'
import { AuthorBio } from '@/components/public/AuthorBio'
import { RelatedPosts } from '@/components/public/RelatedPosts'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { withBasePathIfInApp } from '@nextsparkjs/core/lib/base-path'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

function calculateReadTime(content: string): number {
  const wordsPerMinute = 200
  const text = content.replace(/<[^>]*>/g, '')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / wordsPerMinute))
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const renderInline = (text: string) =>
  text
    .replace(/`([^`]+)`/g, (_, code: string) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')

/**
 * The post body as HTML. HTML (what the editor saves) is used as it is; markdown (the sample posts) is converted
 * block by block: headings, fenced code, bulleted and numbered lists (their items inside `<ul>`/`<ol>`, #512) and
 * paragraphs. The result is sanitized by the caller.
 */
function renderContent(content: string): string {
  if (!content) return ''

  if (content.includes('<h') || content.includes('<p>')) {
    return content
  }

  const html: string[] = []
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null
  const flush = () => {
    if (paragraph.length) html.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
    if (list) html.push(`<${list.tag}>${list.items.map(item => `<li>${renderInline(item)}</li>`).join('')}</${list.tag}>`)
    paragraph = []
    list = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      flush()
      const code: string[] = []
      while (++i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i])
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      html.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`)
    } else if (bullet || numbered) {
      const tag = bullet ? 'ul' : 'ol'
      if (paragraph.length || (list && list.tag !== tag)) flush()
      list ??= { tag, items: [] }
      list.items.push((bullet ?? numbered)![1])
    } else if (!line.trim()) {
      flush()
    } else {
      if (list) flush()
      paragraph.push(line.trim())
    }
  }
  flush()
  return html.join('')
}

function postDescription(post: { excerpt: string | null; content: string }): string {
  if (post.excerpt) return post.excerpt
  const text = post.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 160 ? `${text.slice(0, 157)}...` : text
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedPostBySlug(slug)
  if (!post) return { title: 'Post not found', robots: { index: false } }
  return pageMetadata({ title: post.title, description: postDescription(post), path: `/posts/${encodeURIComponent(post.slug)}` })
}

export default function PostPage({ params }: PageProps) {
  return (
    <Suspense fallback={null}>
      <Post params={params} />
    </Suspense>
  )
}

async function Post({ params }: PageProps) {
  const { slug } = await params
  const post = await getPublishedPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const relatedPosts = await getRelatedPosts(post.id)

  const readTime = calculateReadTime(post.content)

  return (
    <>
      {/* Reading Progress Bar */}
      <ReadingProgress />

      <article className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        {/* Article Header */}
        <header className="mb-8 text-center">
          {/* Category */}
          {/* Text, not a link: the template has no category page, and the posts list has no category filter (#511) */}
          {post.category && (
            <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary mb-4">
              {post.category}
            </span>
          )}

          {/* Title */}
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
              {post.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <PostDate value={post.publishedAt ?? post.createdAt} />
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {readTime} min read
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Share2 className="w-4 h-4 mr-1.5" />
              Share
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Bookmark className="w-4 h-4 mr-1.5" />
              Save
            </Button>
          </div>
        </header>

        {/* Featured Image */}
        {post.featuredImage && (
          <figure className="mb-12">
            <div className="aspect-[21/9] relative overflow-hidden rounded-xl">
              <Image
                src={withBasePathIfInApp(post.featuredImage)}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 896px"
              />
            </div>
          </figure>
        )}

        {/* Article Content */}
        {/* The post body's typography, inline: a stylesheet import would be preloaded by every page that links to a post (#552) */}
        <style>{ARTICLE_CSS}</style>
        <div className="article-content">
          <div dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(renderContent(post.content)) }} />
        </div>

        {/* Divider */}
        <hr className="my-12 border-border" />

        {/* Author Bio */}
        <AuthorBio
          name="John Writer"
          bio="Full-stack developer and writer. Passionate about web technologies, open source, and sharing knowledge with the community."
          socialLinks={[
            { type: 'twitter', url: 'https://twitter.com' },
            { type: 'github', url: 'https://github.com' }
          ]}
        />

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-12">
            <RelatedPosts
              posts={relatedPosts.map(p => ({
                id: p.id,
                title: p.title,
                slug: p.slug,
                featuredImage: p.featuredImage,
                readingTime: p.content ? calculateReadTime(p.content) : 5,
              }))}
              title="You might also like"
            />
          </div>
        )}

        {/* Bottom Navigation */}
        <nav className="mt-12 pt-8 border-t border-border flex justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all posts
          </Link>
        </nav>
      </article>
    </>
  )
}
