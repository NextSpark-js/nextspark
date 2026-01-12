/**
 * API Presets Type Definitions
 *
 * Types for the API preset system in DevTools.
 * Presets are pre-configured request examples for API endpoints.
 *
 * Sources (by priority):
 * 1. Theme custom routes: {theme}/app/api/**\/presets.ts and docs.md
 * 2. Entity folders: {theme}/entities/*\/api/presets.ts and docs.md
 * 3. Core routes: packages/core/templates/app/api/**\/presets.ts and docs.md
 *
 * Registry generates:
 * - api-presets-registry.ts - Presets organized by endpoint
 * - api-docs-registry.ts - Documentation paths by endpoint
 */

import type { HttpMethod, AuthType } from '../components/devtools/api-tester/types'

/**
 * Session configuration for a preset
 */
export interface PresetSessionConfig {
  /** Enable cross-team access (admin bypass) */
  crossTeam?: boolean
  /** Team ID to use (supports placeholders like {{FIRST_TEAM_ID}}) */
  teamId?: string
  /** Auth type override */
  authType?: AuthType
}

/**
 * Individual preset definition
 */
export interface ApiPreset {
  /** Unique ID within the endpoint */
  id: string
  /** Display title */
  title: string
  /** Optional description */
  description?: string
  /** HTTP method for this preset */
  method: HttpMethod
  /** Path parameters (for dynamic segments like [id]) */
  pathParams?: Record<string, string>
  /** Query parameters */
  params?: Record<string, string | number | boolean>
  /** Custom headers */
  headers?: Record<string, string>
  /** Request body (for POST/PATCH/PUT) */
  payload?: Record<string, unknown>
  /** Session/auth configuration */
  sessionConfig?: PresetSessionConfig
  /** Tags for filtering/grouping */
  tags?: string[]
}

/** Source of presets/docs: entity folder, theme route, or core route */
export type ApiPresetSource = 'entity' | 'route' | 'core'

/**
 * Endpoint preset configuration (exported from .presets.ts files)
 */
export interface ApiEndpointPresets {
  /** Endpoint path or glob pattern (optional for entity presets - derived from folder name) */
  endpoint?: string
  /** Short summary of the endpoint */
  summary?: string
  /** Array of presets for this endpoint */
  presets: ApiPreset[]
  /** Source file path (added by discovery) */
  sourcePath?: string
  /** Source type: 'entity' | 'route' | 'core' (added by discovery) */
  source?: ApiPresetSource
}

/**
 * Registry structure for API presets
 */
export interface ApiPresetsRegistryStructure {
  /** Map of endpoint path to presets config */
  endpoints: Record<string, ApiEndpointPresets>
  /** Metadata */
  meta: {
    totalEndpoints: number
    totalPresets: number
    generatedAt: string
    themeName: string
  }
}

/**
 * Single documentation entry
 */
export interface ApiDocEntry {
  /** Import path to the markdown file */
  path: string
  /** Document title (extracted from markdown) */
  title: string
  /** Associated endpoint */
  endpoint: string
  /** Source type: 'entity' | 'route' | 'core' (added by discovery) */
  source?: ApiPresetSource
}

/**
 * Registry structure for API documentation
 */
export interface ApiDocsRegistryStructure {
  /** Map of endpoint path to doc entry */
  docs: Record<string, ApiDocEntry>
  /** Metadata */
  meta: {
    totalDocs: number
    generatedAt: string
    themeName: string
  }
}

/**
 * Helper function to define API endpoint presets with full type safety.
 * Use this in your .presets.ts files.
 *
 * @example
 * ```typescript
 * // contents/themes/default/devtools/api/customers.presets.ts
 * import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'
 *
 * export default defineApiEndpoint({
 *   endpoint: '/api/v1/customers',
 *   summary: 'Customer management endpoints',
 *   presets: [
 *     {
 *       id: 'list-active',
 *       title: 'List Active Customers',
 *       method: 'GET',
 *       params: { status: 'active' }
 *     }
 *   ]
 * })
 * ```
 */
export function defineApiEndpoint(
  config: Omit<ApiEndpointPresets, 'sourcePath'>
): Omit<ApiEndpointPresets, 'sourcePath'> {
  return config
}
