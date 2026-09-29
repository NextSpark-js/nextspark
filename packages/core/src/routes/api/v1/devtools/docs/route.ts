/**
 * DevTools API Documentation Endpoint
 *
 * Serves markdown documentation files for API endpoints.
 * Used by the API Explorer to display endpoint documentation.
 *
 * Supports project-root docs and core-owned route docs.
 *
 * GET /api/v1/devtools/docs?path={path}
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

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
  /^packages\/core\/templates\/app\/api\/.*\/docs\.md$/,
  // Core routes (NPM mode)
  /^node_modules\/@nextsparkjs\/core\/templates\/app\/api\/.*\/docs\.md$/,
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
  const searchParams = request.nextUrl.searchParams
  const docPath = searchParams.get('path')

  if (!docPath) {
    return NextResponse.json(
      { error: 'Missing path parameter' },
      { status: 400 }
    )
  }

  // Validate path to prevent directory traversal
  if (docPath.includes('..')) {
    return NextResponse.json(
      { error: 'Invalid path: directory traversal not allowed' },
      { status: 400 }
    )
  }

  // Validate path matches allowed patterns
  if (!isValidPath(docPath)) {
    return NextResponse.json(
      { error: 'Invalid path: does not match allowed patterns' },
      { status: 400 }
    )
  }

  // Only allow .md files
  if (!docPath.endsWith('.md')) {
    return NextResponse.json(
      { error: 'Only markdown files are allowed' },
      { status: 400 }
    )
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
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Read the markdown file
    const content = await readFile(fullPath, 'utf-8')

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Error reading documentation:', error)
    return NextResponse.json(
      { error: 'Failed to read document' },
      { status: 500 }
    )
  }
}, 'read');
