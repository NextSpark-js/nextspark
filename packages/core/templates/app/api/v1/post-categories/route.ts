import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { query as dbQuery } from '@nextsparkjs/core/lib/db'
import { z } from 'zod'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes').optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().optional(),
  order: z.number().int().default(0),
  isDefault: z.boolean().default(false)
})

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Replace spaces with dashes
    .replace(/-+/g, '-')           // Replace multiple dashes with single
    .replace(/^-|-$/g, '')         // Remove leading/trailing dashes
}

// GET /api/v1/post-categories - List categories (filters taxonomies by type = 'post_category')
export const GET = withRateLimitTier(async () => {
  try {
    const result = await dbQuery(
      `SELECT id, name, slug, description, icon, color, "parentId", "order", "isDefault", "isActive",
              "createdAt", "updatedAt"
       FROM taxonomies
       WHERE type = 'post_category' AND "deletedAt" IS NULL AND "isActive" = true
       ORDER BY "order" ASC, name ASC`
    )

    return NextResponse.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching post categories:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}, 'read');

// POST /api/v1/post-categories - Create category
export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    // Dual authentication: API key or session
    const authResult = await authenticateRequest(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createCategorySchema.parse(body)

    // Auto-generate slug if not provided
    const slug = data.slug || generateSlug(data.name)

    // Check slug uniqueness for this taxonomy type
    const existing = await dbQuery(
      'SELECT id FROM taxonomies WHERE type = \'post_category\' AND slug = $1',
      [slug]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Slug already exists',
        message: `A category with slug "${slug}" already exists`
      }, { status: 400 })
    }

    // Verify parentId exists if provided
    if (data.parentId) {
      const parentCheck = await dbQuery(
        'SELECT id FROM taxonomies WHERE id = $1 AND type = \'post_category\'',
        [data.parentId]
      )
      if (parentCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Parent category not found'
        }, { status: 400 })
      }
    }

    // Insert category (type is hardcoded to 'post_category')
    const result = await dbQuery(
      `INSERT INTO taxonomies (
        type, slug, name, description, icon, color, "parentId", "order", "isDefault", "userId"
      ) VALUES ('post_category', $1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        slug,
        data.name,
        data.description || null,
        data.icon || null,
        data.color || null,
        data.parentId || null,
        data.order,
        data.isDefault,
        authResult.user.id
      ]
    )

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.issues }, { status: 400 })
    }
    console.error('Error creating post category:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}, 'write');
