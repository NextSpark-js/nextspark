import { NextRequest, NextResponse } from 'next/server'
import { categoryReadTeam, categoryWriter, type CategoryWriter, type Refusal } from '@nextsparkjs/core/lib/api/post-categories'
import { query as dbQuery } from '@nextsparkjs/core/lib/db'
import * as z from 'zod'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'

const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes').optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().optional(),
  order: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
})

/** The post category `id` that `writer` may change: of their team, or (superadmin) without a team; else 404/403. */
async function findCategory(id: string, writer: CategoryWriter): Promise<{ teamId: string | null } | Refusal> {
  const found = await dbQuery<{ teamId: string | null }>(
    'SELECT "teamId" FROM taxonomies WHERE id = $1 AND type = \'post_category\' AND ("teamId" IS NULL OR "teamId" = $2)',
    [id, writer.teamId]
  )
  if (found.rows.length === 0) {
    return { response: NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 }) }
  }
  if (found.rows[0].teamId === null && !writer.superadmin) {
    return { response: NextResponse.json(
      { success: false, error: 'Only a superadmin can change a category shared by every team', code: 'PERMISSION_DENIED' },
      { status: 403 }
    ) }
  }
  return found.rows[0]
}

// GET /api/v1/post-categories/:id - Get category by ID (the caller's team's, or one without a team)
export const GET = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    const { id } = await params
    const scope = await categoryReadTeam(request)
    if ('response' in scope) return scope.response

    const result = await dbQuery(
      `SELECT id, name, slug, description, icon, color, "parentId", "order", "isDefault", "isActive",
              "createdAt", "updatedAt"
       FROM taxonomies
       WHERE id = $1 AND type = 'post_category' AND "deletedAt" IS NULL AND ("teamId" IS NULL OR "teamId" = $2)`,
      [id, scope.teamId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (err) {
    console.error('Error in post-categories API:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}, 'read');

// PUT /api/v1/post-categories/:id - Update category (one of the caller's team, with posts.update there; one
// without a team: superadmin only)
export const PUT = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    // Dual authentication (the API-key scope fails closed, #93), then the team-role permission.
    const writer = await categoryWriter(request, 'update')
    if ('response' in writer) return writer.response

    const body = await request.json()
    const data = updateCategorySchema.parse(body)
    const { id } = await params

    const row = await findCategory(id, writer)
    if ('response' in row) return row.response

    // Check slug uniqueness (in the category's team, or among the ones without a team) if slug is being updated
    if (data.slug) {
      const slugCheck = await dbQuery(
        'SELECT id FROM taxonomies WHERE type = \'post_category\' AND slug = $1 AND id != $2 AND "teamId" IS NOT DISTINCT FROM $3',
        [data.slug, id, row.teamId]
      )
      if (slugCheck.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'A category with this slug already exists' },
          { status: 409 }
        )
      }
    }

    // Verify parentId exists if provided
    if (data.parentId) {
      const parentCheck = await dbQuery(
        'SELECT id FROM taxonomies WHERE id = $1 AND type = \'post_category\' AND ("teamId" IS NULL OR "teamId" IS NOT DISTINCT FROM $2)',
        [data.parentId, row.teamId]
      )
      if (parentCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Parent category not found'
        }, { status: 400 })
      }

      // Prevent circular reference
      if (data.parentId === id) {
        return NextResponse.json({
          success: false,
          error: 'A category cannot be its own parent'
        }, { status: 400 })
      }
    }

    // Build the update query dynamically based on provided fields
    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(data.name)
    }
    if (data.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`)
      values.push(data.slug)
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(data.description || null)
    }
    if (data.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`)
      values.push(data.icon || null)
    }
    if (data.color !== undefined) {
      updates.push(`color = $${paramIndex++}`)
      values.push(data.color || null)
    }
    if (data.parentId !== undefined) {
      updates.push(`"parentId" = $${paramIndex++}`)
      values.push(data.parentId || null)
    }
    if (data.order !== undefined) {
      updates.push(`"order" = $${paramIndex++}`)
      values.push(data.order)
    }
    if (data.isDefault !== undefined) {
      updates.push(`"isDefault" = $${paramIndex++}`)
      values.push(data.isDefault)
    }
    if (data.isActive !== undefined) {
      updates.push(`"isActive" = $${paramIndex++}`)
      values.push(data.isActive)
    }

    // Only update if there are fields to update
    if (updates.length === 0) {
      // No fields to update, just return current data
      const current = await dbQuery(
        `SELECT id, name, slug, description, icon, color, "parentId", "order", "isDefault", "isActive",
                "createdAt", "updatedAt"
         FROM taxonomies WHERE id = $1`,
        [id]
      )
      return NextResponse.json({ success: true, data: current.rows[0] })
    }

    // Add the id as the last parameter
    values.push(id)

    values.push(row.teamId)
    const query = `UPDATE taxonomies SET ${updates.join(', ')} WHERE id = $${paramIndex} AND "teamId" IS NOT DISTINCT FROM $${paramIndex + 1} RETURNING *`
    const result = await dbQuery(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (err) {
    console.error('Error in post-categories API PUT:', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: err.issues }, { status: 400 })
    }
    const errorMessage = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}, 'write');

// DELETE /api/v1/post-categories/:id - Delete category (one of the caller's team, with posts.delete there; one
// without a team: superadmin only)
export const DELETE = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    // Dual authentication (the API-key scope fails closed, #93), then the team-role permission.
    const writer = await categoryWriter(request, 'delete')
    if ('response' in writer) return writer.response

    const { id } = await params

    const row = await findCategory(id, writer)
    if ('response' in row) return row.response

    // Check if category is used by any posts (using entity_taxonomy_relations)
    let usageCount = 0
    try {
      const usageCheck = await dbQuery<{ count: string }>(
        `SELECT COUNT(*) as count FROM entity_taxonomy_relations
         WHERE "taxonomyId" = $1 AND "entityType" = 'posts'`,
        [id]
      )
      usageCount = parseInt(usageCheck.rows[0].count)
    } catch {
      // Table might not exist yet, assume no usage
      usageCount = 0
    }

    // Soft delete if used, hard delete if not used
    if (usageCount > 0) {
      // Soft delete: SET deletedAt = now()
      await dbQuery(
        'UPDATE taxonomies SET "deletedAt" = now() WHERE id = $1 AND "teamId" IS NOT DISTINCT FROM $2',
        [id, row.teamId]
      )
      return NextResponse.json({
        success: true,
        data: { id, deleted: 'soft', message: 'Category soft-deleted (still referenced by posts)' }
      })
    } else {
      // Hard delete: No posts use it
      const result = await dbQuery<{ id: string }>(
        'DELETE FROM taxonomies WHERE id = $1 AND "teamId" IS NOT DISTINCT FROM $2 RETURNING id',
        [id, row.teamId]
      )
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
      }
      return NextResponse.json({
        success: true,
        data: { id: result.rows[0].id, deleted: 'hard' }
      })
    }
  } catch (err) {
    console.error('Error in post-categories API DELETE:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}, 'write');

export const OPTIONS = corsPreflight
