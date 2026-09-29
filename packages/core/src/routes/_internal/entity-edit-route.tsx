/**
 * The dashboard edit page of one entity, for the generated host (#203). See entity-list-route.tsx.
 */

import type { ComponentType } from 'react'
import { notFound } from 'next/navigation'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { isManageableEntity } from './entity-dashboard'
import { EntityEditView } from './entity-edit-view'

/** Props a project's edit template receives. */
export interface EntityEditTemplateProps {
  params: Promise<{ entity: string; id: string }>
}

/**
 * @param config - the entity's config
 * @param Template - the project's edit page for this entity, when it has one: it replaces the generic form, and
 *   runs only after core's checks (the entity is enabled and shown in the dashboard)
 */
export function createEntityEditRoute(config: EntityConfig, Template?: ComponentType<EntityEditTemplateProps>) {
  return async function EntityEditRoute({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!isManageableEntity(config)) notFound()
    if (Template) return <Template params={Promise.resolve({ entity: config.slug, id })} />
    return <EntityEditView entity={config.slug} id={id} />
  }
}
