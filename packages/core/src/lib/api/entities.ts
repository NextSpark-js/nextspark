/**
 * Entity API Client
 *
 * Centralized API client for entity CRUD operations
 */

import { clientMetaSystemAdapter } from '@nextsparkjs/registries/entity-registry.client'

export interface EntityData {
  id?: string
  [key: string]: unknown
}

export interface EntityListParams {
  page?: number
  limit?: number
  userId?: string
  filters?: Record<string, string>
  includeMeta?: boolean
}

export interface EntityListResponse {
  success: true
  data: EntityData[]
  info: {
    timestamp: string
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface EntityStats {
  total: number
  recentCount: number
  growth: number
  status?: {
    [key: string]: number
  }
}

export interface BulkOperation {
  id: string
  name: string
  description: string
  icon?: string
  requiresConfirmation?: boolean
}

export interface DashboardEntityResponse {
  success: true
  data: EntityData[]
  stats: EntityStats
  availableOperations: BulkOperation[]
  info: {
    timestamp: string
    entityType: string
    hasOverride: boolean
  }
}

/**
 * Get base URL for API calls - works in both server and client contexts
 */
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side
    return window.location.origin
  } else {
    // Server-side - use environment variable or localhost fallback
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'
  }
}

/**
 * Get current team ID from localStorage (client-side only)
 * Required for team-based entity isolation (Phase 2)
 */
function getCurrentTeamId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeTeamId')
  }
  return null
}

/**
 * Build headers including team context
 */
function buildHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders
  }

  const teamId = getCurrentTeamId()
  if (teamId) {
    headers['x-team-id'] = teamId
  }

  return headers
}

/**
 * Generic entity API client
 */
export class EntityApiClient {
  private baseUrl: string

  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl
  }

  /**
   * Get endpoint path from entity configuration using slug
   * This ensures consistent URLs across routes, endpoints, and navigation
   */
  private async getEndpointPath(entityType: string): Promise<string> {
    try {
      // Primary method: Use client-safe config directly (most reliable)
      const apiPath = clientMetaSystemAdapter.getApiPath(entityType)

      if (apiPath) {
        return apiPath
      }

      // Secondary method: Try client-only registry
      try {
        const entities = clientMetaSystemAdapter.getAllEntityConfigs()

        // Find entity by name and return its apiPath
        const entity = entities.find(config => config.name === entityType)

        if (entity?.apiPath) {
          return entity.apiPath
        }
      } catch (registryError) {
        console.warn(`Registry fallback failed for '${entityType}':`, registryError)
      }
      
      // Last resort: pluralized name (but avoid double pluralization)
      const fallback = entityType.endsWith('s') ? entityType : `${entityType}s`
      console.warn(`Using fallback endpoint for '${entityType}': ${fallback}`)
      return fallback
      
    } catch (error) {
      console.error(`Error loading entity config for '${entityType}':`, error)
      // Fallback to pluralized name (but avoid double pluralization)
      const fallback = entityType.endsWith('s') ? entityType : `${entityType}s`
      return fallback
    }
  }

  /**
   * Get list of entities
   */
  async list(entityType: string, params: EntityListParams = {}): Promise<EntityListResponse> {
    const endpointPath = await this.getEndpointPath(entityType)
    const url = new URL(`${this.baseUrl}/${endpointPath}`, getApiBaseUrl())
    
    if (params.page) url.searchParams.set('page', params.page.toString())
    if (params.limit) url.searchParams.set('limit', params.limit.toString())
    if (params.userId) url.searchParams.set('userId', params.userId)
    if (params.includeMeta) url.searchParams.set('includeMeta', 'true')
    
    // Add filters
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: buildHeaders(),
      credentials: 'include', // Include cookies for session auth
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))

      // Create user-friendly error messages
      let userMessage = `Error al cargar ${entityType}`

      if (response.status === 401) {
        userMessage = 'No tienes permisos para acceder a estos datos. Por favor, inicia sesión nuevamente.'
      } else if (response.status === 403) {
        userMessage = 'No tienes los permisos necesarios para realizar esta acción.'
      } else if (response.status === 404) {
        userMessage = 'Los datos solicitados no fueron encontrados.'
      } else if (response.status === 400 && errorData.code === 'TEAM_CONTEXT_REQUIRED') {
        // Team context not yet loaded - this is expected during initial load
        // Return empty response to allow UI to show loading state
        console.warn('[EntityApiClient] Team context not ready yet, returning empty list')
        return {
          success: true,
          data: [],
          info: {
            timestamp: new Date().toISOString(),
            page: 1,
            limit: params.limit || 20,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false
          }
        } as EntityListResponse
      } else if (response.status >= 500) {
        userMessage = 'Error interno del servidor. Por favor, intenta más tarde.'
      } else if (errorData.message && !errorData.message.includes('API key')) {
        userMessage = errorData.message
      }

      throw new Error(userMessage)
    }

    return response.json()
  }

  /**
   * Get single entity by ID
   */
  async get(entityType: string, id: string, includeMeta = false): Promise<EntityData> {
    const endpointPath = await this.getEndpointPath(entityType)
    const url = new URL(`${this.baseUrl}/${endpointPath}/${id}`, getApiBaseUrl())

    if (includeMeta) {
      url.searchParams.set('includeMeta', 'true')
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: buildHeaders(),
      credentials: 'include', // Include cookies for session auth
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // Create user-friendly error messages
      let userMessage = `Error al cargar ${entityType}`
      
      if (response.status === 401) {
        userMessage = 'No tienes permisos para acceder a estos datos. Por favor, inicia sesión nuevamente.'
      } else if (response.status === 403) {
        userMessage = 'No tienes los permisos necesarios para realizar esta acción.'
      } else if (response.status === 404) {
        userMessage = 'El elemento solicitado no fue encontrado.'
      } else if (response.status >= 500) {
        userMessage = 'Error interno del servidor. Por favor, intenta más tarde.'
      } else if (errorData.message && !errorData.message.includes('API key')) {
        userMessage = errorData.message
      }
      
      throw new Error(userMessage)
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Create new entity
   */
  async create(entityType: string, data: EntityData): Promise<EntityData> {
    const endpointPath = await this.getEndpointPath(entityType)
    const response = await fetch(`${this.baseUrl}/${endpointPath}`, {
      method: 'POST',
      headers: buildHeaders(),
      credentials: 'include', // Include cookies for session auth
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // Create user-friendly error messages
      let userMessage = `Error al crear ${entityType}`
      
      if (response.status === 401) {
        userMessage = 'No tienes permisos para crear este elemento. Por favor, inicia sesión nuevamente.'
      } else if (response.status === 403) {
        userMessage = 'No tienes los permisos necesarios para crear este elemento.'
      } else if (response.status === 400) {
        userMessage = 'Los datos proporcionados no son válidos. Por favor, revisa el formulario.'
      } else if (response.status >= 500) {
        userMessage = 'Error interno del servidor. Por favor, intenta más tarde.'
      } else if (errorData.message && !errorData.message.includes('API key')) {
        userMessage = errorData.message
      }
      
      throw new Error(userMessage)
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Update entity
   */
  async update(entityType: string, id: string, data: Partial<EntityData>): Promise<EntityData> {
    const endpointPath = await this.getEndpointPath(entityType)
    const response = await fetch(`${this.baseUrl}/${endpointPath}/${id}`, {
      method: 'PATCH',
      headers: buildHeaders(),
      credentials: 'include', // Include cookies for session auth
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // Create user-friendly error messages
      let userMessage = `Error al actualizar ${entityType}`
      
      if (response.status === 401) {
        userMessage = 'No tienes permisos para actualizar este elemento. Por favor, inicia sesión nuevamente.'
      } else if (response.status === 403) {
        userMessage = 'No tienes los permisos necesarios para actualizar este elemento.'
      } else if (response.status === 404) {
        userMessage = 'El elemento que intentas actualizar no fue encontrado.'
      } else if (response.status === 400) {
        userMessage = 'Los datos proporcionados no son válidos. Por favor, revisa el formulario.'
      } else if (response.status >= 500) {
        userMessage = 'Error interno del servidor. Por favor, intenta más tarde.'
      } else if (errorData.message && !errorData.message.includes('API key')) {
        userMessage = errorData.message
      }
      
      throw new Error(userMessage)
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Delete entity
   */
  async delete(entityType: string, id: string): Promise<{ deleted: boolean; id: string }> {
    const endpointPath = await this.getEndpointPath(entityType)
    const response = await fetch(`${this.baseUrl}/${endpointPath}/${id}`, {
      method: 'DELETE',
      headers: buildHeaders(),
      credentials: 'include', // Include cookies for session auth
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // Create user-friendly error messages
      let userMessage = `Error al eliminar ${entityType}`
      
      if (response.status === 401) {
        userMessage = 'No tienes permisos para eliminar este elemento. Por favor, inicia sesión nuevamente.'
      } else if (response.status === 403) {
        userMessage = 'No tienes los permisos necesarios para eliminar este elemento.'
      } else if (response.status === 404) {
        userMessage = 'El elemento que intentas eliminar no fue encontrado.'
      } else if (response.status >= 500) {
        userMessage = 'Error interno del servidor. Por favor, intenta más tarde.'
      } else if (errorData.message && !errorData.message.includes('API key')) {
        userMessage = errorData.message
      }
      
      throw new Error(userMessage)
    }

    const result = await response.json()
    return result.data
  }

  // ========================================
  // DASHBOARD-SPECIFIC METHODS
  // ========================================

  /**
   * Get dashboard data with stats and bulk operations
   * Optimized for dashboard views with additional metadata
   */
  async getDashboardData(entityType: string, params: EntityListParams = {}): Promise<DashboardEntityResponse> {
    try {
      // Get regular entity data
      const listResponse = await this.list(entityType, params)
      
      // Get stats and operations in parallel
      const [stats, operations] = await Promise.all([
        this.getEntityStats(entityType),
        this.getBulkOperations(entityType)
      ])

      // Check if entity has override
      const hasOverride = this.detectEntityOverride(entityType)

      return {
        success: true,
        data: listResponse.data,
        stats,
        availableOperations: operations,
        info: {
          timestamp: new Date().toISOString(),
          entityType,
          hasOverride
        }
      }
    } catch (error) {
      console.error(`[EntityApiClient] Error getting dashboard data for ${entityType}:`, error)
      throw error
    }
  }

  /**
   * Get entity statistics for dashboard metrics
   */
  async getEntityStats(entityType: string): Promise<EntityStats> {
    try {
      const endpointPath = await this.getEndpointPath(entityType)
      const response = await fetch(`${this.baseUrl}/${endpointPath}/stats`, {
        method: 'GET',
        headers: buildHeaders(),
        credentials: 'include',
      })

      if (!response.ok) {
        // If stats endpoint doesn't exist, calculate basic stats from list
        console.warn(`Stats endpoint not available for ${entityType}, calculating basic stats`)
        return this.calculateBasicStats(entityType)
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.warn(`Error getting stats for ${entityType}, falling back to basic stats:`, error)
      return this.calculateBasicStats(entityType)
    }
  }

  /**
   * Calculate basic stats from entity list (fallback)
   */
  private async calculateBasicStats(entityType: string): Promise<EntityStats> {
    try {
      const response = await this.list(entityType, { limit: 100 })
      const total = parseInt(response.info.total.toString())
      
      // Calculate recent items (last 7 days)
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      
      const recentCount = response.data.filter(item => {
        const createdAt = item.createdAt ? new Date(item.createdAt as string) : null
        return createdAt && createdAt > oneWeekAgo
      }).length

      return {
        total,
        recentCount,
        growth: total > 0 ? (recentCount / total) * 100 : 0
      }
    } catch (error) {
      console.error(`Error calculating basic stats for ${entityType}:`, error)
      return {
        total: 0,
        recentCount: 0,
        growth: 0
      }
    }
  }

  /**
   * Get available bulk operations for entity
   */
  async getBulkOperations(entityType: string): Promise<BulkOperation[]> {
    try {
      // Import entity config to check available operations
      const entities = clientMetaSystemAdapter.getAllEntityConfigs()
      const entityConfig = entities.find(config => config.name === entityType)

      if (!entityConfig?.features.enabled) {
        return []
      }

      // Default bulk operations
      const operations: BulkOperation[] = []

      if (entityConfig.features.canDelete) {
        operations.push({
          id: 'bulk-delete',
          name: 'Eliminar Seleccionados',
          description: 'Eliminar múltiples elementos a la vez',
          icon: 'trash',
          requiresConfirmation: true
        })
      }

      if (entityConfig.features.canEdit) {
        operations.push({
          id: 'bulk-edit',
          name: 'Editar Seleccionados',
          description: 'Actualizar múltiples elementos a la vez',
          icon: 'edit'
        })
      }

      // Add export operation if entity supports it
      operations.push({
        id: 'bulk-export',
        name: 'Exportar',
        description: 'Exportar datos seleccionados',
        icon: 'download'
      })

      return operations
    } catch (error) {
      console.error(`Error getting bulk operations for ${entityType}:`, error)
      return []
    }
  }

  /**
   * Execute bulk operation on multiple entities
   */
  async executeBulkOperation(
    entityType: string,
    operationId: string,
    entityIds: string[],
    params?: Record<string, unknown>
  ): Promise<{ success: boolean; processed: number; errors: string[] }> {
    const endpointPath = await this.getEndpointPath(entityType)
    const response = await fetch(`${this.baseUrl}/${endpointPath}/bulk`, {
      method: 'POST',
      headers: buildHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        operation: operationId,
        entityIds,
        params
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Error ejecutando operación ${operationId}`)
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Get entity activity/audit log for dashboard
   */
  async getEntityActivity(entityType: string, limit = 10): Promise<Record<string, unknown>[]> {
    try {
      const endpointPath = await this.getEndpointPath(entityType)
      const response = await fetch(`${this.baseUrl}/${endpointPath}/activity?limit=${limit}`, {
        method: 'GET',
        headers: buildHeaders(),
        credentials: 'include',
      })

      if (!response.ok) {
        // Activity endpoint might not exist, return empty array
        return []
      }

      const result = await response.json()
      return result.data || []
    } catch (error) {
      console.warn(`Activity endpoint not available for ${entityType}:`, error)
      return []
    }
  }

  /**
   * Detect if entity has custom override (client-side detection)
   */
  private detectEntityOverride(entityType: string): boolean {
    // Known entities with overrides
    const knownOverrides = ['tasks']
    return knownOverrides.includes(entityType.toLowerCase())
  }
}

// Default instance
export const entityApi = new EntityApiClient()

// Convenience functions for specific entity types
export const createEntityData = async (entityType: string, data: EntityData) => {
  return entityApi.create(entityType, data)
}

export const updateEntityData = async (entityType: string, id: string, data: Partial<EntityData>) => {
  return entityApi.update(entityType, id, data)
}

export const deleteEntityData = async (entityType: string, id: string) => {
  return entityApi.delete(entityType, id)
}

export const getEntityData = async (entityType: string, id: string, includeMeta = false) => {
  return entityApi.get(entityType, id, includeMeta)
}

export const listEntityData = async (entityType: string, params: EntityListParams = {}) => {
  return entityApi.list(entityType, params)
}

/**
 * Get child entities for a parent entity
 * Example: Get order items for an order
 */
export const getEntityChildren = async (
  parentEntityType: string,
  parentId: string,
  childEntityName: string,
  params: EntityListParams = {}
): Promise<EntityData[]> => {
  // Get endpoint path using the same method as other functions
  const apiPath = clientMetaSystemAdapter.getApiPath(parentEntityType)
  const endpointPath = apiPath || (parentEntityType.endsWith('s') ? parentEntityType : `${parentEntityType}s`)

  const baseUrl = '/api/v1'
  // Correct URL: /api/v1/orders/{id}/child/items (not /api/v1/orders/{id}/items)
  const url = new URL(`${baseUrl}/${endpointPath}/${parentId}/child/${childEntityName}`, getApiBaseUrl())

  // Add query params if provided
  if (params.page) url.searchParams.set('page', params.page.toString())
  if (params.limit) url.searchParams.set('limit', params.limit.toString())
  if (params.includeMeta) url.searchParams.set('metas', 'all')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: buildHeaders(),
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Error loading ${childEntityName} for ${parentEntityType}`)
  }

  const result = await response.json()
  return result.data
}

/**
 * Fetch wrapper that automatically includes team context headers
 * Used by theme components to make API calls with team isolation
 *
 * @param url - The URL to fetch (can be relative like '/api/v1/activities')
 * @param options - Standard fetch options
 * @returns Promise<Response> - The fetch response
 *
 * @example
 * const response = await fetchWithTeam('/api/v1/activities')
 * const data = await response.json()
 */
export async function fetchWithTeam(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get active team ID from localStorage (client-side)
  const activeTeamId = typeof window !== 'undefined'
    ? localStorage.getItem('activeTeamId')
    : null

  // Merge headers with team context
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json')
  }

  if (activeTeamId) {
    headers.set('x-team-id', activeTeamId)
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  })
}
