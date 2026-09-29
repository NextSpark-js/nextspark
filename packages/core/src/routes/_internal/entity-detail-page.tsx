import type { ComponentType } from 'react'
import { notFound, redirect } from 'next/navigation'
import { getEntity, getEntityRegistry, getChildEntities, setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
import { EntityDetailWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityDetailWrapper'
import type { EntityConfig, ChildEntityDefinition } from '@nextsparkjs/core/lib/entities/types'
// Import registry directly - webpack resolves @nextsparkjs/registries alias at compile time
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'

// Initialize registry at module load time (before any component renders)
setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)

// Type guard to check if entity is a full EntityConfig
function isEntityConfig(entity: EntityConfig | ChildEntityDefinition): entity is EntityConfig {
  return 'slug' in entity
}

export interface EntityDetailPageProps {
  params: Promise<{
    entity: string
    id: string
  }>
}

/**
 * Finds the component a project provides for one entity's detail page, by its app
 * path (`app/dashboard/(main)/<entity>/[id]/page.tsx`), or null for the generic one.
 */
export type EntityDetailTemplateResolver = (appPath: string) => ComponentType<EntityDetailPageProps> | null | undefined

/**
 * The dashboard detail page for any entity. Core's route uses it without a
 * resolver, so it always renders the generic detail view; a host that still
 * resolves per-entity templates at runtime passes one.
 */
export function createEntityDetailPage(resolveEntityTemplate?: EntityDetailTemplateResolver) {
  return async function EntityDetailPage({ params }: EntityDetailPageProps) {
    const resolvedParams = await params
    const entitySlug = resolvedParams.entity

    // Check if there's a specific template override for this entity
    // e.g., app/dashboard/(main)/boards/[id]/page.tsx for boards
    const specificTemplatePath = `app/dashboard/(main)/${entitySlug}/[id]/page.tsx`
    const OverrideComponent = resolveEntityTemplate?.(specificTemplatePath)
    if (OverrideComponent) {
      console.log(`🎨 Entity-specific template override applied for ${specificTemplatePath}`)
      return <OverrideComponent params={params} />
    }

    // Verificar que la entidad existe en el registro
    if (!(entitySlug in getEntityRegistry())) {
      notFound()
    }

    const entityConfig = getEntity(entitySlug as string)
    if (!entityConfig || !isEntityConfig(entityConfig)) {
      notFound()
    }

    // Verificar que la entidad está habilitada
    if (!entityConfig.enabled) {
      notFound()
    }

    // Check if entity should be accessible via dashboard route
    // Entities with showInMenu: false are managed elsewhere (e.g., settings)
    if (!entityConfig.ui?.dashboard?.showInMenu) {
      notFound()
    }

    // Builder-enabled entities redirect to edit view
    // Detail view doesn't make sense for entities using the page builder
    if (entityConfig.builder?.enabled) {
      redirect(`/dashboard/${entitySlug}/${resolvedParams.id}/edit`)
    }

    // Get child entities for this parent entity
    const childEntities = getChildEntities(entitySlug as string)
    const childEntityNames = childEntities.map(child => child.name)

    return (
      <EntityDetailWrapper
        entityType={entityConfig.slug}
        id={resolvedParams.id}
        childEntityNames={childEntityNames}
      />
    )
  }
}
