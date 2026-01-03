'use client'

import { notFound, useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clientEntityRegistry, ensureClientInitialized, type ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'
import { EntityFormWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityFormWrapper'
import { BuilderEditorView } from '@nextsparkjs/core/components/dashboard/block-editor/builder-editor-view'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'
import { getEntityData } from '@nextsparkjs/core/lib/api/entities'

function EntityEditPage() {
  const params = useParams()
  const router = useRouter()
  const [entityConfig, setEntityConfig] = useState<ClientEntityConfig | null>(null)
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  // Extract entity slug and id from params
  const entitySlug = params.entity as string
  const entityId = params.id as string

  useEffect(() => {
    async function loadEntityData() {
      if (!entitySlug || !entityId) {
        setLoading(false)
        return
      }

      try {
        // Load entity config (client-safe)
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
        console.error('Error loading entity:', error)
        setEntityConfig(null)
        setInitialData(null)
      } finally {
        setLoading(false)
      }
    }

    loadEntityData()
  }, [entitySlug, entityId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!entityConfig) {
    notFound()
  }

  // For non-builder entities, we need the initial data
  if (!entityConfig.builder?.enabled && !initialData) {
    notFound()
  }

  if (!entityConfig.features?.enabled) {
    notFound()
  }

  // Check if entity should be accessible via dashboard route
  // Entities with showInMenu: false are managed elsewhere (e.g., settings)
  if (!entityConfig.features?.showInMenu) {
    notFound()
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

  // Use EntityFormWrapper for regular entities
  return (
    <EntityFormWrapper
      entityType={entitySlug}
      id={entityId}
      mode="edit"
      onSuccess={() => {
        // For edit, redirect to the entity detail view
        router.push(`/dashboard/${entitySlug}/${entityId}`)
      }}
      onError={(error) => {
        console.error(`Error updating ${entityConfig.displayName}:`, error)
      }}
    />
  )
}

export default getTemplateOrDefaultClient('app/dashboard/(main)/[entity]/[id]/edit/page.tsx', EntityEditPage)