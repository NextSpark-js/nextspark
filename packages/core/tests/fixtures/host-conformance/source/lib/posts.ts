export type Post = { slug: string; title: string }

export const POSTS: Post[] = [
  { slug: 'hello', title: 'Hello post' },
  { slug: 'world', title: 'World post' },
]

export function findPost(slug: string): Post | undefined {
  return POSTS.find(post => post.slug === slug)
}
