/**
 * Patterns Edit Page
 *
 * Wrapper that delegates to the BuilderEditorView for pattern editing.
 */

'use client'

import { notFound, useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clientEntityRegistry, ensureClientInitialized, type ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'
import { EntityFormWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityFormWrapper'
import { BuilderEditorView } from '@nextsparkjs/core/components/dashboard/block-editor/builder-editor-view'
import { Alert, AlertDescription } from '@nextsparkjs/core/components/ui/alert'
import { getEntityData } from '@nextsparkjs/core/lib/api/entities'

export default function PatternEditPage() {
  const params = useParams()
  const router = useRouter()
  const [entityConfig, setEntityConfig] = useState<ClientEntityConfig | null>(null)
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const entitySlug = 'patterns'
  const entityId = params.id as string

  useEffect(() => {
    async function loadEntityData() {
      if (!entityId) {
        setLoading(false)
        return
      }

      try {
        await ensureClientInitialized()
        const config = clientEntityRegistry.getBySlug(entitySlug)

        if (!config) {
          setEntityConfig(null)
          setLoading(false)
          return
        }

        setEntityConfig(config)

        // For builder-enabled entities, BuilderEditorView handles its own data fetching
        // For regular entities, fetch data here
        if (!config.builder?.enabled) {
          const data = await getEntityData(entitySlug, entityId, true)
          setInitialData(data as Record<string, unknown>)
        }
      } catch (error) {
        console.error('Error loading pattern:', error)
        setEntityConfig(null)
        setInitialData(null)
      } finally {
        setLoading(false)
      }
    }

    loadEntityData()
  }, [entityId])

  if (loading) {
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
