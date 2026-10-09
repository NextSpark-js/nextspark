/**
 * The dashboard detail page of one entity, for the generated host (#203). See entity-list-route.tsx.
 */

import type { ComponentType } from 'react'
import { notFound, redirect } from 'next/navigation'
import { EntityDetailWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityDetailWrapper'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { isDashboardEntity } from './entity-dashboard'

/** Props a project's detail template receives. */
export interface EntityDetailTemplateProps {
  params: Promise<{ entity: string; id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * @param config - the entity's config
 * @param childEntityNames - the entity's child entities (known when the host is generated)
 * @param Template - the project's detail page for this entity, when it has one: it replaces the
 *   generic detail, and runs only after core's checks (the entity is enabled and shown in the dashboard)
 */
export function createEntityDetailRoute(config: EntityConfig, childEntityNames: string[], Template?: ComponentType<EntityDetailTemplateProps>) {
  return async function EntityDetailRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: EntityDetailTemplateProps['searchParams'] }) {
    const { id } = await params
    if (!isDashboardEntity(config)) notFound()
    if (Template) return <Template params={Promise.resolve({ entity: config.slug, id })} searchParams={searchParams} />

    // Builder-enabled entities redirect to the edit view: a detail view makes no sense for them
    if (config.builder?.enabled) redirect(`/dashboard/${config.slug}/${id}/edit`)

    return <EntityDetailWrapper entityType={config.slug} id={id} childEntityNames={childEntityNames} />
  }
}
