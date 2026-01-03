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

import { notFound } from 'next/navigation'
import { query } from '@nextsparkjs/core/lib/db'
import { PageRenderer } from '@/app/components/page-renderer'
import {
  matchPathToEntity,
  getEntityBasePath,
} from '@nextsparkjs/core/lib/entities/schema-generator'
import { ENTITY_REGISTRY } from '@nextsparkjs/core/lib/entities/queries'
import { TemplateService } from '@nextsparkjs/core/lib/services/template.service'
import { resolvePublicEntityFromUrl } from '@nextsparkjs/core/lib/api/entity/public-resolver'
import { PublicEntityGrid } from '@nextsparkjs/core/components/public/entities/PublicEntityGrid'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import type { Metadata } from 'next'

/**
 * Convert ENTITY_REGISTRY to format expected by matchPathToEntity
 */
function getEntityConfigs(): Record<string, EntityConfig> {
  const configs: Record<string, EntityConfig> = {}
  for (const [key, entry] of Object.entries(ENTITY_REGISTRY)) {
    configs[key] = entry.config as EntityConfig
  }
  return configs
}

// Enable ISR with 1 hour revalidation
export const revalidate = 3600

interface PageProps {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

interface PublishedItem {
  id: string
  slug: string
  title: string
  status: string
  blocks: Array<{
    id: string
    blockSlug: string
    props: Record<string, unknown>
  }>
  excerpt?: string
  featuredImage?: string
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
  locale?: string
  createdAt?: string
}

/**
 * Build the template path for an entity based on its basePath
 */
function buildTemplatePath(entity: EntityConfig): string {
  const basePath = getEntityBasePath(entity) || '/'
  if (basePath === '/') {
    return 'app/(public)/[entity]/page.tsx'
  }
  return `app/(public)${basePath}/[slug]/page.tsx`
}

/**
 * Fetch a published item from the database
 */
async function fetchPublishedItem(
  tableName: string,
  slug: string
): Promise<PublishedItem | null> {
  try {
    const result = await query<PublishedItem>(
      `SELECT * FROM "${tableName}" WHERE slug = $1 AND status = 'published'`,
      [slug]
    )
    return result.rows[0] || null
  } catch {
    return null
  }
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
    const item = await fetchPublishedItem(entity.tableName || entity.slug, slug)
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
 * Main catch-all page component
 */
export default async function DynamicPublicPage({
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
    if (TemplateService.hasOverride(templatePath)) {
      const Template = TemplateService.getComponent(templatePath)
      if (Template) {
        // Template handles its own data fetching and rendering
        // Pass params in the format expected by the template
        return <Template params={Promise.resolve({ slug })} searchParams={searchParams} />
      }
    }

    // No template override - use default rendering
    const item = await fetchPublishedItem(entity.tableName || entity.slug, slug)

    if (!item) {
      notFound()
    }

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
            blocks: item.blocks || [],
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
