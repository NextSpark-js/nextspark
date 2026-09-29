import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { POSTS, findPost } from '@/lib/posts'

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return POSTS.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = findPost((await params).slug)
  return { title: post ? post.title : 'Post not found' }
}

export default async function PostPage({ params }: Props) {
  const post = findPost((await params).slug)
  if (!post) notFound()
  return <h1 data-probe={`post-${post.slug}`}>{post.title}</h1>
}
