/**
 * The dashboard create page of one entity, for the generated host (#203). See entity-list-route.tsx.
 */

import type { ComponentType } from 'react'
import { notFound } from 'next/navigation'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { isManageableEntity } from './entity-dashboard'
import { EntityCreateView } from './entity-create-view'

/** Props a project's create template receives. */
export interface EntityCreateTemplateProps {
  params: Promise<{ entity: string }>
}

/**
 * @param config - the entity's config
 * @param Template - the project's create page for this entity, when it has one: it replaces the generic form, and
 *   runs only after core's checks (the entity is enabled and shown in the dashboard)
 */
export function createEntityCreateRoute(config: EntityConfig, Template?: ComponentType<EntityCreateTemplateProps>) {
  return async function EntityCreateRoute() {
    if (!isManageableEntity(config)) notFound()
    if (Template) return <Template params={Promise.resolve({ entity: config.slug })} />
    return <EntityCreateView entity={config.slug} />
  }
}
