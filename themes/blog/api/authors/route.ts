/**
 * Authors List API Endpoint (Blog Theme)
 *
 * Returns list of all authors with published posts.
 * NO authentication required.
 *
 * URL: /api/v1/theme/blog/authors
 */

import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

interface AuthorWithCount {
  id: string
  name: string | null
  username: string | null
  bio: string | null
  image: string | null
  postCount: number
}

const getHandler = async (request: NextRequest) => {
  try {
    // Get all authors who have at least one published post
    const authorsQuery = `
      SELECT
        u.id,
        u.name,
        u.username,
        u.bio,
        u.image,
        COUNT(p.id)::integer as "postCount"
      FROM users u
      INNER JOIN posts p ON p."userId" = u.id
      WHERE u.username IS NOT NULL
        AND p.status = 'published'
        AND p."publishedAt" <= NOW()
      GROUP BY u.id, u.name, u.username, u.bio, u.image
      HAVING COUNT(p.id) > 0
      ORDER BY COUNT(p.id) DESC, u.name ASC
    `

    const authors = await queryWithRLS<AuthorWithCount>(authorsQuery, [])

    return NextResponse.json({
      success: true,
      data: authors
    })

  } catch (error) {
    console.error(`[API] /api/v1/theme/blog/authors - Error:`, error)

    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === 'production'
          ? 'An error occurred while fetching authors'
          : (error as Error).message
      },
      { status: 500 }
    )
  }
}

export const GET = withRateLimitTier(getHandler, 'read')
