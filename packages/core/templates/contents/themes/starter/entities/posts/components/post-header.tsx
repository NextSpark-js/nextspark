import { Badge } from '@nextsparkjs/core/components/ui/badge'
import Image from 'next/image'

interface Category {
  id: string
  name: string
  color?: string
}

interface PostHeaderProps {
  post: {
    title: string
    excerpt?: string
    featuredImage?: string
    createdAt: string
    categories?: Category[]
  }
}

export function PostHeader({ post }: PostHeaderProps) {
  return (
    <div className="w-full" data-cy="post-header">
      {/* Featured Image */}
      {post.featuredImage && (
        <div className="relative w-full h-[400px] md:h-[500px] mb-8" data-cy="post-featured-image-display">
          <Image
            src={post.featuredImage}
            alt={post.title}
            fill
            className="object-cover rounded-lg"
            priority
          />
        </div>
      )}

      {/* Post Meta */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        {/* Categories */}
        {post.categories && post.categories.length > 0 && (
          <div className="flex gap-2 mb-4" data-cy="post-categories-display">
            {post.categories.map((category) => (
              <Badge
                key={category.id}
                variant="outline"
                style={{
                  backgroundColor: category.color ? `${category.color}20` : undefined,
                  borderColor: category.color || undefined,
                  color: category.color || undefined,
                }}
              >
                {category.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Title */}
        <h1
          className="text-4xl md:text-5xl font-bold text-foreground mb-4"
          data-cy="post-title"
        >
          {post.title}
        </h1>

        {/* Excerpt */}
        {post.excerpt && (
          <p
            className="text-xl text-muted-foreground mb-4"
            data-cy="post-excerpt"
          >
            {post.excerpt}
          </p>
        )}

        {/* Date - using suppressHydrationWarning to prevent server/client mismatch */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <time
            dateTime={new Date(post.createdAt).toISOString()}
            suppressHydrationWarning
          >
            {new Date(post.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC',
            })}
          </time>
        </div>
      </div>

      {/* Separator */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <hr className="border-border mb-8" />
      </div>
    </div>
  )
}
