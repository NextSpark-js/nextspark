/**
 * Core Routes Discovery
 *
 * Discovers core's API routes (api/v1) from the core route manifest.
 * Excludes dynamic/catch-all routes (handled by generic handlers).
 *
 * @module core/scripts/build/registry/discovery/core-routes
 */

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { loadCoreRouteManifest } from '../host/core-routes.mjs'
import { verbose, extractHttpMethods } from '../../../utils/index.mjs'

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
 * Discover core's api/v1 routes from core's route manifest, each read from the core module that
 * implements it (what the generated src/app/api/v1 holds a facade of): src/app is output of
 * `nextspark prepare`, never an input of the registries. Dynamic routes are left out.
 *
 * @param {object} config - configuration from getConfig()
 * @returns {Promise<Array<{ path: string, methods: string[], relativePath: string, category: string, filePath: string }>>}
 */
export async function discoverCoreRoutes(config = DEFAULT_CONFIG) {
  const manifest = await loadCoreRouteManifest({ coreRoot: config.coreDir })
  const routes = []
  for (const route of manifest?.routes ?? []) {
    if (route.kind !== 'route' || !route.target.startsWith('api/v1/')) continue
    const relativePath = route.target.slice('api/v1/'.length).split('/').slice(0, -1).join('/')
    if (relativePath.split('/').some(isExcludedDirectory)) continue
    routes.push({
      path: relativePath ? `/api/v1/${relativePath}` : '/api/v1',
      methods: await extractHttpMethods(route.file),
      relativePath: relativePath || '/',
      category: getCategoryFromPath(relativePath),
      filePath: `@/app/api/v1${relativePath ? '/' + relativePath : ''}/route`
    })
  }
  verbose(`[Core Routes] ${routes.length} core routes from the core route manifest`)
  return routes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
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
    'post-categories': 'content'
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
