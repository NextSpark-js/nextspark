/**
 * Patterns Create Page
 *
 * Wrapper that delegates to the generic entity create page.
 */

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clientEntityRegistry, ensureClientInitialized, type ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'
import { EntityFormWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityFormWrapper'
import { BuilderEditorView } from '@nextsparkjs/core/components/dashboard/block-editor/builder-editor-view'
import { Alert, AlertDescription } from '@nextsparkjs/core/components/ui/alert'

export default function PatternsCreatePage() {
  const router = useRouter()
  const [entityConfig, setEntityConfig] = useState<ClientEntityConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const entitySlug = 'patterns'

  useEffect(() => {
    async function loadEntityConfig() {
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
  }, [])

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
        if (createdId) {
          router.push(`/dashboard/${entitySlug}/${createdId}`)
        } else {
          router.push(`/dashboard/${entitySlug}`)
        }
      }}
      onError={(error) => {
        console.error(`Error creating pattern:`, error)
      }}
    />
  )
}
