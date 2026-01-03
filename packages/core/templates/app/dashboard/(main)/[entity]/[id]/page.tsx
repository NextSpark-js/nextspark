import { notFound, redirect } from 'next/navigation'
import { getEntity, ENTITY_REGISTRY, getChildEntities, type EntityName } from '@nextsparkjs/core/lib/entities/queries'
import { EntityDetailWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityDetailWrapper'
import type { Metadata } from 'next'
import { TemplateService } from '@nextsparkjs/core/lib/services/template.service'
import type { EntityConfig, ChildEntityDefinition } from '@nextsparkjs/core/lib/entities/types'

// Type guard to check if entity is a full EntityConfig
function isEntityConfig(entity: EntityConfig | ChildEntityDefinition): entity is EntityConfig {
  return 'slug' in entity
}

interface PageProps {
  params: Promise<{
    entity: string
    id: string
  }>
}

async function EntityDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const entitySlug = resolvedParams.entity

  // Check if there's a specific template override for this entity
  // e.g., app/dashboard/(main)/boards/[id]/page.tsx for boards
  const specificTemplatePath = `app/dashboard/(main)/${entitySlug}/[id]/page.tsx`
  if (TemplateService.hasOverride(specificTemplatePath)) {
    const OverrideComponent = TemplateService.getComponent(specificTemplatePath)
    if (OverrideComponent) {
      console.log(`🎨 Entity-specific template override applied for ${specificTemplatePath}`)
      return <OverrideComponent params={params} />
    }
  }

  // Verificar que la entidad existe en el registro
  if (!(entitySlug in ENTITY_REGISTRY)) {
    notFound()
  }

  const entityConfig = getEntity(entitySlug as EntityName)
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
  const childEntities = getChildEntities(entitySlug as EntityName)
  const childEntityNames = childEntities.map(child => child.name)

  return (
    <EntityDetailWrapper
      entityType={entityConfig.slug}
      id={resolvedParams.id}
      childEntityNames={childEntityNames}
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
    title: `${entityConfig.names.plural} #${resolvedParams.id} - Dashboard`,
    description: `View details for ${entityConfig.names.singular}`
  }
}

export default EntityDetailPage