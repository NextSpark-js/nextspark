'use client'

/**
 * Post Card Component
 *
 * Blog-style post card with featured image, category badge,
 * title, excerpt, author info, and reading time.
 */

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, User } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

interface PostCardProps {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  featuredImage?: string | null
  category?: string | null
  categorySlug?: string | null
  authorName?: string
  authorUsername?: string
  authorAvatar?: string | null
  publishedAt?: string | null
  readingTime?: number
  variant?: 'default' | 'featured' | 'compact'
  className?: string
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Draft'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  })
}

export function PostCard({
  id,
  title,
  slug,
  excerpt,
  featuredImage,
  category,
  categorySlug,
  authorName = 'Anonymous',
  authorUsername,
  authorAvatar,
  publishedAt,
  readingTime = 5,
  variant = 'default',
  className
}: PostCardProps) {
  const postUrl = `/posts/${slug || id}`
  const authorUrl = authorUsername ? `/author/${authorUsername}` : undefined

  if (variant === 'featured') {
    return (
      <article
        data-cy={`post-card-${id}`}
        data-cy-variant="featured"
        className={cn(
          'group relative overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:shadow-lg',
          className
        )}
      >
        {/* Featured Image */}
        <div data-cy={`post-card-image-${id}`} className="aspect-[21/9] relative overflow-hidden">
          {featuredImage ? (
            <Image
              src={featuredImage}
              alt={title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
          )}
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
        </div>

        {/* Content */}
        <div data-cy={`post-card-content-${id}`} className="absolute bottom-0 left-0 right-0 p-6">
          {category && (
            <Link
              href={categorySlug ? `/category/${categorySlug}` : '#'}
              data-cy={`post-card-category-${id}`}
              className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-primary text-primary-foreground mb-3 hover:bg-primary/90 transition-colors"
            >
              {category}
            </Link>
          )}

          <Link href={postUrl} data-cy={`post-card-title-link-${id}`}>
            <h2 data-cy={`post-card-title-${id}`} className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </h2>
          </Link>

          {excerpt && (
            <p data-cy={`post-card-excerpt-${id}`} className="text-muted-foreground line-clamp-2 mb-4">
              {excerpt}
            </p>
          )}

          <div data-cy={`post-card-meta-${id}`} className="flex items-center gap-4 text-sm text-muted-foreground">
            {authorUrl ? (
              <Link href={authorUrl} data-cy={`post-card-author-${id}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
                {authorAvatar ? (
                  <Image
                    src={authorAvatar}
                    alt={authorName}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-3 h-3" />
                  </div>
                )}
                <span>{authorName}</span>
              </Link>
            ) : (
              <div data-cy={`post-card-author-${id}`} className="flex items-center gap-2">
                {authorAvatar ? (
                  <Image
                    src={authorAvatar}
                    alt={authorName}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-3 h-3" />
                  </div>
                )}
                <span>{authorName}</span>
              </div>
            )}
            <span data-cy={`post-card-date-${id}`} className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(publishedAt)}
            </span>
            <span data-cy={`post-card-reading-time-${id}`} className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {readingTime} min read
            </span>
          </div>
        </div>
      </article>
    )
  }

  if (variant === 'compact') {
    return (
      <article
        data-cy={`post-card-${id}`}
        data-cy-variant="compact"
        className={cn(
          'group flex gap-4 p-4 rounded-lg border border-border bg-card hover:shadow-md transition-all duration-200',
          className
        )}
      >
        {/* Thumbnail */}
        <div data-cy={`post-card-image-${id}`} className="flex-shrink-0 w-24 h-24 relative overflow-hidden rounded-md">
          {featuredImage ? (
            <Image
              src={featuredImage}
              alt={title}
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
          )}
        </div>

        {/* Content */}
        <div data-cy={`post-card-content-${id}`} className="flex-1 min-w-0">
          <Link href={postUrl} data-cy={`post-card-title-link-${id}`}>
            <h3 data-cy={`post-card-title-${id}`} className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </h3>
          </Link>
          <div data-cy={`post-card-meta-${id}`} className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span data-cy={`post-card-date-${id}`}>{formatDate(publishedAt)}</span>
            <span>·</span>
            <span data-cy={`post-card-reading-time-${id}`}>{readingTime} min</span>
          </div>
        </div>
      </article>
    )
  }

  // Default variant
  return (
    <article
      data-cy={`post-card-${id}`}
      data-cy-variant="default"
      className={cn(
        'group overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
        className
      )}
    >
      {/* Featured Image */}
      <div data-cy={`post-card-image-${id}`} className="aspect-[16/10] relative overflow-hidden">
        {featuredImage ? (
          <Image
            src={featuredImage}
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5" />
        )}
      </div>

      {/* Content */}
      <div data-cy={`post-card-content-${id}`} className="p-5">
        {category && (
          <Link
            href={categorySlug ? `/category/${categorySlug}` : '#'}
            data-cy={`post-card-category-${id}`}
            className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-primary/10 text-primary mb-3 hover:bg-primary/20 transition-colors"
          >
            {category}
          </Link>
        )}

        <Link href={postUrl} data-cy={`post-card-title-link-${id}`}>
          <h3 data-cy={`post-card-title-${id}`} className="font-serif text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
        </Link>

        {excerpt && (
          <p data-cy={`post-card-excerpt-${id}`} className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {excerpt}
          </p>
        )}

        <div data-cy={`post-card-meta-${id}`} className="flex items-center justify-between text-xs text-muted-foreground">
          {authorUrl ? (
            <Link href={authorUrl} data-cy={`post-card-author-${id}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
              {authorAvatar ? (
                <Image
                  src={authorAvatar}
                  alt={authorName}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-2.5 h-2.5" />
                </div>
              )}
              <span>{authorName}</span>
            </Link>
          ) : (
            <div data-cy={`post-card-author-${id}`} className="flex items-center gap-2">
              {authorAvatar ? (
                <Image
                  src={authorAvatar}
                  alt={authorName}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-2.5 h-2.5" />
                </div>
              )}
              <span>{authorName}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span data-cy={`post-card-date-${id}`} className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(publishedAt)}
            </span>
            <span data-cy={`post-card-reading-time-${id}`} className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {readingTime} min
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

export default PostCard
