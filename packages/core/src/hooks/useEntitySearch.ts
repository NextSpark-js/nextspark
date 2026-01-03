'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from './useAuth'
import { extractUserPlanData } from '../lib/user-data-utils'
import { getEnabledEntities } from '../lib/entities/registry.client'
import type { EntityConfig } from '../lib/entities/types'

export interface EntitySearchResult {
  id: string
  title: string
  description?: string
  entityType: string
  type: 'entity' | 'system'
  url: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
  completed?: boolean
  icon?: string
  limitInfo?: {
    current: number
    max: number | 'unlimited'
    canCreate: boolean
  }
}

interface EntitySearchHookResult {
  query: string
  setQuery: (query: string) => void
  results: EntitySearchResult[]
  isSearching: boolean
  clearSearch: () => void
  hasResults: boolean
  isEmpty: boolean
  availableEntities: EntityConfig[]
}

/**
 * Enhanced search hook that integrates with the Entity System
 * Supports automatic entity discovery, permission validation, and plan limits
 */
export function useEntitySearch(): EntitySearchHookResult {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<EntitySearchResult[]>([])
  const { user } = useAuth()

  // Get user plan and flags data
  const userPlanData = useMemo(() => {
    return extractUserPlanData(user)
  }, [user])

  // Get entities available to the user based on permissions and plan
  const [availableEntities, setAvailableEntities] = useState<EntityConfig[]>([])

  useEffect(() => {
    if (!user || !user.role) {
      setAvailableEntities([])
      return
    }

    try {
      // Get entities from client registry (populated by server component)
      const entities = getEnabledEntities().filter(entity =>
        entity.enabled &&
        entity.ui?.features?.searchable
      )
      setAvailableEntities(entities)
    } catch (error) {
      console.error('Error getting user entities for search:', error)
      setAvailableEntities([])
    }
  }, [user])

  // Generate system page results
  const systemResults = useMemo((): EntitySearchResult[] => {
    const systemPages = [
      {
        id: 'dashboard',
        title: 'Dashboard',
        description: 'Panel principal con estadísticas y acciones rápidas',
        url: '/dashboard',
        category: 'Navigation'
      },
      {
        id: 'profile',
        title: 'Configuración de Perfil',
        description: 'Actualizar información personal y preferencias',
        url: '/dashboard/settings/profile',
        category: 'Settings'
      },
      {
        id: 'security',
        title: 'Configuración de Seguridad', 
        description: 'Autenticación de dos factores y sesiones activas',
        url: '/dashboard/settings/security',
        category: 'Settings'
      },
      {
        id: 'notifications',
        title: 'Configuración de Notificaciones',
        description: 'Preferencias de emails y notificaciones push',
        url: '/dashboard/settings/notifications',
        category: 'Settings'
      },
      {
        id: 'billing',
        title: 'Facturación',
        description: 'Planes, métodos de pago y historial de facturación',
        url: '/dashboard/settings/billing', 
        category: 'Settings'
      }
    ]

    return systemPages.map(page => ({
      ...page,
      entityType: 'system',
      type: 'system' as const,
      priority: 'low' as const
    }))
  }, [])

  // Generate entity results with limit information
  const entityResults = useMemo((): EntitySearchResult[] => {
    if (!availableEntities.length) return []

    return availableEntities.map(entity => ({
      id: `entity-${entity.slug}`,
      title: entity.names.singular,
      description: `Gestionar ${entity.names.plural.toLowerCase()}`,
      entityType: entity.slug,
      type: 'entity' as const,
      url: `/dashboard/${entity.slug}`,
      category: 'Entities',
      priority: 'medium' as const,
      icon: entity.icon.name || 'FileText',
      limitInfo: {
        current: 0, // This would be fetched from actual usage data
        max: userPlanData.plan === 'premium' ? 'unlimited' : 
             userPlanData.plan === 'starter' ? 100 : 10,
        canCreate: true // This would be calculated based on current usage vs limits
      }
    }))
  }, [availableEntities, userPlanData.plan])

  // All searchable items
  const allSearchableItems = useMemo(() => {
    return [...entityResults, ...systemResults]
  }, [entityResults, systemResults])

  // Calculate relevance score for search result
  const getRelevanceScore = useCallback((item: EntitySearchResult, query: string): number => {
    let score = 0
    
    // Exact match in title
    if (item.title.toLowerCase() === query) score += 100
    
    // Title starts with query
    if (item.title.toLowerCase().startsWith(query)) score += 50
    
    // Title contains query
    if (item.title.toLowerCase().includes(query)) score += 25
    
    // Entity type exact match (e.g., searching "task" matches task entity)
    if (item.entityType.toLowerCase() === query) score += 80
    
    // Entity type contains query
    if (item.entityType.toLowerCase().includes(query)) score += 30
    
    // Description contains query
    if (item.description?.toLowerCase().includes(query)) score += 10
    
    // Category contains query
    if (item.category?.toLowerCase().includes(query)) score += 5
    
    // Boost entity results over system results
    if (item.type === 'entity') score += 5
    
    return score
  }, [])

  // Enhanced search function with entity-specific logic
  const performSearch = useCallback((searchQuery: string): EntitySearchResult[] => {
    if (!searchQuery.trim()) return []

    const lowercaseQuery = searchQuery.toLowerCase()
    
    return allSearchableItems
      .filter(item => {
        // Basic text matching
        const titleMatch = item.title.toLowerCase().includes(lowercaseQuery)
        const descriptionMatch = item.description?.toLowerCase().includes(lowercaseQuery)
        const categoryMatch = item.category?.toLowerCase().includes(lowercaseQuery)
        const entityTypeMatch = item.entityType.toLowerCase().includes(lowercaseQuery)
        
        return titleMatch || descriptionMatch || categoryMatch || entityTypeMatch
      })
      .sort((a, b) => {
        // Calculate relevance scores
        const aScore = getRelevanceScore(a, lowercaseQuery)
        const bScore = getRelevanceScore(b, lowercaseQuery)
        
        if (aScore !== bScore) {
          return bScore - aScore
        }
        
        // Prioritize entities over system pages
        if (a.type === 'entity' && b.type === 'system') return -1
        if (a.type === 'system' && b.type === 'entity') return 1
        
        // Sort by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        const aPriority = priorityOrder[a.priority || 'low']
        const bPriority = priorityOrder[b.priority || 'low']
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority
        }
        
        return a.title.localeCompare(b.title)
      })
      .slice(0, 12) // Show up to 12 results
  }, [allSearchableItems, getRelevanceScore])

  // Perform search with debouncing
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

    // Debounce search
    const searchTimeout = setTimeout(() => {
      try {
        const searchResults = performSearch(trimmedQuery)
        setResults(searchResults)
      } catch (error) {
        console.error('Error performing search:', error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 150)

    return () => clearTimeout(searchTimeout)
  }, [query, user, performSearch])

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setIsSearching(false)
  }, [])

  return {
    query,
    setQuery,
    results,
    isSearching,
    clearSearch,
    hasResults: results.length > 0,
    isEmpty: query.trim().length === 0,
    availableEntities
  }
}