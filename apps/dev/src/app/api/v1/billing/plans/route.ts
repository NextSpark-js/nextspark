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
  // Anonymous callers resolve to a null auth (#112) and only see public plans.
  // Public listing: any valid API key may call this; only the `*` scope unlocks hidden plans, decided below (#93).
  const { auth } = await validateAndAuthenticateRequest(request, { allowAnyScope: true })
  const includeHidden = !!auth && (auth.scopes.includes('*') || auth.scopes.includes('superadmin:all'))

  try {
    const plans = await PlanService.list({ includeHidden })
    return createApiResponse(plans)
  } catch (error) {
    console.error('[Billing API] Error fetching plans:', error)
    return createApiError('Failed to fetch plans', 500)
  }
}, 'read');

export const POST = withRateLimitTier(async (request: NextRequest) => {
  // Authenticate request; the API-key scope is declared at the entry point,
  // which fails closed for keys that lack it (#93).
  const { auth, rateLimitResponse, errorResponse } = await validateAndAuthenticateRequest(request, { requiredScope: 'billing:write' })
  if (rateLimitResponse) return rateLimitResponse
  if (!auth) return errorResponse ?? createApiError('Authentication required', 401, undefined, 'AUTHENTICATION_REQUIRED')

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
