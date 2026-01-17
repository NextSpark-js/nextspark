/**
 * Public Posts API Endpoint (Blog Theme)
 *
 * Returns published posts from ALL authors for the public feed.
 * NO authentication required.
 * NO team_id filtering - shows posts cross-team.
 *
 * URL: /api/v1/theme/blog/posts/public
 */

import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  featuredImage: string | null
  status: string
  publishedAt: string | null
  featured: boolean
  createdAt: string
  updatedAt: string
  userId: string
  teamId: string
  // Author data
  authorName: string | null
  authorUsername: string | null
  authorImage: string | null
}

const getHandler = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)

    // Pagination parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100) // Max 100
    const offset = parseInt(searchParams.get('offset') || '0')

    // Filter parameters
    const category = searchParams.get('category') // Optional category filter

    // Build query
    let query = `
      SELECT
        p.id,
        p.title,
        p.slug,
        p.excerpt,
        p.content,
        p."featuredImage",
        p.status,
        p."publishedAt",
        p.featured,
        p."createdAt",
        p."updatedAt",
        p."userId",
        p."teamId",
        u.name as "authorName",
        u.username as "authorUsername",
        u.image as "authorImage"
      FROM posts p
      INNER JOIN users u ON p."userId" = u.id
      WHERE p.status = 'published'
        AND p."publishedAt" <= NOW()
    `

    const params: unknown[] = []
    let paramCount = 0

    // Add category filter if provided
    if (category) {
      paramCount++
      query += `
        AND EXISTS (
          SELECT 1 FROM post_categories pc
          INNER JOIN categories c ON pc."categoryId" = c.id
          WHERE pc."postId" = p.id
          AND c.slug = $${paramCount}
        )
      `
      params.push(category)
    }

    // Order by published date (newest first)
    query += ` ORDER BY p."publishedAt" DESC`

    // Add pagination
    paramCount++
    query += ` LIMIT $${paramCount}`
    params.push(limit)

    paramCount++
    query += ` OFFSET $${paramCount}`
    params.push(offset)

    // Execute query WITHOUT RLS context (public access)
    const posts = await queryWithRLS<Post>(query, params)

    // Get total count for pagination metadata
    let countQuery = `
      SELECT COUNT(*) as total
      FROM posts p
      WHERE p.status = 'published'
        AND p."publishedAt" <= NOW()
    `

    const countParams: unknown[] = []
    if (category) {
      countQuery += `
        AND EXISTS (
          SELECT 1 FROM post_categories pc
          INNER JOIN categories c ON pc."categoryId" = c.id
          WHERE pc."postId" = p.id
          AND c.slug = $1
        )
      `
      countParams.push(category)
    }

    const countResult = await queryWithRLS<{ total: string }>(countQuery, countParams)
    const total = parseInt(countResult[0]?.total || '0')

    // Return response with pagination metadata
    return NextResponse.json({
      success: true,
      data: posts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + posts.length < total
      }
    })

  } catch (error) {
    console.error('[API] /api/v1/theme/blog/posts/public - Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === 'production'
          ? 'An error occurred while fetching posts'
          : (error as Error).message
      },
      { status: 500 }
    )
  }
}

export const GET = withRateLimitTier(getHandler, 'read')
