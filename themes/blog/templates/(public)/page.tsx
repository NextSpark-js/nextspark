'use client'

/**
 * Blog Home Page
 *
 * Modern blog homepage with featured post hero, posts grid,
 * and category filter tabs.
 *
 * Fetches real posts from the API - featured posts for the homepage display.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PostCard } from '@/themes/blog/components/public/PostCard'
import { cn } from '@nextsparkjs/core/lib/utils'
import { Loader2 } from 'lucide-react'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  featuredImage: string | null
  category: string | null
  status: string
  featured: boolean
  publishedAt: string | null
  createdAt: string
  // Author data (flat fields from API)
  authorName: string | null
  authorUsername: string | null
  authorImage: string | null
}

// Categories matching sample data (from 999_sample_data.sql)
const CATEGORIES = [
  { name: 'All', slug: 'all' },
  // Marcos's categories
  { name: 'AI', slug: 'ai' },
  { name: 'SaaS', slug: 'saas' },
  { name: 'Startups', slug: 'startups' },
  // Lucia's categories
  { name: 'Travel', slug: 'travel' },
  { name: 'Remote Work', slug: 'remote-work' },
  { name: 'Lifestyle', slug: 'lifestyle' },
  // Carlos's categories
  { name: 'Investing', slug: 'investing' },
  { name: 'Personal Finance', slug: 'personal-finance' },
  { name: 'Entrepreneurship', slug: 'entrepreneurship' },
]

export default function BlogHomePage() {
  const t = useTranslations('blog')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [visibleCount, setVisibleCount] = useState(6)

  // Fetch public posts from API
  const fetchFeaturedPosts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch published posts from ALL authors via public endpoint
      // This endpoint does not require authentication and aggregates posts cross-team
      const response = await fetch('/api/v1/theme/blog/posts/public?limit=20', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch posts')
      }

      const result = await response.json()
      setPosts(result.data || [])
    } catch (err) {
      console.error('Error fetching posts:', err)
      setError('Unable to load posts. Please try again later.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeaturedPosts()
  }, [fetchFeaturedPosts])

  // Filter posts by category
  const filteredPosts = activeCategory === 'all'
    ? posts
    : posts.filter(post => post.category === activeCategory)

  const featuredPost = filteredPosts[0]
  const remainingPosts = filteredPosts.slice(1, visibleCount)
  const hasMore = filteredPosts.length > visibleCount

  const loadMore = () => {
    setVisibleCount(prev => prev + 6)
  }

  // Calculate reading time (rough estimate: 200 words per minute)
  const calculateReadingTime = (content: string | null): number => {
    if (!content) return 3
    const wordCount = content.split(/\s+/).length
    return Math.max(1, Math.ceil(wordCount / 200))
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <section className="text-center py-12 mb-8">
        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          {t('publicFeed.title')}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {t('publicFeed.subtitle')}
        </p>
      </section>

      {/* Category Filter */}
      <section className="mb-8">
        <div className="flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map((category) => (
            <button
              key={category.slug}
              onClick={() => {
                setActiveCategory(category.slug)
                setVisibleCount(6)
              }}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-full transition-all duration-200',
                activeCategory === category.slug
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-16">
          <h3 className="text-xl font-medium text-muted-foreground mb-2">
            {error}
          </h3>
          <button
            onClick={fetchFeaturedPosts}
            className="mt-4 px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* No Posts State */}
      {!loading && !error && filteredPosts.length === 0 && (
        <div className="text-center py-16">
          <h3 className="text-xl font-medium text-muted-foreground mb-2">
            {t('publicFeed.noResults')}
          </h3>
          <p className="text-muted-foreground">
            {activeCategory === 'all'
              ? t('noPostsDescription')
              : t('category.noResults')}
          </p>
        </div>
      )}

      {/* Posts Content */}
      {!loading && !error && filteredPosts.length > 0 && (
        <>
          {/* Featured Post */}
          {featuredPost && (
            <section className="mb-12">
              <PostCard
                id={featuredPost.id}
                title={featuredPost.title}
                slug={featuredPost.slug}
                excerpt={featuredPost.excerpt}
                featuredImage={featuredPost.featuredImage}
                category={featuredPost.category}
                categorySlug={featuredPost.category?.toLowerCase().replace(/\s+/g, '-') || null}
                authorName={featuredPost.authorName || 'Anonymous'}
                authorUsername={featuredPost.authorUsername || undefined}
                authorAvatar={featuredPost.authorImage || undefined}
                publishedAt={featuredPost.publishedAt || featuredPost.createdAt}
                readingTime={calculateReadingTime(featuredPost.excerpt)}
                variant="featured"
              />
            </section>
          )}

          {/* Posts Grid */}
          {remainingPosts.length > 0 && (
            <section className="mb-12">
              <h2 className="font-serif text-2xl font-bold mb-6">{t('publicFeed.recentPosts')}</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {remainingPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    id={post.id}
                    title={post.title}
                    slug={post.slug}
                    excerpt={post.excerpt}
                    featuredImage={post.featuredImage}
                    category={post.category}
                    categorySlug={post.category?.toLowerCase().replace(/\s+/g, '-') || null}
                    authorName={post.authorName || 'Anonymous'}
                    authorUsername={post.authorUsername || undefined}
                    authorAvatar={post.authorImage || undefined}
                    publishedAt={post.publishedAt || post.createdAt}
                    readingTime={calculateReadingTime(post.excerpt)}
                    variant="default"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="text-center py-8">
              <button
                onClick={loadMore}
                className="px-8 py-3 text-sm font-medium bg-muted hover:bg-muted/80 text-foreground rounded-full transition-colors"
              >
                {t('publicFeed.loadMore')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Newsletter CTA */}
      <section className="my-16 p-8 md:p-12 rounded-2xl bg-muted/50 border border-border text-center">
        <h2 className="font-serif text-2xl md:text-3xl font-bold mb-3">
          {t('newsletter.title')}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          {t('newsletter.description')}
        </p>
        <form
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            placeholder={t('newsletter.placeholder')}
            className="flex-1 px-4 py-3 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="px-6 py-3 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t('newsletter.subscribe')}
          </button>
        </form>
      </section>
    </div>
  )
}
