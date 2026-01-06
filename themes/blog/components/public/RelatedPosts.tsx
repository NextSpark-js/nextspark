'use client'

/**
 * Related Posts Component
 *
 * Displays a horizontal list of related posts from the same category.
 */

import Link from 'next/link'
import Image from 'next/image'
import { Clock } from 'lucide-react'

interface RelatedPost {
  id: string
  title: string
  slug: string
  featuredImage?: string | null
  readingTime?: number
}

interface RelatedPostsProps {
  posts: RelatedPost[]
  title?: string
}

export function RelatedPosts({
  posts,
  title = 'Related Articles'
}: RelatedPostsProps) {
  if (posts.length === 0) return null

  return (
    <section data-cy="related-posts" className="py-8">
      <h2 data-cy="related-posts-title" className="font-serif text-xl font-bold mb-6">{title}</h2>

      <div data-cy="related-posts-grid" className="grid gap-4 md:grid-cols-3">
        {posts.slice(0, 3).map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.slug || post.id}`}
            data-cy={`related-post-${post.id}`}
            className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card hover:shadow-md transition-all duration-200"
          >
            {/* Image */}
            <div data-cy={`related-post-image-${post.id}`} className="aspect-[16/9] relative overflow-hidden">
              {post.featuredImage ? (
                <Image
                  src={post.featuredImage}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
              )}
            </div>

            {/* Content */}
            <div data-cy={`related-post-content-${post.id}`} className="p-4">
              <h3 data-cy={`related-post-title-${post.id}`} className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                {post.title}
              </h3>
              {post.readingTime && (
                <div data-cy={`related-post-reading-time-${post.id}`} className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{post.readingTime} min read</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default RelatedPosts
