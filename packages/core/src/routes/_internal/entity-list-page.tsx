import type { ComponentType } from 'react'
import { notFound } from 'next/navigation'
import { getEntity, getEntityRegistry, setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
import { EntityListWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityListWrapper'
import type { EntityConfig, ChildEntityDefinition } from '@nextsparkjs/core/lib/entities/types'
// Import registry directly - webpack resolves @nextsparkjs/registries alias at compile time
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'

// Initialize registry at module load time (before any component renders)
setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)

// Type guard to check if entity is a full EntityConfig
function isEntityConfig(entity: EntityConfig | ChildEntityDefinition): entity is EntityConfig {
  return 'slug' in entity
}

export interface EntityListPageProps {
  params: Promise<{ entity: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Finds the component a project provides for one entity's list, by its app path
 * (`app/dashboard/(main)/<entity>/page.tsx`), or null for the generic list.
 */
export type EntityListTemplateResolver = (appPath: string) => ComponentType<EntityListPageProps> | null

/**
 * The dashboard list page for any entity. Core's route uses it without a resolver,
 * so it always renders the generic list; a host that still resolves per-entity
 * templates at runtime passes one.
 */
export function createEntityListPage(resolveEntityTemplate?: EntityListTemplateResolver) {
  return async function EntityListPage({ params }: EntityListPageProps) {
    const resolvedParams = await params
    const entitySlug = resolvedParams.entity

    // Verificar que la entidad existe usando el nuevo registry
    const registry = getEntityRegistry()
    if (!(entitySlug in registry)) {
      notFound()
    }

    const entityConfig = getEntity(entitySlug)
    if (!entityConfig || !isEntityConfig(entityConfig)) {
      notFound()
    }

    // Verificar que la entidad está habilitada usando la nueva estructura
    if (!entityConfig.enabled) {
      notFound()
    }

    // Check if entity should be accessible via dashboard route
    // Entities with showInMenu: false are managed elsewhere (e.g., settings)
    if (!entityConfig.ui?.dashboard?.showInMenu) {
      notFound()
    }

    // IMPORTANT: Try to resolve entity-specific template first
    // This allows themes to override specific entities (e.g., /dashboard/orders)
    // while falling back to the generic EntityListWrapper for others
    const specificTemplatePath = `app/dashboard/(main)/${entitySlug}/page.tsx`
    const SpecificTemplate = resolveEntityTemplate?.(specificTemplatePath) ?? null

    if (SpecificTemplate) {
      return <SpecificTemplate params={params} searchParams={Promise.resolve({})} />
    }

    return (
      <EntityListWrapper
        entityType={entityConfig.slug}
      />
    )
  }
}
