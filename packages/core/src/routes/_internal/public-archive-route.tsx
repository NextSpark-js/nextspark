/**
 * The public archive page of an entity, for the generated host (#203).
 *
 * A builder entity with a basePath and an archive page gets `(public)<basePath>`; a public entity with an
 * archive page and no builder basePath gets `(public)/<entity>` at any depth (as the catch-all served it).
 * See public-item-route.tsx for how these routes are made.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicEntityGrid } from '@nextsparkjs/core/components/public/entities/PublicEntityGrid'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { APP_NAME } from '@nextsparkjs/core/lib/config/public-config-client'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

/** @param config - the entity's config (`ui.public.hasArchivePage` decides whether the archive is served) */
export function createPublicArchiveRoute(config: EntityConfig) {
  return async function PublicArchiveRoute({ searchParams }: { searchParams: SearchParams }) {
    if (!config.ui?.public?.hasArchivePage) notFound()
    // An archive at the entity's own path (no basePath) is served only for an enabled, public entity
    const hasBasePath = Boolean(config.access?.basePath ?? config.builder?.public?.basePath)
    if (!hasBasePath && !(config.access?.public && config.enabled)) notFound()
    return (
      <div className="container mx-auto px-4 py-8" data-cy="public-archive-page">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">{config.names.plural}</h1>
          <p className="text-lg text-muted-foreground">Browse all {config.names.plural.toLowerCase()}</p>
        </div>

        <PublicEntityGrid entityType={config.slug} entitySlug={config.slug} searchParams={await searchParams} />
      </div>
    )
  }
}

/** `generateMetadata` of an entity's archive page. */
export function createPublicArchiveMetadata(config: EntityConfig) {
  return async function generatePublicArchiveMetadata(): Promise<Metadata> {
    return {
      title: `${config.names.plural} | ${APP_NAME}`,
      description: `Browse all ${config.names.plural.toLowerCase()}`,
    }
  }
}
