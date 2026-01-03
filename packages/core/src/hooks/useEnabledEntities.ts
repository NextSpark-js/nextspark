'use client'

import { useState, useEffect, useMemo } from 'react'
import { getEnabledEntities } from '../lib/entities/registry.client'
import type { EntityConfig } from '../lib/entities/types'

/**
 * Hook to get all enabled entities for dynamic navigation
 * Filters entities based on enabled status and showInMenu flag
 *
 * NOTE: Entities must be initialized via EntityProvider in parent server component
 */
export function useEnabledEntities() {
  const [entities, setEntities] = useState<EntityConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    try {
      setIsLoading(true)

      // Get entities from client registry (populated by server component via EntityProvider)
      const enabledEntities = getEnabledEntities()

      console.log(`[useEnabledEntities] Loaded ${enabledEntities.length} enabled entities:`, enabledEntities.map(e => e.slug))

      setEntities(enabledEntities)
      setError(null)
    } catch (err) {
      console.error('Failed to load entity configurations:', err)
      setError(err instanceof Error ? err : new Error('Failed to load entities'))
      setEntities([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refetch = () => {
    try {
      setIsLoading(true)
      setError(null)

      const enabledEntities = getEnabledEntities()

      console.log(`[useEnabledEntities.refetch] Reloaded ${enabledEntities.length} enabled entities:`, enabledEntities.map(e => e.slug))

      setEntities(enabledEntities)
      setError(null)
    } catch (err) {
      console.error('Failed to reload entity configurations:', err)
      setError(err instanceof Error ? err : new Error('Failed to reload entities'))
    } finally {
      setIsLoading(false)
    }
  }

  return {
    entities,
    isLoading,
    error,
    refetch
  }
}

/**
 * Hook to check if a specific entity is enabled
 * Optimized to avoid re-calling useEnabledEntities multiple times
 */
export function useIsEntityEnabled(entityName: string): boolean {
  const { entities } = useEnabledEntities()
  return useMemo(() =>
    entities.some(entity => entity.slug === entityName && entity.enabled),
    [entities, entityName]
  )
}

/**
 * Hook to get a specific entity configuration from enabled entities list
 * Optimized to avoid re-calling useEnabledEntities multiple times
 * @deprecated Use useEntityConfig from './useEntityConfig' for full-featured config loading
 */
export function useEnabledEntityConfig(entityName: string): EntityConfig | null {
  const { entities } = useEnabledEntities()
  return useMemo(() =>
    entities.find(entity => entity.slug === entityName) || null,
    [entities, entityName]
  )
}