'use client'

/**
 * Author Card Component
 *
 * Displays author information in a card format with avatar, name, bio,
 * and post count. Can be used in different variants (full or compact).
 */

import Link from 'next/link'
import Image from 'next/image'
import { User } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

interface AuthorCardProps {
  username: string
  name: string
  bio?: string | null
  avatar?: string | null
  postCount: number
  variant?: 'full' | 'compact'
  className?: string
}

export function AuthorCard({
  username,
  name,
  bio,
  avatar,
  postCount,
  variant = 'full',
  className
}: AuthorCardProps) {
  const authorUrl = `/author/${username}`

  if (variant === 'compact') {
    return (
      <Link
        href={authorUrl}
        data-cy={`author-card-${username}`}
        data-cy-variant="compact"
        className={cn(
          'group flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:shadow-md transition-all duration-200',
          className
        )}
      >
        {/* Avatar */}
        <div data-cy={`author-card-avatar-${username}`} className="flex-shrink-0">
          {avatar ? (
            <Image
              src={avatar}
              alt={name}
              width={48}
              height={48}
              className="rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 data-cy={`author-card-name-${username}`} className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
            {name}
          </h3>
          <p data-cy={`author-card-post-count-${username}`} className="text-xs text-muted-foreground">
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </p>
        </div>
      </Link>
    )
  }

  // Full variant
  return (
    <Link
      href={authorUrl}
      data-cy={`author-card-${username}`}
      data-cy-variant="full"
      className={cn(
        'group block p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-all duration-300',
        className
      )}
    >
      {/* Avatar */}
      <div data-cy={`author-card-avatar-${username}`} className="flex justify-center mb-4">
        {avatar ? (
          <Image
            src={avatar}
            alt={name}
            width={96}
            height={96}
            className="rounded-full"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <User className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Name */}
      <h3 data-cy={`author-card-name-${username}`} className="font-serif text-xl font-bold text-center mb-2 group-hover:text-primary transition-colors">
        {name}
      </h3>

      {/* Bio */}
      {bio && (
        <p data-cy={`author-card-bio-${username}`} className="text-sm text-muted-foreground text-center mb-4 line-clamp-2">
          {bio}
        </p>
      )}

      {/* Post Count */}
      <div data-cy={`author-card-post-count-${username}`} className="text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-xs">
          <span className="font-semibold">{postCount}</span>
          <span className="text-muted-foreground">
            {postCount === 1 ? 'published post' : 'published posts'}
          </span>
        </span>
      </div>
    </Link>
  )
}

export default AuthorCard
