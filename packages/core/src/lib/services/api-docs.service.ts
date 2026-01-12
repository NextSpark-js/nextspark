/**
 * ApiDocsService
 *
 * Service layer for API documentation queries.
 * Provides lookups for endpoint documentation markdown files.
 *
 * @example
 * import { ApiDocsService } from './api-docs.service'
 *
 * // Check if endpoint has documentation
 * if (ApiDocsService.hasDoc('/api/v1/customers')) {
 *   const doc = ApiDocsService.getByEndpoint('/api/v1/customers')
 *   console.log(`Doc: ${doc?.title}`)
 * }
 */

import {
  API_DOCS_REGISTRY,
  getDocForEndpoint,
  hasDoc,
  getAllDocEndpoints,
  type ApiDocEntry
} from '@nextsparkjs/registries/api-docs-registry'

// Re-export types for convenience
export type { ApiDocEntry }

/**
 * ApiDocsService
 *
 * Service layer for API documentation queries.
 * All methods are static for consistency with other services.
 */
export class ApiDocsService {
  // ==================== Query Methods ====================

  /**
   * Get documentation entry for an endpoint
   *
   * @param endpoint - The endpoint path (e.g., '/api/v1/customers')
   * @returns Doc entry with path and title, or undefined if not found
   *
   * @example
   * const doc = ApiDocsService.getByEndpoint('/api/v1/customers')
   * if (doc) {
   *   console.log(`Loading doc: ${doc.title}`)
   * }
   */
  static getByEndpoint(endpoint: string): ApiDocEntry | undefined {
    return getDocForEndpoint(endpoint)
  }

  /**
   * Check if an endpoint has documentation
   *
   * @param endpoint - The endpoint path
   * @returns True if documentation exists for this endpoint
   */
  static hasDoc(endpoint: string): boolean {
    return hasDoc(endpoint)
  }

  /**
   * Get all endpoints that have documentation
   *
   * @returns Array of endpoint paths with docs
   */
  static getAllEndpoints(): string[] {
    return getAllDocEndpoints()
  }

  // ==================== Metadata Methods ====================

  /**
   * Get registry metadata
   *
   * @returns Object with totalDocs, generatedAt, themeName
   */
  static getMeta() {
    return API_DOCS_REGISTRY.meta
  }

  /**
   * Get total count of documented endpoints
   *
   * @returns Total number of endpoints with documentation
   */
  static getTotalDocs(): number {
    return API_DOCS_REGISTRY.meta.totalDocs
  }

  // ==================== Utility Methods ====================

  /**
   * Get the file path for an endpoint's documentation
   *
   * @param endpoint - The endpoint path
   * @returns The file path or undefined if no doc exists
   */
  static getDocPath(endpoint: string): string | undefined {
    const doc = getDocForEndpoint(endpoint)
    return doc?.path
  }

  /**
   * Get the title for an endpoint's documentation
   *
   * @param endpoint - The endpoint path
   * @returns The title or undefined if no doc exists
   */
  static getDocTitle(endpoint: string): string | undefined {
    const doc = getDocForEndpoint(endpoint)
    return doc?.title
  }
}
