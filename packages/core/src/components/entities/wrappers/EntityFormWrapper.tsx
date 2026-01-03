/**
 * Entity Form Wrapper
 *
 * High-level wrapper that converts entityType string to entityConfig
 * and handles form submission logic
 *
 * Refactored to use useEntityConfig hook for better performance and consistency
 *
 * NOTE: Permission validation is now handled at the layout level
 * (app/dashboard/(main)/[entity]/layout.tsx) for better security.
 * The layout validates permissions BEFORE this component renders.
 */

'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EntityForm } from '../EntityForm'
import { EntityDetailHeader } from '../EntityDetailHeader'
import { Alert, AlertDescription } from '../../ui/alert'
import { SkeletonEntityForm } from '../../ui/skeleton-form'
import { useEntityConfig } from '../../../hooks/useEntityConfig'
import { useTeam } from '../../../hooks/useTeam'
import { getEntityData, createEntityData, updateEntityData } from '../../../lib/api/entities'

export interface EntityFormWrapperProps {
  entityType: string
  mode: 'create' | 'edit'
  id?: string
  initialData?: Record<string, unknown> // Allow pre-filled data for create mode
  onSuccess?: (createdId?: string) => void
  onError?: (error: Error) => void
  className?: string
  headerActions?: React.ReactNode // Additional actions to display in the header
}

export function EntityFormWrapper({
  entityType,
  mode,
  id,
  initialData: propsInitialData,
  onSuccess,
  onError,
  className,
  headerActions: additionalHeaderActions
}: EntityFormWrapperProps) {
  const router = useRouter()

  // Use the new centralized hook for entity configuration
  const { config: entityConfig, isLoading: isLoadingConfig, error: configError, isOverride } = useEntityConfig(entityType)

  // Get current team ID for team-scoped operations like user selection
  const { teamId } = useTeam()

  const [initialData, setInitialData] = useState<Record<string, unknown>>(propsInitialData || {})
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Load initial data for edit mode or use provided initialData for create mode
  useEffect(() => {
    // If initialData was provided via props (quick create), use it
    if (propsInitialData && Object.keys(propsInitialData).length > 0) {
      setInitialData(propsInitialData)
      return
    }

    const loadInitialData = async () => {
      if (mode === 'edit' && id && entityConfig) {
        if (!entityConfig.enabled) {
          onError?.(new Error(`Entidad "${entityType}" está deshabilitada`))
          return
        }
        
        try {
          setIsLoadingData(true)
          console.log(`[EntityFormWrapper] Loading data for ${entityType} ${id} (override: ${isOverride})`)

          const data = await getEntityData(entityType, id)
          
          console.log(`[EntityFormWrapper] Loaded data:`, data)
          setInitialData(data || {})
        } catch (error) {
          console.error(`[EntityFormWrapper] Error loading data for ${entityType} ${id}:`, error)
          onError?.(error instanceof Error ? error : new Error(`Failed to load ${entityType} data`))
        } finally {
          setIsLoadingData(false)
        }
      }
    }

    loadInitialData()
  }, [mode, id, entityType, entityConfig, onError, isOverride, propsInitialData])

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    try {
      console.log(`${mode === 'create' ? 'Creating' : 'Updating'} ${entityType}:`, data)

      if (mode === 'create') {
        const created = await createEntityData(entityType, data)
        
        onSuccess?.(created?.id)
      } else if (mode === 'edit' && id) {
        await updateEntityData(entityType, id, data)
        
        onSuccess?.(id)
      }
    } catch (error) {
      console.error(`❌ Failed to ${mode} ${entityType}:`, error)
      onError?.(error instanceof Error ? error : new Error(`Failed to ${mode} ${entityType}`))
    }
  }, [entityType, mode, id, onSuccess, onError])

  if (isLoadingConfig || isLoadingData) {
    // Calculate approximate field count based on entity type or default
    const fieldCount = entityConfig?.fields?.length || 8
    const hasTextareas = true // Most entities have description/notes fields
    const hasJsonFields = entityConfig?.fields?.some(field =>
      field.type === 'json' || field.name.includes('Values') || field.name.includes('Languages')
    ) || false

    return (
      <SkeletonEntityForm
        fieldCount={fieldCount}
        hasTextareas={hasTextareas}
        hasJsonFields={hasJsonFields}
      />
    )
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

  const customActions = additionalHeaderActions ? (
    <>{additionalHeaderActions}</>
  ) : undefined

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <EntityDetailHeader
          entityConfig={entityConfig}
          mode={mode}
          entity={mode === 'edit' && initialData.id ? {
            id: String(initialData.id),
            createdAt: initialData.createdAt as string | undefined,
            updatedAt: initialData.updatedAt as string | undefined,
            title: initialData.title as string | undefined,
            name: initialData.name as string | undefined,
            ...initialData,
          } : undefined}
          customActions={customActions}
        />

        <EntityForm
          entityConfig={entityConfig}
          mode={mode}
          initialData={initialData}
          onSubmit={handleSubmit}
          className={className}
          teamId={teamId}
        />
      </div>
    </div>
  )
}
