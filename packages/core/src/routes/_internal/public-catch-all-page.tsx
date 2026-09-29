/**
 * Public Dynamic Catch-All Route
 *
 * Handles all public URLs for builder-enabled entities based on access.basePath configuration.
 *
 * Resolution strategy (longest-match-first):
 * - /blog/my-post → posts (basePath: '/blog')
 * - /about → pages (basePath: '/')
 * - /blog → posts archive (exact basePath match)
 *
 * Template System:
 * 1. Checks for theme template override first
 * 2. Falls back to default PageRenderer if no template
 */

import type { ComponentType } from 'react'
import { notFound } from 'next/navigation'
import { PageRenderer } from '@nextsparkjs/core/components/public/pageBuilder'
import { matchPathToEntity } from '@nextsparkjs/core/lib/entities/schema-generator'
import { getEntityRegistry, setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
import { resolvePublicEntityFromUrl } from '@nextsparkjs/core/lib/api/entity/public-resolver'
import { PublicEntityGrid } from '@nextsparkjs/core/components/public/entities/PublicEntityGrid'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import type { Metadata } from 'next'
import type { BlockInstance } from '@nextsparkjs/core/types/blocks'
import type { PatternReference } from '@nextsparkjs/core/types/pattern-reference'
import { buildTemplatePath, fetchPublishedItem, getResolvedBlocks } from './public-entity-shared'
// Import registry directly - webpack resolves @nextsparkjs/registries alias at compile time
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'

// Initialize registry at module load time (before any component renders)
// This ensures the registry is available even if this page loads before the layout
setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)

/**
 * Convert entity registry to format expected by matchPathToEntity
 */
function getEntityConfigs(): Record<string, EntityConfig> {
  const registry = getEntityRegistry()
  const configs: Record<string, EntityConfig> = {}
  for (const [key, entry] of Object.entries(registry)) {
    configs[key] = entry.config as EntityConfig
  }
  return configs
}

export interface PageProps {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Generate metadata for the page
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const slugParts = (await params).slug
  const fullPath = '/' + slugParts.join('/')

  // Get entity configs from registry
  const registry = getEntityConfigs()

  // Match path to builder entity
  const match = matchPathToEntity(fullPath, registry)

  if (match) {
    const { entity, slug, isArchive } = match

    // Archive page metadata
    if (isArchive) {
      return {
        title: `${entity.names.plural} | Boilerplate`,
        description: `Browse all ${entity.names.plural.toLowerCase()}`,
      }
    }

    // Metadata from database
    const item = await fetchPublishedItem(entity, slug)
    if (item) {
      return {
        title: item.seoTitle || `${item.title} | Boilerplate`,
        description: item.seoDescription || item.excerpt || undefined,
        openGraph: {
          title: item.seoTitle || item.title,
          description: item.seoDescription || item.excerpt || undefined,
          images: item.ogImage
            ? [item.ogImage]
            : item.featuredImage
              ? [item.featuredImage]
              : [],
          type: 'article',
        },
      }
    }
  }

  return {
    title: 'Not Found',
  }
}

/**
 * Finds the template a project provides for an entity's public item page, by its
 * app path (`app/(public)/<basePath>/[slug]/page.tsx`), or null for the default renderer.
 */
export type PublicEntityTemplateResolver = (
  appPath: string
) => ComponentType<{ params: Promise<{ slug: string }>; searchParams: PageProps['searchParams'] }> | null | undefined

/**
 * Main catch-all page component. Core's route uses it without a resolver, so an item
 * page always renders with PageRenderer; a host that still resolves per-entity templates
 * at runtime passes one.
 *
 * Not wrapped in Suspense: this route's entire content depends on whether the
 * slug resolves to a published item, so notFound() must be able to run before
 * any part of the response commits to a 200. A Suspense boundary here would
 * let Next.js flush the (null) fallback with a 200 status ahead of the
 * DB-backed lookup, so a later notFound() inside the boundary could no longer
 * change the status code — see #129.
 */
export function createDynamicPublicPage(resolveEntityTemplate?: PublicEntityTemplateResolver) {
  return async function DynamicPublicPage({
    params,
    searchParams,
  }: PageProps) {
    const slugParts = (await params).slug
    const resolvedSearchParams = await searchParams
    const fullPath = '/' + slugParts.join('/')

    // Get entity configs from registry
    const registry = getEntityConfigs()

    // Match path to builder entity using longest-match strategy
    const match = matchPathToEntity(fullPath, registry)

    if (match) {
      const { entity, slug, isArchive } = match

      // === ARCHIVE PAGE ===
      // Handle archive pages (e.g., /blog without slug)
      if (isArchive) {
        // Check if entity has archive page configured
        if (!entity.ui?.public?.hasArchivePage) {
          notFound()
        }

        // Check for custom archive template (future enhancement)
        // For now, use PublicEntityGrid
        return (
          <div className="container mx-auto px-4 py-8" data-cy="public-archive-page">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-4">
                {entity.names.plural}
              </h1>
              <p className="text-lg text-muted-foreground">
                Browse all {entity.names.plural.toLowerCase()}
              </p>
            </div>

            <PublicEntityGrid
              entityType={entity.slug}
              entitySlug={entity.slug}
              searchParams={resolvedSearchParams}
            />
          </div>
        )
      }

      // === SINGLE ITEM PAGE ===
      // Check for theme template override first
      const templatePath = buildTemplatePath(entity)
      const Template = resolveEntityTemplate?.(templatePath)
      if (Template) {
        // Template handles its own data fetching and rendering
        // Pass params in the format expected by the template
        return <Template params={Promise.resolve({ slug })} searchParams={searchParams} />
      }

      // No template override - use default rendering
      const item = await fetchPublishedItem(entity, slug)

      if (!item) {
        notFound()
      }

      // Resolve pattern references before rendering
      // This expands pattern blocks inline for public display
      const resolvedBlocks = await getResolvedBlocks(
        item.blocks as (BlockInstance | PatternReference)[]
      )

      // Default rendering with PageRenderer
      return (
        <main
          className="min-h-screen bg-background"
          data-cy="public-entity-page"
          data-entity={entity.slug}
          data-slug={slug}
        >
          <PageRenderer
            page={{
              id: item.id,
              title: item.title,
              slug: item.slug,
              blocks: resolvedBlocks,
              locale: item.locale || 'en',
            }}
          />
        </main>
      )
    }

    // === FALLBACK: Try legacy entity archive resolution ===
    // This handles entity archives like /products, /clients when they're not using basePath
    const resolution = await resolvePublicEntityFromUrl(fullPath)

    if (
      resolution.isValidPublicEntity &&
      resolution.hasArchivePage &&
      resolution.entityConfig
    ) {
      const entityConfig = resolution.entityConfig

      return (
        <div className="container mx-auto px-4 py-8" data-cy="public-archive-page">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              {entityConfig.names.plural}
            </h1>
            <p className="text-lg text-muted-foreground">
              Browse all {entityConfig.names.plural.toLowerCase()}
            </p>
          </div>

          <PublicEntityGrid
            entityType={entityConfig.slug}
            entitySlug={entityConfig.slug}
            searchParams={resolvedSearchParams}
          />
        </div>
      )
    }

    // No match found
    notFound()
  }
}
