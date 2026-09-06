/**
 * Patterns Edit Page
 *
 * Wrapper that delegates to the BuilderEditorView for pattern editing.
 * Reads entity config from the generated client registry (getEntityBySlug),
 * the same source BuilderEditorView itself and the generic [entity]/[id]/edit
 * page use — instead of the runtime-hydrated useEntityConfig() hook, whose
 * EntityConfig shape (names.singular/plural, full field configs, functions)
 * never structurally matched ClientEntityConfig (#131 follow-up).
 */

'use client'

import { notFound, useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getEntityBySlug, type ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'
import { EntityFormWrapper } from '../../entities/wrappers/EntityFormWrapper'
import { BuilderEditorView } from '../../dashboard/block-editor/builder-editor-view'
import { Alert, AlertDescription } from '../../ui/alert'
import { getEntityData } from '../../../lib/api/entities'

export default function PatternEditPage() {
  const params = useParams()
  const router = useRouter()
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [entityConfig, setEntityConfig] = useState<ClientEntityConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)

  const entitySlug = 'patterns'
  const entityId = params.id as string

  useEffect(() => {
    try {
      setEntityConfig(getEntityBySlug(entitySlug))
    } catch (error) {
      console.error('Error loading patterns entity config:', error)
      setEntityConfig(null)
    } finally {
      setConfigLoading(false)
    }
  }, [])

  useEffect(() => {
    async function loadEntityData() {
      if (!entityId || !entityConfig) {
        setDataLoading(false)
        return
      }

      try {
        // For builder-enabled entities, BuilderEditorView handles its own data fetching
        // For regular entities, fetch data here
        if (!entityConfig.builder?.enabled) {
          const data = await getEntityData(entitySlug, entityId, true)
          setInitialData(data as Record<string, unknown>)
        }
      } catch (error) {
        console.error('Error loading pattern:', error)
        setInitialData(null)
      } finally {
        setDataLoading(false)
      }
    }

    if (entityConfig) {
      loadEntityData()
    }
  }, [entityId, entityConfig])

  if (configLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!entityConfig || !entityConfig.features?.enabled) {
    return (
      <Alert>
        <AlertDescription>
          Patterns entity is not configured or not enabled.
        </AlertDescription>
      </Alert>
    )
  }

  // Use BuilderEditorView for builder-enabled entities
  if (entityConfig.builder?.enabled) {
    return (
      <BuilderEditorView
        entitySlug={entitySlug}
        entityConfig={entityConfig}
        id={entityId}
        mode="edit"
      />
    )
  }

  // For non-builder entities, we need the initial data
  if (!initialData) {
    notFound()
  }

  // Use EntityFormWrapper for regular entities
  return (
    <EntityFormWrapper
      entityType={entitySlug}
      id={entityId}
      mode="edit"
      onSuccess={() => {
        router.push(`/dashboard/${entitySlug}/${entityId}`)
      }}
      onError={(error) => {
        console.error('Error updating pattern:', error)
      }}
    />
  )
}
