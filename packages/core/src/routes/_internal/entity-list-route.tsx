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

import { Suspense, type ComponentType } from 'react'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { EntityListWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityListWrapper'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { readEntityListFirstPage } from '@nextsparkjs/core/lib/api/entity/list-first-page'
import { isDashboardEntity } from './entity-dashboard'

/** Props a project's list template receives (the `[entity]` route's, so existing templates keep working). */
export interface EntityListTemplateProps {
  params: Promise<{ entity: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * @param config - the entity's config
 * @param Template - the project's list page for this entity, when it has one: it replaces the
 *   generic list after the same checks, and gets Next's `searchParams` promise unawaited (the template decides when to read it)
 */
export function createEntityListRoute(config: EntityConfig, Template?: ComponentType<EntityListTemplateProps>, { serverFirstPage = true }: { serverFirstPage?: boolean } = {}) {
  return async function EntityListRoute({ searchParams }: { searchParams: EntityListTemplateProps['searchParams'] }) {
    if (!isDashboardEntity(config)) notFound()
    if (Template) return <Template params={Promise.resolve({ entity: config.slug })} searchParams={searchParams} />
    if (!serverFirstPage) return <EntityListWrapper entityType={config.slug} />
    // The first page is read on the server with the list API's rules (#574). Behind a boundary of its own, whose fallback is
    // the list's heading and table skeleton (requesting nothing): the page does not wait for the read, so the entity's
    // loading skeleton is not shown any longer than before
    return (
      <Suspense fallback={<EntityListWrapper entityType={config.slug} placeholder />}>
        <EntityListWithFirstPage slug={config.slug} searchParams={searchParams} />
      </Suspense>
    )
  }
}

/**
 * The list page of an entity whose `GET /api/v1/<slug>` the project replaces (`templates/api/v1/<slug>/route.ts`): the
 * server read applies the generic handler's rules, not the project's, so this list requests its rows from the API as
 * before. The generated host writes it for such an entity (entity-routes.mjs).
 */
export function createClientReadEntityListRoute(config: EntityConfig, Template?: ComponentType<EntityListTemplateProps>) {
  return createEntityListRoute(config, Template, { serverFirstPage: false })
}

async function EntityListWithFirstPage({ slug, searchParams }: { slug: string; searchParams: EntityListTemplateProps['searchParams'] }) {
  // Read for a document request only: a client navigation or a prefetch (a fetch, not a navigation, for the browser) reads
  // nothing and the list requests its rows as before, so no payload in the router cache carries rows read long ago.
  // A browser that sends no Sec-Fetch-Mode gets the read
  const mode = (await headers()).get('sec-fetch-mode')
  const initialPage = mode && mode !== 'navigate' ? null : await readEntityListFirstPage(slug, await searchParams)
  return <EntityListWrapper entityType={slug} initialPage={initialPage} />
}
