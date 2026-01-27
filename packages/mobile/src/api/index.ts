/**
 * API Module
 *
 * Client, core services, and entity factory.
 */

// Client
export { apiClient, ApiClient, getApiUrl } from './client'
export { ApiError, type RequestConfig, type PaginatedResponse, type SingleResponse } from './client.types'

// Core services
export { authApi } from './core/auth'
export { teamsApi } from './core/teams'
export type { User, Team, AuthSession, LoginResponse, SessionResponse, TeamsResponse } from './core/types'

// Entity factory
export { createEntityApi } from './entities/factory'
export type { EntityApi, EntityListParams } from './entities/types'
