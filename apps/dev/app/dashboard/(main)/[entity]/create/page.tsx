'use client'

import { notFound, useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clientEntityRegistry, ensureClientInitialized, type ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'
import { EntityFormWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityFormWrapper'
import { BuilderEditorView } from '@nextsparkjs/core/components/dashboard/block-editor/builder-editor-view'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'

function EntityCreatePage() {
  const params = useParams()
  const router = useRouter()
  const [entityConfig, setEntityConfig] = useState<ClientEntityConfig | null>(null)
  const [loading, setLoading] = useState(true)

  // Extract entity slug from params
  const entitySlug = params.entity as string

  useEffect(() => {
    async function loadEntityConfig() {
      if (!entitySlug) {
        setLoading(false)
        return
      }

      try {
        await ensureClientInitialized()
        const config = clientEntityRegistry.getBySlug(entitySlug)
        setEntityConfig(config || null)
      } catch (error) {
        console.error('Error loading entity config:', error)
        setEntityConfig(null)
      } finally {
        setLoading(false)
      }
    }

    loadEntityConfig()
  }, [entitySlug])

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
        mode="create"
      />
    )
  }

  // Use EntityFormWrapper for regular entities
  return (
    <EntityFormWrapper
      entityType={entitySlug}
      mode="create"
      onSuccess={(createdId) => {
        // For create, redirect to the entity detail view if we have the ID, otherwise to list
        if (createdId) {
          router.push(`/dashboard/${entitySlug}/${createdId}`)
        } else {
          router.push(`/dashboard/${entitySlug}`)
        }
      }}
      onError={(error) => {
        console.error(`Error creating ${entityConfig.displayName}:`, error)
      }}
    />
  )
}

export default getTemplateOrDefaultClient('app/dashboard/(main)/[entity]/create/page.tsx', EntityCreatePage)