'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from './useAuth'
import { ENTITY_REGISTRY, type EntityRegistryEntry } from '../lib/entities/queries'
import type { EntityConfig } from '../lib/entities/types'
import type { SearchResultType } from '@nextsparkjs/registries/entity-types'
import { SEARCH_TYPE_PRIORITIES } from '@nextsparkjs/registries/entity-types'

export interface SearchResult {
  id: string
  title: string
  description?: string
  type: SearchResultType
  url: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
  completed?: boolean
  entityType?: string
  status?: string
}

// Función para filtrar entidades searchables del registro
const getSearchableEntities = (): EntityRegistryEntry[] => {
  return Object.values(ENTITY_REGISTRY).filter(entry => {
    const config = entry.config as EntityConfig
    return config.ui?.features?.searchable === true
  }) as EntityRegistryEntry[]
}

// Función para generar SearchResults desde entidades del registro
const generateEntitySearchResults = (): SearchResult[] => {
  const searchableEntities = getSearchableEntities()

  return searchableEntities.map(entry => {
    const config = entry.config as EntityConfig
    const entityName = config.slug || entry.name
    const displayName = config.names?.singular || entityName

    return {
      id: `entity-${entry.name}`,
      title: displayName,
      description: `Gestión de ${config.names?.plural?.toLowerCase() || displayName.toLowerCase()}`,
      type: entry.name as any, // Map to specific entity types
      url: `/dashboard/${config.slug || entry.name}`,
      category: 'Entidades',
      entityType: entry.name,
      priority: 'medium' as const
    }
  })
}

// Función para obtener campos searchables de una entidad
const getSearchableFields = (entityConfig: EntityConfig): string[] => {
  if (!entityConfig.fields) return []

  return entityConfig.fields
    .filter(field => field.api?.searchable === true)
    .map(field => field.name)
}

// Páginas y configuraciones también buscables
const SYSTEM_PAGES: Omit<SearchResult, 'id'>[] = [
  {
    title: 'Dashboard',
    description: 'Panel principal con estadísticas y acciones rápidas',
    type: 'page',
    url: '/dashboard'
  },
  {
    title: 'Gestión de Tareas',
    description: 'Crear, editar y organizar tus tareas',
    type: 'page',
    url: '/dashboard/tasks'
  },
  {
    title: 'Configuración de Perfil',
    description: 'Actualizar información personal y preferencias',
    type: 'setting',
    url: '/dashboard/settings/profile'
  },
  {
    title: 'Configuración de Seguridad',
    description: 'Autenticación de dos factores y sesiones activas',
    type: 'setting',
    url: '/dashboard/settings/security'
  },
  {
    title: 'Configuración de Notificaciones',
    description: 'Preferencias de emails y notificaciones push',
    type: 'setting',
    url: '/dashboard/settings/notifications'
  },
  {
    title: 'Configuración de Contraseña',
    description: 'Cambiar contraseña y opciones de seguridad',
    type: 'setting',
    url: '/dashboard/settings/password'
  },
  {
    title: 'Facturación',
    description: 'Planes, métodos de pago y historial de facturación',
    type: 'setting',
    url: '/dashboard/settings/billing'
  }
]

export function useSearch() {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const { user } = useAuth()

  // Generar resultados de búsqueda dinámicamente desde entidades registradas
  const entityResults = useMemo(() => {
    return generateEntitySearchResults()
  }, [])

  // Todos los elementos buscables (entidades + páginas del sistema)
  const allSearchableItems = useMemo(() => {
    const systemResults = SYSTEM_PAGES.map((page, index) => ({
      id: `page-${index}`,
      ...page
    }))
    return [...entityResults, ...systemResults]
  }, [entityResults])

  // Función de búsqueda
  const performSearch = useMemo(() => {
    return (searchQuery: string): SearchResult[] => {
      if (!searchQuery.trim()) return []

      const lowercaseQuery = searchQuery.toLowerCase()
      
      return allSearchableItems
        .filter(item => {
          const titleMatch = item.title.toLowerCase().includes(lowercaseQuery)
          const descriptionMatch = item.description?.toLowerCase().includes(lowercaseQuery)
          const categoryMatch = item.category?.toLowerCase().includes(lowercaseQuery)
          
          return titleMatch || descriptionMatch || categoryMatch
        })
        .sort((a, b) => {
          // Priorizar por relevancia
          const aScore = getRelevanceScore(a, lowercaseQuery)
          const bScore = getRelevanceScore(b, lowercaseQuery)
          
          if (aScore !== bScore) {
            return bScore - aScore
          }
          
          // Priorizar por tipo usando prioridades auto-generadas del registro
          const aTypeScore = SEARCH_TYPE_PRIORITIES[a.type] || 0
          const bTypeScore = SEARCH_TYPE_PRIORITIES[b.type] || 0

          if (aTypeScore !== bTypeScore) {
            return bTypeScore - aTypeScore
          }

          // Si son del mismo tipo y tienen prioridad, ordenar por prioridad
          if (a.priority && b.priority) {
            const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 }
            return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
          }
          
          return a.title.localeCompare(b.title)
        })
        .slice(0, 8) // Limitar a 8 resultados
    }
  }, [allSearchableItems])

  // Función para calcular relevancia
  const getRelevanceScore = (item: SearchResult, query: string): number => {
    let score = 0
    
    // Coincidencia exacta en título
    if (item.title.toLowerCase() === query) score += 100
    
    // Título empieza con query
    if (item.title.toLowerCase().startsWith(query)) score += 50
    
    // Título contiene query
    if (item.title.toLowerCase().includes(query)) score += 25
    
    // Descripción contiene query
    if (item.description?.toLowerCase().includes(query)) score += 10
    
    // Categoría contiene query
    if (item.category?.toLowerCase().includes(query)) score += 5
    
    return score
  }

  // Efecto para búsqueda en tiempo real
  useEffect(() => {
    if (!user) {
      setResults([])
      return
    }

    const trimmedQuery = query.trim()
    
    if (trimmedQuery.length === 0) {
      setResults([])
      setIsSearching(false)
      return
    }

    if (trimmedQuery.length < 2) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    // Simular delay de búsqueda
    const searchTimeout = setTimeout(() => {
      const searchResults = performSearch(trimmedQuery)
      setResults(searchResults)
      setIsSearching(false)
    }, 150)

    return () => clearTimeout(searchTimeout)
  }, [query, user, performSearch])

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setIsSearching(false)
  }

  return {
    query,
    setQuery,
    results,
    isSearching,
    clearSearch,
    hasResults: results.length > 0,
    isEmpty: query.trim().length === 0
  }
}
