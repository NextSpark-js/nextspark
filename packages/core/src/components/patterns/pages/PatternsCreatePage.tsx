/**
 * Patterns Create Page
 *
 * Wrapper that delegates to the generic entity create page.
 * Uses useEntityConfig hook for entity configuration.
 */

'use client'

import { useRouter } from 'next/navigation'
import { EntityFormWrapper } from '../../entities/wrappers/EntityFormWrapper'
import { BuilderEditorView } from '../../dashboard/block-editor/builder-editor-view'
import { Alert, AlertDescription } from '../../ui/alert'
import { useEntityConfig } from '../../../hooks/useEntityConfig'

export default function PatternsCreatePage() {
  const router = useRouter()
  const entitySlug = 'patterns'

  // Use the centralized hook for entity configuration
  const { config: entityConfig, isLoading } = useEntityConfig(entitySlug)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!entityConfig || !entityConfig.enabled) {
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
