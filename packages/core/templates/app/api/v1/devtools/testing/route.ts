/**
 * DevTools Testing API
 *
 * GET /api/v1/devtools/testing
 *
 * Returns the complete tags registry with test coverage statistics.
 * Requires superadmin or developer user role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import {
  canAccessDevtoolsApi,
  createDevtoolsAccessDeniedResponse,
  createDevtoolsUnauthorizedResponse,
} from '@nextsparkjs/core/lib/api/auth/devtools-auth'
import {
  TAGS_REGISTRY,
  COVERAGE_SUMMARY,
  FEATURE_REGISTRY,
  FLOW_REGISTRY,
} from '@nextsparkjs/registries/testing-registry'

export async function GET(request: NextRequest) {
  // Authenticate request
  const authResult = await authenticateRequest(request)

  if (!authResult.success) {
    return createDevtoolsUnauthorizedResponse()
  }

  // Check DevTools access permission
  if (!canAccessDevtoolsApi(authResult)) {
    return createDevtoolsAccessDeniedResponse()
  }

  // Count total tags across all categories
  let totalTags = 0
  const categorySummary: Record<string, number> = {}

  for (const [category, tags] of Object.entries(TAGS_REGISTRY)) {
    const tagCount = Object.keys(tags).length
    totalTags += tagCount
    categorySummary[category] = tagCount
  }

  return NextResponse.json({
    success: true,
    data: {
      tags: TAGS_REGISTRY,
      summary: {
        totalTags,
        testFiles: COVERAGE_SUMMARY.tags.testFiles,
        byCategory: categorySummary,
        features: {
          total: Object.keys(FEATURE_REGISTRY).length,
          withTests: COVERAGE_SUMMARY.features.withTests,
          withoutTests: COVERAGE_SUMMARY.features.withoutTests,
        },
        flows: {
          total: Object.keys(FLOW_REGISTRY).length,
          withTests: COVERAGE_SUMMARY.flows.withTests,
          withoutTests: COVERAGE_SUMMARY.flows.withoutTests,
        },
      },
      meta: {
        theme: COVERAGE_SUMMARY.theme,
        generatedAt: COVERAGE_SUMMARY.generatedAt,
      },
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  })
}
