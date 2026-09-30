/**
 * What the public entity pages share (#203): the published-item query, pattern resolution and the
 * template path a project's item template is named after. Server-only helpers: no client component is
 * imported here, so an archive route's module graph does not hold the item page's client code or the
 * other way round.
 *
 * The generated host's per-entity routes are given their entity's config (public-item-route.tsx,
 * public-archive-route.tsx). This module does not import the entity registry, so
 * a per-entity route's module graph holds no other entity.
 */

import { query } from '@nextsparkjs/core/lib/db'
import { getEntityBasePath } from '@nextsparkjs/core/lib/entities/schema-generator'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { PatternsResolverService } from '@nextsparkjs/core/lib/blocks/patterns-resolver.service'
import { extractPatternIds, resolvePatternReferences } from '@nextsparkjs/core/lib/blocks/pattern-resolver'
import type { BlockInstance } from '@nextsparkjs/core/types/blocks'
import type { PatternReference } from '@nextsparkjs/core/types/pattern-reference'
import type { Pattern } from '@nextsparkjs/core/types/pattern-reference'

/**
 * Base fields that all builder-enabled entities have (from migrations)
 * These are the minimum fields needed for public page rendering
 */
const BASE_PUBLIC_FIELDS = ['id', 'slug', 'title', 'status', 'blocks', 'locale', 'createdAt', 'userId']

/**
 * Optional SEO fields that may exist on builder entities
 */
const SEO_FIELDS = ['seoTitle', 'seoDescription', 'ogImage']

/**
 * Common optional fields for content entities (posts, articles, etc.)
 * These are checked dynamically - only included if they exist in entity.fields
 */
const OPTIONAL_CONTENT_FIELDS = ['excerpt', 'featuredImage']

export interface PublishedItem {
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
  userId?: string
}

/**
 * Quote a field name for PostgreSQL (handles camelCase)
 */
function quoteField(field: string): string {
  return /[A-Z]/.test(field) ? `"${field}"` : field
}

/**
 * Build SELECT clause dynamically based on entity configuration
 * Only includes fields that actually exist in the entity's schema
 */
export function buildPublicSelectClause(entity: EntityConfig): string {
  const fields = new Set<string>(BASE_PUBLIC_FIELDS)

  // Add SEO fields (these are standard for builder entities)
  SEO_FIELDS.forEach(f => fields.add(f))

  // Check entity.fields for optional content fields
  const entityFieldNames = entity.fields?.map(f => f.name) || []
  OPTIONAL_CONTENT_FIELDS.forEach(f => {
    if (entityFieldNames.includes(f)) {
      fields.add(f)
    }
  })

  return Array.from(fields).map(quoteField).join(', ')
}

/**
 * Resolve pattern references in blocks array
 *
 * Fetches all referenced patterns and expands them inline.
 * This ensures public pages show the actual pattern content.
 *
 * @param blocks - Blocks array which may contain pattern references
 * @param getPatterns - where the referenced patterns are read from (the database; the Cache Components
 *   host passes a cached read)
 * @returns Resolved blocks array with patterns expanded
 */
export async function getResolvedBlocks(
  blocks: (BlockInstance | PatternReference)[],
  getPatterns: (ids: string[]) => Promise<Pattern[]> = ids => PatternsResolverService.getByIds(ids)
): Promise<BlockInstance[]> {
  // Extract pattern IDs from blocks array
  const patternIds = extractPatternIds(blocks)

  // If no patterns referenced, return blocks as-is
  if (patternIds.length === 0) {
    return blocks as BlockInstance[]
  }

  try {
    // Batch fetch all referenced patterns (only published ones)
    const patterns = await getPatterns(patternIds)

    // Build pattern cache (Map for O(1) lookup)
    const patternCache = new Map(patterns.map((p) => [p.id, p]))

    // Resolve pattern references and return flattened blocks
    return resolvePatternReferences(blocks, patternCache)
  } catch (error) {
    console.error('[getResolvedBlocks] Failed to resolve patterns:', error)
    // Fallback: Return blocks without pattern resolution
    // Pattern references will be skipped gracefully
    return blocks.filter((block) => !('type' in block && block.type === 'pattern')) as BlockInstance[]
  }
}

/**
 * Build the template path for an entity based on its basePath
 */
export function buildTemplatePath(entity: EntityConfig): string {
  const basePath = getEntityBasePath(entity) || '/'
  if (basePath === '/') {
    return 'app/(public)/[entity]/page.tsx'
  }
  return `app/(public)${basePath}/[slug]/page.tsx`
}

/**
 * Fetch a published item from the database
 * Dynamically builds SELECT clause based on entity configuration
 * to avoid querying non-existent columns
 */
export async function fetchPublishedItem(
  entity: EntityConfig,
  slug: string
): Promise<PublishedItem | null> {
  try {
    const tableName = entity.tableName || entity.slug
    const selectClause = buildPublicSelectClause(entity)

    const result = await query<PublishedItem>(
      `SELECT ${selectClause} FROM "${tableName}" WHERE slug = $1 AND status = 'published'`,
      [slug]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error(`[fetchPublishedItem] Error fetching ${entity.slug}:`, error)
    return null
  }
}
