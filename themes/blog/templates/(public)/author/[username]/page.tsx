'use client'

/**
 * Author Profile Page
 *
 * Public profile page for a blog author showing their bio, social links,
 * and all their published posts.
 */

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Twitter, Linkedin, Globe, User } from 'lucide-react'
import { PostCard } from '@/themes/blog/components/public/PostCard'
import { cn } from '@nextsparkjs/core/lib/utils'

interface Author {
  id: string
  name: string
  username: string
  bio: string | null
  image: string | null
  socialTwitter: string | null
  socialLinkedin: string | null
  socialWebsite: string | null
}

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  featuredImage: string | null
  category: string | null
  publishedAt: string | null
  createdAt: string
}

interface Stats {
  totalPosts: number
}

interface PageProps {
  params: Promise<{
    username: string
  }>
}

export default function AuthorPage({ params }: PageProps) {
  const { username } = use(params)
  const [author, setAuthor] = useState<Author | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAuthorData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/v1/theme/blog/authors/${username}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Author not found')
          }
          throw new Error('Failed to load author profile')
        }

        const result = await response.json()
        setAuthor(result.data.author)
        setPosts(result.data.posts || [])
        setStats(result.data.stats)
      } catch (err) {
        console.error('Error fetching author:', err)
        setError(err instanceof Error ? err.message : 'Unable to load author profile')
      } finally {
        setLoading(false)
      }
    }

    fetchAuthorData()
  }, [username])

  // Calculate reading time
  const calculateReadingTime = (content: string | null): number => {
    if (!content) return 3
    const wordCount = content.split(/\s+/).length
    return Math.max(1, Math.ceil(wordCount / 200))
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading author profile...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !author) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-2">Author Not Found</h2>
          <p className="text-muted-foreground mb-6">
            {error || 'The author you are looking for does not exist.'}
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Author Header */}
      <section className="py-12 border-b border-border">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {author.image ? (
              <Image
                src={author.image}
                alt={author.name}
                width={128}
                height={128}
                className="rounded-full"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <User className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">
              {author.name}
            </h1>
            <p className="text-muted-foreground mb-4">@{author.username}</p>

            {author.bio && (
              <p className="text-lg mb-6 leading-relaxed">{author.bio}</p>
            )}

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {author.socialTwitter && (
                <a
                  href={author.socialTwitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Twitter className="w-4 h-4" />
                  <span className="sr-only">Twitter</span>
                </a>
              )}
              {author.socialLinkedin && (
                <a
                  href={author.socialLinkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                  <span className="sr-only">LinkedIn</span>
                </a>
              )}
              {author.socialWebsite && (
                <a
                  href={author.socialWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  <span className="sr-only">Website</span>
                </a>
              )}
            </div>

            {/* Stats */}
            {stats && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm">
                <span className="font-semibold">{stats.totalPosts}</span>
                <span className="text-muted-foreground">
                  {stats.totalPosts === 1 ? 'published post' : 'published posts'}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Author's Posts */}
      <section className="py-12">
        <h2 className="font-serif text-2xl font-bold mb-8">Posts by {author.name}</h2>

        {posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No published posts yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                id={post.id}
                title={post.title}
                slug={post.slug}
                excerpt={post.excerpt}
                featuredImage={post.featuredImage}
                category={post.category}
                categorySlug={post.category?.toLowerCase().replace(/\s+/g, '-') || null}
                authorName={author.name}
                authorUsername={author.username}
                authorAvatar={author.image}
                publishedAt={post.publishedAt || post.createdAt}
                readingTime={calculateReadingTime(post.excerpt)}
                variant="default"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
