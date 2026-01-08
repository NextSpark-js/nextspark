/**
 * Core Routes Discovery
 *
 * Discovers API routes from app/api/v1/ directory.
 * Excludes dynamic/catch-all routes (handled by generic handlers).
 *
 * @module core/scripts/build/registry/discovery/core-routes
 */

import { join } from 'path'
import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { verbose, extractHttpMethods, scanDirectory } from '../../../utils/index.mjs'

/**
 * Patterns to exclude from core route discovery
 * These are dynamic routes handled by generic handlers
 */
const EXCLUDED_PATTERNS = [
  /^\[.*\]$/,      // [entity], [id], [slug], etc.
  /^\[\.\.\./,     // [...path], [...slug], etc.
]

/**
 * Check if a directory name matches an excluded pattern
 * @param {string} name - Directory name to check
 * @returns {boolean}
 */
function isExcludedDirectory(name) {
  return EXCLUDED_PATTERNS.some(pattern => pattern.test(name))
}

/**
 * Discover core API routes from app/api/v1/
 *
 * @returns {Promise<Array<{
 *   path: string,
 *   methods: string[],
 *   relativePath: string,
 *   category: string
 * }>>}
 */
/**
 * Discover core API routes from app/api/v1/
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<Array>} Array of discovered core routes
 */
export async function discoverCoreRoutes(config = DEFAULT_CONFIG) {
  const apiDir = join(config.projectRoot, 'app', 'api', 'v1')
  const routes = []

  verbose(`[Core Routes] Scanning ${apiDir}`)

  /**
   * Recursively scan directory for route.ts files
   * @param {string} dir - Current directory
   * @param {string} relativePath - Path relative to api/v1/
   */
  async function scanForRoutes(dir, relativePath = '') {
    const entries = await scanDirectory(dir)

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        // Skip excluded patterns (dynamic routes)
        if (isExcludedDirectory(entry.name)) {
          verbose(`[Core Routes] Skipping dynamic directory: ${entry.name}`)
          continue
        }

        // Recurse into subdirectory
        await scanForRoutes(fullPath, currentRelativePath)
      } else if (entry.name === 'route.ts') {
        // Found a route file - extract methods
        const routeFilePath = fullPath
        const methods = await extractHttpMethods(routeFilePath)

        // Build the API path
        const apiPath = relativePath
          ? `/api/v1/${relativePath}`
          : '/api/v1'

        // Determine category based on path
        const category = getCategoryFromPath(relativePath)

        routes.push({
          path: apiPath,
          methods,
          relativePath: relativePath || '/',
          category,
          filePath: `@/app/api/v1${relativePath ? '/' + relativePath : ''}/route`
        })

        verbose(`[Core Routes] Found: ${apiPath} [${methods.join(', ')}] (${category})`)
      }
    }
  }

  await scanForRoutes(apiDir)

  verbose(`[Core Routes] Discovered ${routes.length} core routes`)

  return routes
}

/**
 * Determine the category of a route based on its path
 * @param {string} relativePath - Path relative to api/v1/
 * @returns {string} Category name
 */
function getCategoryFromPath(relativePath) {
  if (!relativePath) return 'root'

  const firstSegment = relativePath.split('/')[0]

  // Map first segment to category
  const categoryMap = {
    'users': 'users',
    'teams': 'teams',
    'team-invitations': 'teams',
    'billing': 'billing',
    'api-keys': 'api-keys',
    'blocks': 'blocks',
    'media': 'media',
    'auth': 'auth',
    'post-categories': 'content',
    'plugin': 'plugin',
    'theme': 'theme'
  }

  return categoryMap[firstSegment] || 'other'
}

/**
 * Get a description for a route based on its path and methods
 * @param {string} path - API path
 * @param {string[]} methods - HTTP methods
 * @returns {string}
 */
export function getRouteDescription(path, methods) {
  const pathParts = path.replace('/api/v1/', '').split('/')
  const resource = pathParts[0] || 'root'
  const subResource = pathParts.slice(1).join('/')

  const methodDescriptions = {
    'GET': 'List/Read',
    'POST': 'Create',
    'PUT': 'Replace',
    'PATCH': 'Update',
    'DELETE': 'Delete'
  }

  if (methods.length === 1) {
    return `${methodDescriptions[methods[0]] || methods[0]} ${resource}${subResource ? ` ${subResource}` : ''}`
  }

  return `${resource}${subResource ? ` - ${subResource}` : ''} operations`
}
