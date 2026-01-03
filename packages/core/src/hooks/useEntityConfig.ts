import { useState, useEffect, useCallback } from 'react'
import { getAllEntityConfigs } from '../lib/entities/registry.client'
import { EntityConfig } from '../lib/entities/types'

interface EntityConfigState {
  config: EntityConfig | null
  isLoading: boolean
  error: string | null
  isOverride: boolean
}

interface UseEntityConfigOptions {
  /**
   * Si true, no muestra logs de debug en consola
   */
  silent?: boolean
  /**
   * Si true, cachea la configuración para evitar re-fetches
   */
  cache?: boolean
}

// Cache global para evitar múltiples fetches del mismo entity
const configCache = new Map<string, EntityConfig>()
let registryLoaded = false

/**
 * Hook centralizado para cargar y manejar configuraciones de entidades
 * Elimina la duplicación de código entre EntityListWrapper, EntityFormWrapper y EntityDetailWrapper
 */
export function useEntityConfig(
  entityType: string, 
  options: UseEntityConfigOptions = {}
): EntityConfigState {
  const { silent = false, cache = true } = options
  
  const [state, setState] = useState<EntityConfigState>({
    config: null,
    isLoading: true,
    error: null,
    isOverride: false
  })

  // Función para detectar si existe override personalizado
  const detectOverride = useCallback((entityName: string): boolean => {
    // En tiempo de ejecución, no podemos usar fs.existsSync
    // Pero podemos inferir basado en la estructura conocida
    // Por ahora, solo tasks tiene override conocido
    const knownOverrides = ['tasks']
    return knownOverrides.includes(entityName.toLowerCase())
  }, [])

  const loadEntityConfig = useCallback(() => {
    if (!entityType) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Entity type is required'
      }))
      return
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      // Verificar cache primero
      if (cache && configCache.has(entityType)) {
        const cachedConfig = configCache.get(entityType)!
        const hasOverride = detectOverride(entityType)

        setState({
          config: cachedConfig,
          isLoading: false,
          error: null,
          isOverride: hasOverride
        })

        if (!silent) {
          console.log(`[useEntityConfig] Cache hit for ${entityType}`, {
            config: cachedConfig,
            hasOverride
          })
        }
        return
      }

      // Get from client registry (populated by server component)
      const allEntities = getAllEntityConfigs()
      const foundEntity = allEntities.find(entity => entity.slug === entityType)

      if (!foundEntity) {
        const error = `Entidad "${entityType}" no encontrada en el registry`
        setState({
          config: null,
          isLoading: false,
          error,
          isOverride: false
        })

        if (!silent) {
          console.error(`[useEntityConfig] ${error}`, {
            entityType,
            availableEntities: allEntities.map(e => e.slug)
          })
        }
        return
      }

      // Detectar si tiene override
      const hasOverride = detectOverride(entityType)

      // Cachear la configuración
      if (cache) {
        configCache.set(entityType, foundEntity)
      }

      setState({
        config: foundEntity,
        isLoading: false,
        error: null,
        isOverride: hasOverride
      })

      if (!silent) {
        console.log(`[useEntityConfig] Loaded config for ${entityType}`, {
          config: foundEntity,
          hasOverride,
          cached: cache
        })
      }

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error desconocido al cargar configuración de entidad'
      setState({
        config: null,
        isLoading: false,
        error,
        isOverride: false
      })
      
      if (!silent) {
        console.error(`[useEntityConfig] Error loading config for ${entityType}:`, err)
      }
    }
  }, [entityType, cache, silent, detectOverride])

  useEffect(() => {
    loadEntityConfig()
  }, [loadEntityConfig])

  return state
}

/**
 * Función para pre-cargar y cachear todas las configuraciones de entidades
 * Útil para llamar en el layout principal
 */
export function preloadEntityConfigs(): void {
  if (registryLoaded) return

  try {
    const allEntities = getAllEntityConfigs()

    // Cachear todas las configuraciones
    allEntities.forEach(entity => {
      configCache.set(entity.slug, entity)
    })

    registryLoaded = true
    console.log('[useEntityConfig] Preloaded all entity configurations', {
      count: allEntities.length,
      entities: allEntities.map(e => e.slug)
    })
  } catch (error) {
    console.error('[useEntityConfig] Error preloading entity configurations:', error)
  }
}

/**
 * Función para limpiar el cache (útil para testing)
 */
export function clearEntityConfigCache(): void {
  configCache.clear()
  registryLoaded = false
  console.log('[useEntityConfig] Cache cleared')
}

/**
 * Función para obtener estadísticas del cache
 */
export function getEntityConfigCacheStats() {
  return {
    size: configCache.size,
    entities: Array.from(configCache.keys()),
    registryLoaded
  }
}
