"use client"

import * as React from "react"
import { parseChildEntity, getEntityApiPath } from '@nextsparkjs/registries/entity-registry.client'

interface RelationDisplayProps {
  value: string | string[] | null
  entityType: string
  titleField?: string
  parentId?: string
  multiple?: boolean
  // For display mode, we might need to get parentId from the record data
  recordData?: Record<string, unknown>
  parentIdField?: string
  // Team ID for team-scoped entity queries
  teamId?: string
}


export function RelationDisplay({
  value,
  entityType,
  titleField,
  parentId,
  multiple = false,
  teamId
}: RelationDisplayProps) {
  const [titles, setTitles] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(false)

  // Normalize value to array of IDs
  const ids = React.useMemo(() => {
    if (!value) return []
    
    if (Array.isArray(value)) {
      return value.filter(id => typeof id === 'string' && id.trim() !== '')
    }
    
    if (typeof value === 'string') {
      // Handle JSON string for multi-select
      if (multiple && value.startsWith('[')) {
        try {
          const parsed = JSON.parse(value)
          return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string' && id.trim() !== '') : []
        } catch {
          return value.trim() !== '' ? [value] : []
        }
      }
      return value.trim() !== '' ? [value] : []
    }
    
    return []
  }, [value, multiple])

  // Keep track of loaded IDs to prevent unnecessary requests
  const loadedIdsRef = React.useRef<string[]>([])

  // Load titles for IDs
  React.useEffect(() => {
    if (ids.length === 0) {
      setTitles({})
      loadedIdsRef.current = []
      return
    }

    // Check if we already loaded these exact IDs
    const idsString = ids.sort().join(',')
    const loadedIdsString = loadedIdsRef.current.sort().join(',')
    
    if (idsString === loadedIdsString) {
      // We already loaded these exact IDs
      return
    }

    const loadTitles = async () => {
      setLoading(true)
      try {
        let url: URL
        
        // Check if this is a child entity that needs special handling
        const childInfo = parseChildEntity(entityType)
        if (childInfo.isChild && childInfo.parentEntity && childInfo.childType && parentId) {
          // Use child entity API: /api/v1/{parent}s/{parentId}/child/{childType}
          const parentApiPath = getEntityApiPath(childInfo.parentEntity)
          if (parentApiPath) {
            url = new URL(`/api/v1/${parentApiPath}/${parentId}/child/${childInfo.childType}`, window.location.origin)
            // Note: Child entities API doesn't support 'ids' parameter, so we'll filter on frontend
          } else {
            console.warn(`No API path found for parent entity: ${childInfo.parentEntity}`)
            setLoading(false)
            return
          }
        } else {
          // Regular entity - use specific entity API
          const apiPath = getEntityApiPath(entityType)
          const hasSpecificAPI = apiPath !== null

          if (hasSpecificAPI) {
            url = new URL(`/api/v1/${apiPath}`, window.location.origin)
            url.searchParams.set('ids', ids.join(','))
            if (parentId) {
              url.searchParams.set('parentId', parentId)
            }
          } else {
            console.warn(`No specific API available for entity type: ${entityType}`)
            setLoading(false)
            return
          }
        }

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(teamId && { 'x-team-id': teamId })
          },
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()

          // Handle child entity or specific entity API response format
          if (data.success && Array.isArray(data.data)) {
            const newTitles: Record<string, string> = {}

            // Filter data for child entities since they don't support 'ids' parameter
            const filteredData = childInfo.isChild
              ? data.data.filter((item: Record<string, unknown>) => {
                  const itemId = String(item.id || '')
                  return ids.includes(itemId)
                })
              : data.data

            filteredData.forEach((item: Record<string, unknown>) => {
              const id = String(item.id || '')
              const title = String(item[titleField || 'name'] || item.name || item.title || id)
              newTitles[id] = title
            })
            setTitles(newTitles)
          }

          loadedIdsRef.current = [...ids]
        }
      } catch (error) {
        console.error(`Error loading titles for ${entityType}:`, error)
      } finally {
        setLoading(false)
      }
    }

    loadTitles()
  }, [ids, entityType, titleField, parentId, teamId])

  // Render the display
  if (ids.length === 0) {
    return <span>-</span>
  }

  if (loading && Object.keys(titles).length === 0) {
    return <span className="text-muted-foreground">Cargando...</span>
  }

  const displayValues = ids.map(id => titles[id] || id)
  
  if (multiple) {
    return <span>{displayValues.join(', ')}</span>
  }
  
  return <span>{displayValues[0]}</span>
}
