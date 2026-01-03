import { notFound } from 'next/navigation'
import { getEntity, ENTITY_REGISTRY, type EntityName } from '@nextsparkjs/core/lib/entities/queries'
import { EntityListWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityListWrapper'
import type { Metadata } from 'next'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'
import type { EntityConfig, ChildEntityDefinition } from '@nextsparkjs/core/lib/entities/types'

// Type guard to check if entity is a full EntityConfig
function isEntityConfig(entity: EntityConfig | ChildEntityDefinition): entity is EntityConfig {
  return 'slug' in entity
}

interface PageProps {
  params: Promise<{ entity: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function EntityListPage({ params }: PageProps) {
  const resolvedParams = await params
  const entitySlug = resolvedParams.entity

  // Verificar que la entidad existe usando el nuevo registry
  if (!(entitySlug in ENTITY_REGISTRY)) {
    notFound()
  }

  const entityConfig = getEntity(entitySlug as EntityName)
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
  const SpecificTemplate = getTemplateOrDefault(specificTemplatePath, null) as React.ComponentType<PageProps> | null

  if (SpecificTemplate) {
    return <SpecificTemplate params={params} searchParams={Promise.resolve({})} />
  }

  return (
    <EntityListWrapper
      entityType={entityConfig.slug}
    />
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const entitySlug = resolvedParams.entity

  if (!(entitySlug in ENTITY_REGISTRY)) {
    return {
      title: 'Not Found - Dashboard'
    }
  }

  const entityConfig = getEntity(entitySlug as EntityName)
  if (!entityConfig || !isEntityConfig(entityConfig)) {
    return {
      title: 'Not Found - Dashboard'
    }
  }

  return {
    title: `${entityConfig.names.plural} - Dashboard`,
    description: `Manage ${entityConfig.names.plural.toLowerCase()} in your dashboard`
  }
}

export default getTemplateOrDefault('app/dashboard/(main)/[entity]/page.tsx', EntityListPage)