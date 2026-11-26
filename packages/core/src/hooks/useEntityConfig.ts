import { useState, useEffect, useCallback } from 'react'
import { getAllEntityConfigs } from '../lib/entities/registry.client'
import { EntityConfig } from '../lib/entities/types'
import { useLocalizedEntityConfig } from './useEntityText'

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
  /**
   * Si true, la primera render ya trae la configuración cuando el registro del cliente está poblado
   * (DashboardShell lo puebla durante su render, también en el servidor), así el HTML del servidor
   * incluye lo que depende de la entidad en vez de un esqueleto.
   */
  eager?: boolean
}

// Cache global para evitar múltiples fetches del mismo entity
const configCache = new Map<string, EntityConfig>()
// Por ahora, solo tasks tiene override conocido
const knownOverrides = ['tasks']
let registryLoaded = false

// El estado de la entidad si ya se puede leer (cache o registro del cliente), sin tocar estado de React
function readState(entityType: string, cache: boolean): EntityConfigState {
  const config = (cache && configCache.get(entityType)) || getAllEntityConfigs().find(entity => entity.slug === entityType) || null
  return { config, isLoading: !config, error: null, isOverride: config !== null && knownOverrides.includes(entityType.toLowerCase()) }
}

/**
 * Hook centralizado para cargar y manejar configuraciones de entidades
 * Elimina la duplicación de código entre EntityListWrapper, EntityFormWrapper y EntityDetailWrapper
 */
export function useEntityConfig(
  entityType: string, 
  options: UseEntityConfigOptions = {}
): EntityConfigState {
  const { silent = false, cache = true, eager = false } = options

  const [state, setState] = useState<EntityConfigState>(() =>
    eager ? readState(entityType, cache) : { config: null, isLoading: true, error: null, isOverride: false }
  )

  const loadEntityConfig = useCallback(() => {
    // Un solo estado de falla; el log de cada causa lo escribe quien la detecta
    const fail = (error: string, ...log: unknown[]) => {
      setState({ config: null, isLoading: false, error, isOverride: false })
      if (!silent) console.error(...log)
    }

    if (!entityType) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Entity type is required'
      }))
      return
    }

    try {
      // Cache o registro del cliente (poblado por DashboardShell)
      const found = readState(entityType, cache)

      if (!found.config) {
        const error = `Entity "${entityType}" not found in the registry`
        // Qué entidades hay se ve solo en desarrollo: en producción el log es el mensaje
        if (process.env.NODE_ENV === 'development' && !silent) console.error('[useEntityConfig] registered entities:', getAllEntityConfigs().map(e => e.slug))
        return fail(error, `[useEntityConfig] ${error}`)
      }

      if (cache) {
        configCache.set(entityType, found.config)
      }

      setState(found)
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Unknown error loading entity configuration', `[useEntityConfig] Error loading config for ${entityType}:`, err)
    }
  }, [entityType, cache, silent])

  useEffect(() => {
    loadEntityConfig()
  }, [loadEntityConfig])

  // Names, labels, placeholders and options in the active locale, from the entity's catalog (#421)
  const config = useLocalizedEntityConfig(state.config)
  return config === state.config ? state : { ...state, config }
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
    if (process.env.NODE_ENV === 'development') console.log('[useEntityConfig] Preloaded all entity configurations', {
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
  if (process.env.NODE_ENV === 'development') console.log('[useEntityConfig] Cache cleared')
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
