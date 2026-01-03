/**
 * Entity Detail Wrapper
 *
 * High-level wrapper that converts entityType string to entityConfig
 * and handles data loading logic
 *
 * Refactored to use useEntityConfig hook for better performance and consistency
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { EntityDetail, CustomSectionConfig } from '../EntityDetail'
import { Alert, AlertDescription } from '../../ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { SkeletonEntityDetail } from '../../ui/skeleton-detail'
import { useEntityConfig } from '../../../hooks/useEntityConfig'
import { useRouter } from 'next/navigation'
import { getEntityData, deleteEntityData } from '../../../lib/api/entities'
import { TeamDetailSection } from '../../teams/TeamDetailSection'
import type { EntityConfig } from '../../../lib/entities/types'

export interface EntityDetailWrapperProps {
  entityType: string
  id: string
  childEntityNames?: string[]
  onError?: (error: Error) => void
  className?: string
  /**
   * Optional custom form components for specific child entities
   * Map of childEntityName -> CustomFormComponent
   * Example: { 'social-platforms': SocialPlatformOAuthForm }
   */
  customFormComponents?: Record<string, React.ComponentType<any>>
}

export function EntityDetailWrapper({
  entityType,
  id,
  childEntityNames = [],
  onError,
  className,
  customFormComponents = {},
}: EntityDetailWrapperProps) {
  // Use the new centralized hook for entity configuration
  const { config: entityConfig, isLoading: isLoadingConfig, error: configError, isOverride } = useEntityConfig(entityType)
  
  // Router for navigation
  const router = useRouter()
  
  // Data loading states
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [childData, setChildData] = useState<Record<string, Record<string, unknown>[]>>({})
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  // Use child entity names passed as props from the server component
  const hasChildEntities = childEntityNames.length > 0

  // Parent delete confirmation state
  const [parentDeleteConfirmation, setParentDeleteConfirmation] = useState(false)
  const [isDeletingParent, setIsDeletingParent] = useState(false)

  // Generate custom sections based on entity type (must be before any early returns)
  const customSections: CustomSectionConfig[] = useMemo(() => {
    const sections: CustomSectionConfig[] = []

    // Add Team Members section for teams entity
    if (entityType === 'teams') {
      sections.push({
        id: 'team-members',
        component: ({ data }: { data: Record<string, unknown>; entityConfig: EntityConfig }) => (
          <TeamDetailSection teamId={String(data.id)} />
        ),
        position: 'after-details'
      })
    }

    return sections
  }, [entityType])

  // Function to load child entities data from API
  const loadChildEntitiesData = useCallback(async (parentId: string) => {
    console.log(`[loadChildEntitiesData] Called with parentId:`, parentId, `childEntityNames:`, childEntityNames)
    if (!hasChildEntities) {
      console.log(`[loadChildEntitiesData] No child entities found, returning early`)
      return
    }

    try {
      const childrenData: Record<string, Record<string, unknown>[]> = {}
      console.log(`[loadChildEntitiesData] Starting to load child entities:`, childEntityNames)

      for (const childName of childEntityNames) {
        try {
          console.log(`[EntityDetailWrapper] Loading child data for ${childName}`)
          
          // Load child data from API endpoint
          const response = await fetch(`/api/v1/${entityType}/${parentId}/child/${childName}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies for session auth
          })
          
          if (response.ok) {
            const result = await response.json()
            const childRows = result.success ? result.data : []
            console.log(`[EntityDetailWrapper] Loaded ${childRows.length} ${childName} records`)
            childrenData[childName] = childRows
          } else {
            console.warn(`Failed to load child data for ${childName}: ${response.status}`)
            childrenData[childName] = []
          }
        } catch (error) {
          console.warn(`Failed to load child data for ${childName}:`, error)
          childrenData[childName] = []
        }
      }
      
      console.log(`[loadChildEntitiesData] Setting child data:`, childrenData)
      setChildData(childrenData)
    } catch (error) {
      console.error('Error loading child entities data:', error)
    }
  }, [childEntityNames, hasChildEntities, entityType])

  // Load entity data when config is ready
  // Using a ref to track if data has been loaded to prevent infinite loops
  const dataLoadedRef = React.useRef(false)
  const prevIdRef = React.useRef<string | null>(null)

  useEffect(() => {
    // Reset loaded state when id changes
    if (prevIdRef.current !== id) {
      dataLoadedRef.current = false
      prevIdRef.current = id
    }

    if (!entityConfig || !id) return
    if (dataLoadedRef.current) return // Prevent re-fetching if already loaded

    if (!entityConfig.enabled) {
      const error = new Error(`Entidad "${entityType}" está deshabilitada`)
      setDataError(error.message)
      onError?.(error)
      return
    }

    const loadEntityData = async () => {
      try {
        setIsLoadingData(true)
        setDataError(null)
        console.log(`[EntityDetailWrapper] Loading data for "${entityType}" id: ${id} (override: ${isOverride})`)

        // Use the parent+child API endpoint directly to get everything in one call
        console.log(`[EntityDetailWrapper] hasChildEntities:`, hasChildEntities)

        if (hasChildEntities) {
          // Use parent+child API for entities that have child entities
          const endpointPath = entityConfig.slug || `${entityType}s`
          const url = new URL(`/api/v1/${endpointPath}/${id}`, window.location.origin)
          url.searchParams.set('child', 'all')
          url.searchParams.set('metas', 'all')

          console.log(`[EntityDetailWrapper] Loading parent+child data from:`, url.toString())

          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          })

          if (!response.ok) {
            throw new Error(`Failed to load ${entityType} with children: ${response.status}`)
          }

          const apiResult = await response.json()
          console.log(`[EntityDetailWrapper] Received parent+child data:`, apiResult)

          const result = apiResult.data
          console.log(`[EntityDetailWrapper] result.child:`, result.child)
          console.log(`[EntityDetailWrapper] typeof result.child:`, typeof result.child)
          setData(result as Record<string, unknown>)

          // Extract child data from the combined response
          if (result.child) {
            console.log(`[EntityDetailWrapper] Setting child data from combined response:`, result.child)
            setChildData(result.child as Record<string, Record<string, unknown>[]>)
          } else {
            console.log(`[EntityDetailWrapper] No result.child found, setting empty childData`)
            setChildData({})
          }
        } else {
          // Use regular API for entities without child entities
          const result = await getEntityData(entityType, id, true) // Include metadata
          console.log(`[EntityDetailWrapper] Loaded data for "${entityType}" ${id}:`, result)
          setData(result as Record<string, unknown>)
        }

        setDataError(null)
        dataLoadedRef.current = true // Mark as loaded
      } catch (err) {
        console.error(`[EntityDetailWrapper] Error loading data for "${entityType}" ${id}:`, err)
        const errorMessage = `Error cargando datos: ${err instanceof Error ? err.message : 'Error desconocido'}`
        setDataError(errorMessage)
        setData(null)

        // Call onError callback if provided
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage))
        }
      } finally {
        setIsLoadingData(false)
      }
    }

    loadEntityData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityConfig?.slug, entityType, id])

  // Handler functions for child entity operations
  const handleEdit = useCallback(() => {
    router.push(`/dashboard/${entityConfig?.slug}/${id}/edit`)
  }, [router, entityConfig, id])

  const handleDelete = useCallback(async () => {
    setParentDeleteConfirmation(true)
    // Return a promise that doesn't resolve to keep the button in loading state
    // The actual deletion happens in handleConfirmParentDelete
    return new Promise<void>(() => {})
  }, [])

  const handleConfirmParentDelete = useCallback(async () => {
    setParentDeleteConfirmation(false)
    setIsDeletingParent(true)
    
    try {
      await deleteEntityData(entityType, id)
      
      // Navigate back to list
      router.push(`/dashboard/${entityConfig?.slug || entityType}`)
    } catch (error) {
      console.error('Error deleting entity:', error)
      onError?.(error instanceof Error ? error : new Error('Error deleting entity'))
    } finally {
      setIsDeletingParent(false)
    }
  }, [entityType, id, router, entityConfig, onError])

  const handleCancelParentDelete = useCallback(() => {
    setParentDeleteConfirmation(false)
  }, [])

  // Refresh function - declared early to be used by other callbacks
  const handleRefresh = useCallback(async () => {
    if (!entityConfig || !id) return

    try {
      setIsLoadingData(true)
      setDataError(null)

      // Reset the loaded ref to allow refresh
      dataLoadedRef.current = false

      // Reload using the same logic as the main useEffect
      // hasChildEntities is already available from the outer scope

      if (hasChildEntities) {
        // Use parent+child API for entities that have child entities
        const endpointPath = entityConfig.slug || `${entityType}s`
        const url = new URL(`/api/v1/${endpointPath}/${id}`, window.location.origin)
        url.searchParams.set('child', 'all')
        url.searchParams.set('metas', 'all')
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })
        
        if (!response.ok) {
          throw new Error(`Failed to reload ${entityType} with children: ${response.status}`)
        }
        
        const apiResult = await response.json()
        const result = apiResult.data
        setData(result as Record<string, unknown>)

        // Extract child data from the combined response
        if (result.child) {
          setChildData(result.child as Record<string, Record<string, unknown>[]>)
        }
      } else {
        // Use regular API for entities without child entities
        const result = await getEntityData(entityType, id, true)
        setData(result as Record<string, unknown>)
      }

      setDataError(null)
    } catch (err) {
      console.error(`[EntityDetailWrapper] Error reloading data:`, err)
      const errorMessage = `Error recargando datos: ${err instanceof Error ? err.message : 'Error desconocido'}`
      setDataError(errorMessage)
    } finally {
      setIsLoadingData(false)
    }
  }, [entityConfig, entityType, id, hasChildEntities])

  const handleChildAdd = useCallback(async (childName: string, childData: Record<string, unknown>) => {
    try {
      console.log(`[EntityDetailWrapper] Adding child ${childName} for parent ${id}`, childData)
      
      // Call API to create child entity
      const endpointPath = entityConfig?.slug || `${entityType}s`
      const url = `/api/v1/${endpointPath}/${id}/child/${childName}`
      console.log(`[EntityDetailWrapper] Calling URL: ${url}`)
      console.log(`[EntityDetailWrapper] Sending data:`, JSON.stringify(childData, null, 2))
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session auth
        body: JSON.stringify(childData),
      })
      
      console.log(`[EntityDetailWrapper] Response status: ${response.status}`)
      if (!response.ok) {
        const errorText = await response.text()
        console.log(`[EntityDetailWrapper] Error response: ${errorText}`)
        throw new Error(`Failed to create ${childName}: ${response.status}`)
      }
      
      const result = await response.json()
      if (!result.success || !result.data) {
        throw new Error('Invalid response format')
      }
      
      // Update only the specific child data instead of reloading everything
      setChildData(prev => ({
        ...prev,
        [childName]: [...(prev[childName] || []), result.data]
      }))

    } catch (error) {
      console.error(`Error creating child ${childName}:`, error)
      throw error
    }
  }, [id, entityType, entityConfig])

  const handleChildEdit = useCallback(async (childName: string, childId: string, childData: Record<string, unknown>) => {
    try {
      console.log(`[EntityDetailWrapper] Editing child ${childName} with id ${childId}`, childData)
      
      // Call API to update child entity
      const endpointPath = entityConfig?.slug || `${entityType}s`
      const response = await fetch(`/api/v1/${endpointPath}/${id}/child/${childName}/${childId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session auth
        body: JSON.stringify(childData),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to update ${childName}: ${response.status}`)
      }
      
      const result = await response.json()
      if (!result.success || !result.data) {
        throw new Error('Invalid response format')
      }
      
      // Update only the specific item in child data instead of reloading everything
      setChildData(prev => ({
        ...prev,
        [childName]: (prev[childName] || []).map(item => 
          String(item.id) === childId ? result.data : item
        )
      }))

    } catch (error) {
      console.error(`Error updating child ${childName}:`, error)
      throw error
    }
  }, [id, entityType, entityConfig])

  const handleChildDelete = useCallback(async (childName: string, childId: string) => {
    try {
      console.log(`[EntityDetailWrapper] Deleting child ${childName} with id ${childId}`)
      
      // Call API to delete child entity  
      const endpointPath = entityConfig?.slug || `${entityType}s`
      const response = await fetch(`/api/v1/${endpointPath}/${id}/child/${childName}/${childId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session auth
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete ${childName}: ${response.status}`)
      }
      
      // Remove only the specific item from child data instead of reloading everything
      setChildData(prev => ({
        ...prev,
        [childName]: (prev[childName] || []).filter(item => 
          String(item.id) !== childId
        )
      }))

    } catch (error) {
      console.error(`Error deleting child ${childName}:`, error)
      throw error
    }
  }, [id, entityType, entityConfig])

  if (isLoadingConfig) {
    return <SkeletonEntityDetail />
  }

  if (configError || !entityConfig) {
    return (
      <Alert>
        <AlertDescription>
          {configError || `No se pudo cargar la configuración para la entidad "${entityType}".`}
        </AlertDescription>
      </Alert>
    )
  }

  // Show loading state for data
  if (isLoadingData) {
    return <SkeletonEntityDetail />
  }

  // Show data error if present
  if (dataError) {
    return (
      <Alert>
        <AlertDescription>
          {dataError}
        </AlertDescription>
      </Alert>
    )
  }

  // Show message if no data found
  if (!data) {
    return (
      <Alert>
        <AlertDescription>
          No se encontraron datos para esta entidad.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <EntityDetail
        entityConfig={entityConfig}
        data={data}
        childData={childData}
        childEntityNames={childEntityNames}
        isLoading={isLoadingData}
        error={dataError}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onChildAdd={handleChildAdd}
        onChildEdit={handleChildEdit}
        onChildDelete={handleChildDelete}
        onRefresh={handleRefresh}
        enableActions={true}
        className={className}
        customFormComponents={customFormComponents}
        customSections={customSections}
      />

      {/* Parent Delete Confirmation Dialog */}
      <Dialog open={parentDeleteConfirmation} onOpenChange={(open) => !open && handleCancelParentDelete()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar este {entityConfig?.names.singular.toLowerCase()}? Esta acción eliminará permanentemente toda la información y no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelParentDelete}
              disabled={isDeletingParent}
              data-cy="cancel-delete"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmParentDelete}
              disabled={isDeletingParent}
              data-cy="confirm-delete"
            >
              {isDeletingParent ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
