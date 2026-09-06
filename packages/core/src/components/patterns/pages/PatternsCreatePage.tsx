/**
 * Patterns Create Page
 *
 * Wrapper that delegates to the generic entity create page.
 * Reads entity config from the generated client registry — see
 * PatternEditPage.tsx for why (#131 follow-up).
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getEntityBySlug, type ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'
import { EntityFormWrapper } from '../../entities/wrappers/EntityFormWrapper'
import { BuilderEditorView } from '../../dashboard/block-editor/builder-editor-view'
import { Alert, AlertDescription } from '../../ui/alert'

export default function PatternsCreatePage() {
  const router = useRouter()
  const entitySlug = 'patterns'
  const [entityConfig, setEntityConfig] = useState<ClientEntityConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      setEntityConfig(getEntityBySlug(entitySlug))
    } catch (error) {
      console.error('Error loading patterns entity config:', error)
      setEntityConfig(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  if (isLoading) {
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
