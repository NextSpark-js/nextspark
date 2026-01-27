/**
 * @nextsparkjs/mobile
 *
 * Mobile app infrastructure for NextSpark.
 * Provides API client, authentication, and utilities for Expo apps.
 */

// API Client
export { apiClient, ApiClient, getApiUrl } from './api/client'
export { ApiError } from './api/client.types'
export type { RequestConfig, PaginatedResponse, SingleResponse } from './api/client.types'

// Entity Factory
export { createEntityApi } from './api/entities/factory'
export type { EntityApi, EntityListParams } from './api/entities/types'

// Core API Services
export { authApi } from './api/core/auth'
export { teamsApi } from './api/core/teams'
export type { User, Team, AuthSession, LoginResponse, SessionResponse, TeamsResponse } from './api/core/types'

// Providers
export { AuthProvider, useAuth } from './providers/AuthProvider'
export { QueryProvider, queryClient } from './providers/QueryProvider'

// Utilities
export * as Storage from './lib/storage'
export { alert, confirm, confirmDestructive, Alert } from './lib/alert'
