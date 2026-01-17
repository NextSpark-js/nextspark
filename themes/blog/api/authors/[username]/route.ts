/**
 * Author Profile API Endpoint (Blog Theme)
 *
 * Returns public author profile with published posts.
 * NO authentication required.
 *
 * URL: /api/v1/theme/blog/authors/{username}
 */

import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

interface Author {
  id: string
  name: string | null
  username: string | null
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
  status: string
  publishedAt: string | null
  featured: boolean
  createdAt: string
}

interface RouteContext {
  params: Promise<{
    username: string
  }>
}

const getHandler = async (
  request: NextRequest,
  context: RouteContext
) => {
  try {
    const { username } = await context.params

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      )
    }

    // Get author profile
    const authorQuery = `
      SELECT
        id,
        name,
        username,
        bio,
        image,
        "social_twitter" as "socialTwitter",
        "social_linkedin" as "socialLinkedin",
        "social_website" as "socialWebsite"
      FROM users
      WHERE username = $1
    `

    const authors = await queryWithRLS<Author>(authorQuery, [username])

    if (authors.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Author not found' },
        { status: 404 }
      )
    }

    const author = authors[0]

    // Get author's published posts
    const postsQuery = `
      SELECT
        id,
        title,
        slug,
        excerpt,
        "featuredImage",
        status,
        "publishedAt",
        featured,
        "createdAt"
      FROM posts
      WHERE "userId" = $1
        AND status = 'published'
        AND "publishedAt" <= NOW()
      ORDER BY "publishedAt" DESC
      LIMIT 50
    `

    const posts = await queryWithRLS<Post>(postsQuery, [author.id])

    // Get post count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM posts
      WHERE "userId" = $1
        AND status = 'published'
        AND "publishedAt" <= NOW()
    `

    const countResult = await queryWithRLS<{ total: string }>(countQuery, [author.id])
    const totalPosts = parseInt(countResult[0]?.total || '0')

    // Return author profile with posts and stats
    return NextResponse.json({
      success: true,
      data: {
        author: {
          id: author.id,
          name: author.name,
          username: author.username,
          bio: author.bio,
          image: author.image,
          socialTwitter: author.socialTwitter,
          socialLinkedin: author.socialLinkedin,
          socialWebsite: author.socialWebsite
        },
        posts,
        stats: {
          totalPosts
        }
      }
    })

  } catch (error) {
    console.error(`[API] /api/v1/theme/blog/authors/[username] - Error:`, error)

    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === 'production'
          ? 'An error occurred while fetching author profile'
          : (error as Error).message
      },
      { status: 500 }
    )
  }
}

export const GET = withRateLimitTier(getHandler, 'read')
