/**
 * DevTools Blocks API
 *
 * GET /api/v1/devtools/blocks
 *
 * Returns the block registry with field definitions and test coverage.
 * Requires superadmin or developer user role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import {
  canAccessDevtoolsApi,
  createDevtoolsAccessDeniedResponse,
  createDevtoolsUnauthorizedResponse,
} from '@nextsparkjs/core/lib/api/auth/devtools-auth'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'
import { TAGS_REGISTRY, COVERAGE_SUMMARY } from '@nextsparkjs/registries/testing-registry'

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

  // Merge blocks with test coverage data
  // Type assertion needed because TAGS_REGISTRY uses 'as const' with readonly arrays
  const blockTags = TAGS_REGISTRY.blocks as unknown as Record<string, { tag: string; testCount: number; files: readonly string[] }>
  const blocksWithCoverage = Object.values(BLOCK_REGISTRY).map((block) => {
    const tagData = blockTags[block.slug]
    return {
      ...block,
      testing: {
        hasTests: (tagData?.testCount || 0) > 0,
        testCount: tagData?.testCount || 0,
        files: tagData?.files ? [...tagData.files] : [],
        tag: `@b-${block.slug}`,
      },
    }
  })

  // Calculate summary stats
  const total = blocksWithCoverage.length
  const withTests = blocksWithCoverage.filter((b) => b.testing.hasTests).length

  // Get unique categories
  const categories = [...new Set(blocksWithCoverage.map((b) => b.category))].sort()

  return NextResponse.json({
    success: true,
    data: {
      blocks: blocksWithCoverage,
      summary: {
        total,
        withTests,
        withoutTests: total - withTests,
        categories,
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
