/**
 * DevTools API Documentation Endpoint
 *
 * Serves markdown documentation files for API endpoints.
 * Used by the API Explorer to display endpoint documentation.
 *
 * Supports project-root docs and core-owned route docs.
 *
 * GET /api/v1/devtools/docs?path={path}
 * Requires the developer role, like the other devtools APIs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiError } from '@nextsparkjs/core/lib/api/error-response'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { authenticateRequest, createAuthFailureResponse } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import {
  canAccessDevtoolsApi,
  createDevtoolsAccessDeniedResponse,
  createDevtoolsUnauthorizedResponse,
} from '@nextsparkjs/core/lib/api/auth/devtools-auth'

/**
 * Valid path patterns for documentation files
 * Supports root-first project paths and core package paths.
 */
const VALID_PATH_PATTERNS = [
  // Entity folders
  /^entities\/[\w-]+\/api\/docs\.md$/,
  // Project routes (colocated next to the handler under api/)
  /^api\/.*\/docs\.md$/,
  // Core routes (monorepo mode)
  /^packages\/core\/src\/routes\/api\/.*\/docs\.md$/,
  // Core routes (NPM mode)
  /^node_modules\/@nextsparkjs\/core\/dist\/routes\/api\/.*\/docs\.md$/,
  /^devtools\/api\/[\w-]+\.md$/
]

/**
 * Validate that a path matches one of the allowed patterns
 */
function isValidPath(path: string): boolean {
  return VALID_PATH_PATTERNS.some(pattern => pattern.test(path))
}

/**
 * Detect monorepo root by searching for pnpm-workspace.yaml
 */
function detectMonorepoRoot(startDir: string): string | null {
  let dir = startDir
  const maxDepth = 10
  let depth = 0

  while (dir !== '/' && depth < maxDepth) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    dir = dirname(dir)
    depth++
  }

  return null
}

/**
 * Get all possible base paths for resolving doc files
 * Handles both monorepo and npm modes
 */
function getBasePaths(): string[] {
  const cwd = process.cwd()
  const paths: string[] = []

  // Always try the project root first.
  paths.push(cwd)

  // Check if we're in monorepo mode
  const monorepoRoot = detectMonorepoRoot(cwd)
  if (monorepoRoot && monorepoRoot !== cwd) {
    // Core-owned documentation paths may be rooted at the monorepo.
    paths.push(monorepoRoot)
  }

  return paths
}

export const GET = withRateLimitTier(async (request: NextRequest) => {
  // Authenticate request; the API-key scope is declared at the entry point,
  // which fails closed for keys that lack it (#93).
  const authResult = await authenticateRequest(request, { requiredScope: 'admin:devtools' })
  if (!authResult.success) {
    return authResult.type === 'api-key' ? createAuthFailureResponse(authResult) : createDevtoolsUnauthorizedResponse()
  }
  if (!canAccessDevtoolsApi(authResult)) {
    return createDevtoolsAccessDeniedResponse()
  }

  const searchParams = request.nextUrl.searchParams
  const docPath = searchParams.get('path')

  if (!docPath) {
    return createApiError('Missing path parameter', 400, undefined, 'VALIDATION_ERROR')
  }

  // Validate path to prevent directory traversal
  if (docPath.includes('..')) {
    return createApiError('Invalid path: directory traversal not allowed', 400, undefined, 'VALIDATION_ERROR')
  }

  // Validate path matches allowed patterns
  if (!isValidPath(docPath)) {
    return createApiError('Invalid path: does not match allowed patterns', 400, undefined, 'VALIDATION_ERROR')
  }

  // Only allow .md files
  if (!docPath.endsWith('.md')) {
    return createApiError('Only markdown files are allowed', 400, undefined, 'VALIDATION_ERROR')
  }

  try {
    // Try all possible base paths
    const basePaths = getBasePaths()

    let fullPath: string | null = null
    for (const base of basePaths) {
      const testPath = join(base, docPath)
      if (existsSync(testPath)) {
        fullPath = testPath
        break
      }
    }

    // Check if file exists
    if (!fullPath) {
      return createApiError('Document not found', 404, undefined, 'NOT_FOUND')
    }

    // Read the markdown file
    const content = await readFile(fullPath, 'utf-8')

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Error reading documentation:', error)
    return createApiError('Failed to read document', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'read');

export const OPTIONS = corsPreflight
