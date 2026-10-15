/**
 * User Plan & Flags API Route
 * 
 * Handles fetching and updating user plan and flags data
 * for the entity system permission integration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiError, readJsonObject } from '@nextsparkjs/core/lib/api/error-response'
import { getAuthorizationSession } from '@nextsparkjs/core/lib/auth/authorization-session'
import { getUserPlanAndFlags, updateUserPlan, updateUserFlags } from '@nextsparkjs/core/lib/user-data'
import * as z from 'zod'
import type { UserRole } from '@nextsparkjs/core/types/user.types'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'

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
    const session = await getAuthorizationSession(request.headers)

    if (!session) {
      return createApiError('Authentication required', 401, undefined, 'AUTHENTICATION_REQUIRED')
    }

    const { searchParams } = new URL(request.url)
    // An absent userId is undefined, so the signed-in user is the default
    const validation = planFlagsQuerySchema.safeParse({
      userId: searchParams.get('userId') ?? undefined
    })

    if (!validation.success) {
      return createApiError('Invalid parameters', 400, validation.error.flatten().fieldErrors, 'VALIDATION_ERROR')
    }

    const { userId } = validation.data
    const targetUserId = userId || session.user.id

    // Security check: users can only access their own data unless admin
    const userRole = session.user.role as UserRole
    if (targetUserId !== session.user.id && !['superadmin', 'developer'].includes(userRole)) {
      return createApiError('Permission denied', 403, undefined, 'FORBIDDEN')
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
    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'read');

/**
 * PATCH /api/user/plan-flags
 * Update user plan and/or flags
 */
export const PATCH = withRateLimitTier(async (request: NextRequest) => {
  try {
    // Get session
    const session = await getAuthorizationSession(request.headers)

    if (!session) {
      return createApiError('Authentication required', 401, undefined, 'AUTHENTICATION_REQUIRED')
    }

    const parsedBody = await readJsonObject(request)
    if (parsedBody.error) return parsedBody.error
    const body = parsedBody.data
    const validation = planFlagsUpdateSchema.safeParse(body)

    if (!validation.success) {
      return createApiError('Invalid request body', 400, validation.error.flatten().fieldErrors, 'VALIDATION_ERROR')
    }

    const { userId, plan, flags } = validation.data
    const userRole = session.user.role as UserRole

    // Security check: users can only update their own data unless admin
    if (userId !== session.user.id && !['superadmin', 'developer'].includes(userRole)) {
      return createApiError('Only admins can update other users data', 403, undefined, 'FORBIDDEN')
    }

    const results: { plan?: boolean; flags?: boolean } = {}

    // Update plan if provided
    if (plan) {
      const planSuccess = await updateUserPlan(userId, plan)
      if (!planSuccess) {
        return createApiError('Failed to update user plan', 500, undefined, 'INTERNAL_ERROR')
      }
      results.plan = true
    }

    // Update flags if provided
    if (flags) {
      const flagsSuccess = await updateUserFlags(userId, flags)
      if (!flagsSuccess) {
        return createApiError('Failed to update user flags', 500, undefined, 'INTERNAL_ERROR')
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
    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'write');

/**
 * POST /api/user/plan-flags/bulk
 * Bulk update user plans and flags (admin only)
 */
export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    // Get session
    const session = await getAuthorizationSession(request.headers)

    if (!session) {
      return createApiError('Authentication required', 401, undefined, 'AUTHENTICATION_REQUIRED')
    }

    const userRole = session.user.role as UserRole

    // Only admins can perform bulk operations
    if (!['superadmin', 'developer'].includes(userRole)) {
      return createApiError('Admin access required for bulk operations', 403, undefined, 'FORBIDDEN')
    }

    const parsedBody = await readJsonObject(request)
    if (parsedBody.error) return parsedBody.error
    const body = parsedBody.data
    const bulkSchema = z.object({
      updates: z.array(z.object({
        userId: z.string(),
        plan: z.enum(['free', 'starter', 'premium']).optional(),
        flags: z.array(z.enum(['beta_tester', 'early_adopter', 'limited_access', 'vip', 'restricted', 'experimental'])).optional()
      })).max(100) // Limit bulk operations
    })

    const validation = bulkSchema.safeParse(body)

    if (!validation.success) {
      return createApiError('Invalid bulk request', 400, validation.error.flatten().fieldErrors, 'VALIDATION_ERROR')
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
        console.error('Error updating plan flags:', error)
        results.push({
          userId: update.userId,
          success: false,
          error: 'Update failed'
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
    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'strict');

export const OPTIONS = corsPreflight
