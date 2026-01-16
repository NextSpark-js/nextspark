/**
 * Hook for Quick Create entities
 * Gets entities from client registry (populated by server component)
 * Filters by user permissions
 */

import { useState, useEffect, useMemo } from 'react'
import { getAllEntityConfigs } from '../lib/entities/registry.client'
import { useAllPermissions } from '../lib/permissions/hooks'
import type { EntityConfig } from '../lib/entities/types'

export function useQuickCreateEntities() {
  const [allEntities, setAllEntities] = useState<EntityConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get all user permissions
  const userPermissions = useAllPermissions()

  useEffect(() => {
    try {
      setIsLoading(true)
      setError(null)

      // Get entities from client registry (populated by server component via EntityProvider)
      const entities = getAllEntityConfigs()
      // Filter by enabled and showInTopbar only
      // User's create permission is checked later using centralized PermissionService
      const topbarEntities = entities.filter(entity =>
        entity.enabled &&
        entity.ui?.dashboard?.showInTopbar
      )

      setAllEntities(topbarEntities)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load entities'
      console.warn('Error loading entities for quick create:', err)
      setError(errorMessage)
      setAllEntities([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Filter entities by user permissions
  const filteredEntities = useMemo(() => {
    if (allEntities.length === 0) return []

    return allEntities.filter(entity => {
      // Check if user has create permission for this entity
      const createPermission = `${entity.slug}.create` as `${string}.${string}`
      return userPermissions.includes(createPermission)
    })
  }, [allEntities, userPermissions])

  return {
    entities: filteredEntities,
    isLoading,
    error,
    hasEntities: filteredEntities.length > 0
  }
}
