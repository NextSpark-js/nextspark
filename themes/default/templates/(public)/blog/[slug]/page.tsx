import { notFound } from 'next/navigation'
import { PageRenderer } from '@nextsparkjs/core/components/public/pageBuilder'
import { PostHeader } from '@/themes/default/entities/posts/components/post-header'
import { PostsService } from '@/themes/default/entities/posts/posts.service'
import type { Metadata } from 'next'

// Enable ISR with 1 hour revalidation
export const revalidate = 3600

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const metadata = await PostsService.getPublishedMetadata(resolvedParams.slug)

  if (!metadata) {
    return {
      title: 'Not Found'
    }
  }

  return {
    title: metadata.seoTitle || `${metadata.title} | Blog`,
    description: metadata.seoDescription || metadata.excerpt || undefined,
    openGraph: {
      title: metadata.seoTitle || metadata.title,
      description: metadata.seoDescription || metadata.excerpt || undefined,
      images: metadata.ogImage ? [metadata.ogImage] : metadata.featuredImage ? [metadata.featuredImage] : [],
      type: 'article',
    },
  }
}

async function BlogPostPage({ params }: PageProps) {
  const resolvedParams = await params
  const post = await PostsService.getPublishedBySlug(resolvedParams.slug)

  if (!post) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background py-8" data-cy="public-posts-page">
      {/* Post Header */}
      <PostHeader post={post} />

      {/* Post Content (Blocks) */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <PageRenderer
          page={{
            id: post.id,
            title: post.title,
            slug: post.slug,
            blocks: post.blocks,
            locale: 'en',
          }}
        />
      </div>
    </div>
  )
}

export default BlogPostPage
