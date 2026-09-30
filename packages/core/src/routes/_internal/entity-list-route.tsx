/**
 * The dashboard list page of one entity, for the generated host (#203).
 *
 * The host writes one concrete route per entity (`dashboard/(main)/tasks/page.tsx`, ...), each a facade
 * that statically imports the entity's config - and the project's template for that route when it has
 * one - and passes them to the factory of its own module here. Nothing in these modules looks an entity or
 * a template up by a runtime key, and none of them imports the entity registry. Each factory lives in a
 * module of its own so a route's module graph holds only the client components that route renders (a
 * shared module would give every entity route the client code of all of them).
 *
 * `entity-list-metadata.ts`, `entity-detail-metadata.ts`, `entity-error.tsx` and `entity-loading.tsx` are the
 * modules every entity's route forwards `metadata`, `error` and `loading` from.
 */

import type { ComponentType } from 'react'
import { notFound } from 'next/navigation'
import { EntityListWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityListWrapper'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { isDashboardEntity } from './entity-dashboard'

/** Props a project's list template receives (the `[entity]` route's, so existing templates keep working). */
export interface EntityListTemplateProps {
  params: Promise<{ entity: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * @param config - the entity's config
 * @param Template - the project's list page for this entity, when it has one: it replaces the
 *   generic list after the same checks
 */
export function createEntityListRoute(config: EntityConfig, Template?: ComponentType<EntityListTemplateProps>) {
  return async function EntityListRoute() {
    if (!isDashboardEntity(config)) notFound()
    if (Template) return <Template params={Promise.resolve({ entity: config.slug })} searchParams={Promise.resolve({})} />
    return <EntityListWrapper entityType={config.slug} />
  }
}
