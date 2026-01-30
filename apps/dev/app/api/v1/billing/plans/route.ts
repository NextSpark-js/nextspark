/**
 * Plans API - Billing system
 *
 * GET /api/v1/billing/plans - List all plans (public can see public plans)
 * POST /api/v1/billing/plans - Create a plan (superadmin only)
 */

import { NextRequest } from 'next/server'
import { validateAndAuthenticateRequest, createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { PlanService } from '@nextsparkjs/core/lib/services'
import { createPlanSchema } from '@nextsparkjs/core/lib/billing/schema'
import { mutateWithRLS } from '@nextsparkjs/core/lib/db'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(async (request: NextRequest) => {
  // Plans list is partially public (public plans visible to all, hidden plans only to superadmin)
  let includeHidden = false

  try {
    const { auth } = await validateAndAuthenticateRequest(request)
    // Check if user is superadmin (for full access including hidden plans)
    includeHidden = auth.scopes.includes('*') || auth.scopes.includes('superadmin:all')
  } catch {
    // Not authenticated, only show public plans
    includeHidden = false
  }

  try {
    const plans = await PlanService.list({ includeHidden })
    return createApiResponse(plans)
  } catch (error) {
    console.error('[Billing API] Error fetching plans:', error)
    return createApiError('Failed to fetch plans', 500)
  }
}, 'read');

export const POST = withRateLimitTier(async (request: NextRequest) => {
  // Authenticate request
  const { auth, rateLimitResponse } = await validateAndAuthenticateRequest(request)
  if (rateLimitResponse) return rateLimitResponse

  // Check superadmin permission
  if (!auth.scopes.includes('*') && !auth.scopes.includes('superadmin:all')) {
    return createApiError('Only superadmin can create plans', 403)
  }

  try {
    const body = await request.json()
    const data = createPlanSchema.parse(body)

    const { rows } = await mutateWithRLS(
      `
      INSERT INTO plans (
        slug, name, description, type, visibility,
        "priceMonthly", "priceYearly", currency, "trialDays",
        features, limits, metadata, "sortOrder"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `,
      [
        data.slug,
        data.name,
        data.description,
        data.type,
        data.visibility,
        data.priceMonthly,
        data.priceYearly,
        data.currency,
        data.trialDays,
        JSON.stringify(data.features),
        JSON.stringify(data.limits),
        JSON.stringify(data.metadata),
        data.sortOrder,
      ]
    )

    return createApiResponse(rows[0], { created: true }, 201)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : ''
    if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
      return createApiError('Plan slug already exists', 400)
    }
    console.error('[Billing API] Error creating plan:', error)
    return createApiError('Failed to create plan', 500)
  }
}, 'strict');
