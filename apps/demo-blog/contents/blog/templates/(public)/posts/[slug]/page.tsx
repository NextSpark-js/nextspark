'use client'

/**
 * Blog Post Page
 *
 * Clean, minimal single post view with reading progress bar,
 * centered content, and optimized typography.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Calendar, Clock, Loader2, Share2, Bookmark } from 'lucide-react'
import { use, useEffect, useState } from 'react'
import { ReadingProgress } from '@/themes/blog/components/public/ReadingProgress'
import { AuthorBio } from '@/themes/blog/components/public/AuthorBio'
import { RelatedPosts } from '@/themes/blog/components/public/RelatedPosts'
import { Button } from '@nextsparkjs/core/components/ui/button'

interface Post {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  featuredImage: string | null
  status: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  category?: string | null
}

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

function getActiveTeamId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('activeTeamId')
}

function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  const teamId = getActiveTeamId()
  if (teamId) {
    headers['x-team-id'] = teamId
  }
  return headers
}

async function fetchPost(identifier: string): Promise<Post | null> {
  try {
    const headers = buildHeaders()

    const byIdResponse = await fetch(`/api/v1/posts?ids=${encodeURIComponent(identifier)}&status=published&limit=1`, {
      credentials: 'include',
      headers,
    })

    if (byIdResponse.ok) {
      const result = await byIdResponse.json()
      if (result.data && result.data.length > 0) {
        return result.data[0] as Post
      }
    }

    const bySlugResponse = await fetch(`/api/v1/posts?slug=${encodeURIComponent(identifier)}&status=published&limit=1`, {
      credentials: 'include',
      headers,
    })

    if (bySlugResponse.ok) {
      const result = await bySlugResponse.json()
      if (result.data && result.data.length > 0) {
        return result.data[0] as Post
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching post:', error)
    return null
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not published'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  })
}

function toISODateString(dateString: string | null): string {
  if (!dateString) return ''
  return new Date(dateString).toISOString()
}

function calculateReadTime(content: string): number {
  const wordsPerMinute = 200
  const text = content.replace(/<[^>]*>/g, '')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / wordsPerMinute))
}

function renderContent(content: string): string {
  if (!content) return ''

  if (content.includes('<h') || content.includes('<p>')) {
    return content
  }

  return content
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<)/, '<p>')
    .replace(/(?!>)$/, '</p>')
}

interface RelatedPost {
  id: string
  title: string
  slug: string
  featuredImage?: string | null
  content?: string | null
}

async function fetchRelatedPosts(currentPostId: string): Promise<RelatedPost[]> {
  try {
    const headers = buildHeaders()

    // Fetch latest published posts
    const response = await fetch('/api/v1/posts?status=published&limit=4&sortBy=publishedAt&sortOrder=desc', {
      credentials: 'include',
      headers,
    })

    if (!response.ok) return []

    const result = await response.json()
    const posts = (result.data || []) as RelatedPost[]

    // Filter out the current post and take first 3
    return posts
      .filter((p: RelatedPost) => p.id !== currentPostId)
      .slice(0, 3)
  } catch (error) {
    console.error('Error fetching related posts:', error)
    return []
  }
}

export default function PostPage({ params }: PageProps) {
  const { slug } = use(params)
  const [post, setPost] = useState<Post | null>(null)
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function loadPost() {
      setLoading(true)
      setError(false)

      const fetchedPost = await fetchPost(slug)

      if (!fetchedPost) {
        setError(true)
      } else {
        setPost(fetchedPost)

        // Fetch related posts after getting the current post
        const related = await fetchRelatedPosts(fetchedPost.id)
        setRelatedPosts(related)
      }

      setLoading(false)
    }

    loadPost()
  }, [slug])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !post) {
    notFound()
  }

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
          {post.category && (
            <Link
              href={`/category/${post.category.toLowerCase()}`}
              className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary mb-4 hover:bg-primary/20 transition-colors"
            >
              {post.category}
            </Link>
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
              <time dateTime={toISODateString(post.publishedAt)}>
                {formatDate(post.publishedAt)}
              </time>
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
                src={post.featuredImage}
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
        <div className="article-content">
          <div dangerouslySetInnerHTML={{ __html: renderContent(post.content) }} />
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
