/**
 * API Module
 *
 * Central export for all API functionality.
 */

// Base client
export { apiClient, ApiError } from './client'
export * from './client.types'

// Core services (auth, teams)
export * from './core'

// Entity factory
export * from './entities'

// Custom routes
export * from './custom'
