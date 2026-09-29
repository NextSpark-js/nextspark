import type { MetadataRoute } from 'next'
import { POSTS } from '@/lib/posts'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://fixture.invalid/', changeFrequency: 'weekly' },
    ...POSTS.map(post => ({ url: `https://fixture.invalid/posts/${post.slug}` })),
  ]
}
