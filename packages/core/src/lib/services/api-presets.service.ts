/**
 * ApiPresetsService
 *
 * Service layer for API presets queries.
 * Provides O(1) lookups for presets by endpoint.
 *
 * @example
 * import { ApiPresetsService } from './api-presets.service'
 *
 * // Get presets for an endpoint
 * const presets = ApiPresetsService.getByEndpoint('/api/v1/customers')
 *
 * // Get presets filtered by method
 * const getPresets = ApiPresetsService.getByEndpointAndMethod('/api/v1/customers', 'GET')
 */

import {
  API_PRESETS_REGISTRY,
  getPresetsForEndpoint,
  getPresetsByMethod,
  getAllPresets,
  hasPresets,
  type ApiEndpointPresets,
  type ApiPreset
} from '@nextsparkjs/registries/api-presets-registry'

// Re-export types for convenience
export type { ApiEndpointPresets, ApiPreset }

/**
 * ApiPresetsService
 *
 * Service layer for API presets queries.
 * All methods are static for consistency with other services.
 */
export class ApiPresetsService {
  // ==================== Query Methods ====================

  /**
   * Get all presets for an endpoint
   *
   * @param endpoint - The endpoint path (e.g., '/api/v1/customers')
   * @returns Endpoint presets config or undefined if not found
   *
   * @example
   * const config = ApiPresetsService.getByEndpoint('/api/v1/customers')
   * if (config) {
   *   console.log(`Found ${config.presets.length} presets`)
   * }
   */
  static getByEndpoint(endpoint: string): ApiEndpointPresets | undefined {
    return getPresetsForEndpoint(endpoint)
  }

  /**
   * Get presets filtered by HTTP method
   *
   * @param endpoint - The endpoint path
   * @param method - The HTTP method (GET, POST, etc.)
   * @returns Array of presets for that method
   *
   * @example
   * const getPresets = ApiPresetsService.getByEndpointAndMethod('/api/v1/customers', 'GET')
   */
  static getByEndpointAndMethod(endpoint: string, method: string): ApiPreset[] {
    return getPresetsByMethod(endpoint, method)
  }

  /**
   * Get all endpoint presets configurations
   *
   * @returns Array of all endpoint preset configs
   */
  static getAll(): ApiEndpointPresets[] {
    return getAllPresets()
  }

  /**
   * Check if an endpoint has presets defined
   *
   * @param endpoint - The endpoint path
   * @returns True if presets exist for this endpoint
   */
  static hasPresets(endpoint: string): boolean {
    return hasPresets(endpoint)
  }

  // ==================== Metadata Methods ====================

  /**
   * Get registry metadata
   *
   * @returns Object with totalEndpoints, totalPresets, generatedAt, themeName
   */
  static getMeta() {
    return API_PRESETS_REGISTRY.meta
  }

  /**
   * Get total count of presets
   *
   * @returns Total number of presets across all endpoints
   */
  static getTotalPresets(): number {
    return API_PRESETS_REGISTRY.meta.totalPresets
  }

  /**
   * Get total count of endpoints with presets
   *
   * @returns Total number of endpoints that have presets defined
   */
  static getTotalEndpoints(): number {
    return API_PRESETS_REGISTRY.meta.totalEndpoints
  }

  // ==================== Search Methods ====================

  /**
   * Search presets by tag
   *
   * @param tag - The tag to search for
   * @returns Array of presets that have this tag
   */
  static getByTag(tag: string): ApiPreset[] {
    const allConfigs = getAllPresets()
    const results: ApiPreset[] = []

    for (const config of allConfigs) {
      for (const preset of config.presets) {
        if (preset.tags?.includes(tag)) {
          results.push(preset)
        }
      }
    }

    return results
  }

  /**
   * Get all unique tags across all presets
   *
   * @returns Array of unique tag strings
   */
  static getAllTags(): string[] {
    const allConfigs = getAllPresets()
    const tags = new Set<string>()

    for (const config of allConfigs) {
      for (const preset of config.presets) {
        if (preset.tags) {
          preset.tags.forEach(tag => tags.add(tag))
        }
      }
    }

    return Array.from(tags).sort()
  }
}
