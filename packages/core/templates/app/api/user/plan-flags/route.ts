/**
 * User Plan & Flags API Route
 * 
 * Handles fetching and updating user plan and flags data
 * for the entity system permission integration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTypedSession } from '@nextsparkjs/core/lib/auth'
import { getUserPlanAndFlags, updateUserPlan, updateUserFlags } from '@nextsparkjs/core/lib/user-data'
import { z } from 'zod'
import type { UserRole } from '@nextsparkjs/core/types/user.types'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

// Validation schemas
const planFlagsQuerySchema = z.object({
  userId: z.string().optional()
})

const planFlagsUpdateSchema = z.object({
  userId: z.string(),
  plan: z.enum(['free', 'starter', 'premium']).optional(),
  flags: z.array(z.enum(['beta_tester', 'early_adopter', 'limited_access', 'vip', 'restricted', 'experimental'])).optional()
})

/**
 * GET /api/user/plan-flags
 * Fetch user plan and flags data
 */
export const GET = withRateLimitTier(async (request: NextRequest) => {
  try {
    // Get session
    const session = await getTypedSession(request.headers)

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const validation = planFlagsQuerySchema.safeParse({
      userId: searchParams.get('userId')
    })

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid parameters',
          details: validation.error.flatten().fieldErrors 
        },
        { status: 400 }
      )
    }

    const { userId } = validation.data
    const targetUserId = userId || session.user.id

    // Security check: users can only access their own data unless admin
    const userRole = session.user.role as UserRole
    if (targetUserId !== session.user.id && !['admin', 'superadmin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Get user plan and flags
    const planData = await getUserPlanAndFlags(targetUserId)

    return NextResponse.json({
      userId: targetUserId,
      plan: planData.plan,
      flags: planData.flags,
      cached: planData.cached
    })

  } catch (error) {
    console.error('GET user plan-flags error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}, 'read');

/**
 * PATCH /api/user/plan-flags
 * Update user plan and/or flags
 */
export const PATCH = withRateLimitTier(async (request: NextRequest) => {
  try {
    // Get session
    const session = await getTypedSession(request.headers)

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = planFlagsUpdateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: validation.error.flatten().fieldErrors 
        },
        { status: 400 }
      )
    }

    const { userId, plan, flags } = validation.data
    const userRole = session.user.role as UserRole

    // Security check: users can only update their own data unless admin
    if (userId !== session.user.id && !['admin', 'superadmin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Only admins can update other users data' },
        { status: 403 }
      )
    }

    const results: { plan?: boolean; flags?: boolean } = {}

    // Update plan if provided
    if (plan) {
      const planSuccess = await updateUserPlan(userId, plan)
      if (!planSuccess) {
        return NextResponse.json(
          { error: 'Failed to update user plan' },
          { status: 500 }
        )
      }
      results.plan = true
    }

    // Update flags if provided
    if (flags) {
      const flagsSuccess = await updateUserFlags(userId, flags)
      if (!flagsSuccess) {
        return NextResponse.json(
          { error: 'Failed to update user flags' },
          { status: 500 }
        )
      }
      results.flags = true
    }

    // Get updated data
    const updatedData = await getUserPlanAndFlags(userId)

    return NextResponse.json({
      success: true,
      updated: results,
      userId,
      plan: updatedData.plan,
      flags: updatedData.flags
    })

  } catch (error) {
    console.error('PATCH user plan-flags error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}, 'write');

/**
 * POST /api/user/plan-flags/bulk
 * Bulk update user plans and flags (admin only)
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    // Get session
    const session = await getTypedSession(request.headers)

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userRole = session.user.role as UserRole

    // Only admins can perform bulk operations
    if (!['admin', 'superadmin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Admin access required for bulk operations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const bulkSchema = z.object({
      updates: z.array(z.object({
        userId: z.string(),
        plan: z.enum(['free', 'starter', 'premium']).optional(),
        flags: z.array(z.enum(['beta_tester', 'early_adopter', 'limited_access', 'vip', 'restricted', 'experimental'])).optional()
      })).max(100) // Limit bulk operations
    })

    const validation = bulkSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid bulk request',
          details: validation.error.flatten().fieldErrors 
        },
        { status: 400 }
      )
    }

    const { updates } = validation.data
    const results = []

    // Process each update
    for (const update of updates) {
      try {
        const updateResult: { userId: string; plan?: boolean; flags?: boolean } = {
          userId: update.userId
        }

        if (update.plan) {
          updateResult.plan = await updateUserPlan(update.userId, update.plan)
        }

        if (update.flags) {
          updateResult.flags = await updateUserFlags(update.userId, update.flags)
        }

        results.push({
          ...updateResult,
          success: true
        })
      } catch (error) {
        results.push({
          userId: update.userId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    return NextResponse.json({
      success: failureCount === 0,
      processed: results.length,
      succeeded: successCount,
      failed: failureCount,
      results
    })

  } catch (error) {
    console.error('POST bulk user plan-flags error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}, 'strict');