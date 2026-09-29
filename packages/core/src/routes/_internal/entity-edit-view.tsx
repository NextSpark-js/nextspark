'use client'

import { notFound, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'
import { clientEntityRegistry } from '@nextsparkjs/core/lib/entities/registry.client'
import { toClientEntityConfig } from '@nextsparkjs/core/lib/entities/client-config'
import { EntityFormWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityFormWrapper'
import { BuilderEditorView } from '@nextsparkjs/core/components/dashboard/block-editor/builder-editor-view'
import { getEntityData } from '@nextsparkjs/core/lib/api/entities'

/**
 * The edit form of one entity's dashboard. Core's `[entity]/[id]` route passes both route params;
 * the generated host's per-entity routes pass their entity's slug and read `id` from theirs.
 */
export function EntityEditView({ entity, id }: { entity: string; id: string }) {
  const router = useRouter()
  const [entityConfig, setEntityConfig] = useState<ClientEntityConfig | null>(null)
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const entitySlug = entity
  const entityId = id

  useEffect(() => {
    async function loadEntityData() {
      if (!entitySlug || !entityId) {
        setLoading(false)
        return
      }

      try {
        // Load entity config (client-safe)
        // The dashboard shell has hydrated the registry with this entity's config (no other entity's code is imported here)
        const registered = clientEntityRegistry.get(entitySlug)
        const config = registered ? toClientEntityConfig(registered) : null

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
