/**
 * DevTools Flows API
 *
 * GET /api/v1/devtools/flows
 *
 * Returns the flow registry with test coverage information.
 * Requires superadmin or developer user role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import {
  canAccessDevtoolsApi,
  createDevtoolsAccessDeniedResponse,
  createDevtoolsUnauthorizedResponse,
} from '@nextsparkjs/core/lib/api/auth/devtools-auth'
import {
  FLOW_REGISTRY,
  COVERAGE_SUMMARY,
} from '@nextsparkjs/registries/testing-registry'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(async (request: NextRequest) => {
  // Authenticate request; the API-key scope is declared at the entry point,
  // which fails closed for keys that lack it (#93).
  const authResult = await authenticateRequest(request, { requiredScope: 'admin:devtools' })

  if (!authResult.success) {
    return authResult.type === 'api-key' ? createAuthFailureResponse(authResult) : createDevtoolsUnauthorizedResponse()
  }

  // Check DevTools access permission
  if (!canAccessDevtoolsApi(authResult)) {
    return createDevtoolsAccessDeniedResponse()
  }

  // Return flow registry data
  return NextResponse.json({
    success: true,
    data: {
      flows: Object.values(FLOW_REGISTRY),
      summary: {
        total: COVERAGE_SUMMARY.flows.total,
        withTests: COVERAGE_SUMMARY.flows.withTests,
        withoutTests: COVERAGE_SUMMARY.flows.withoutTests,
      },
      meta: {
        theme: COVERAGE_SUMMARY.theme,
        generatedAt: COVERAGE_SUMMARY.generatedAt,
      },
    },
  })
}, 'read');

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  })
}
