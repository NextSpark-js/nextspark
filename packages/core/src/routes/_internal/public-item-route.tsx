/**
 * The public item page of a builder entity, for the generated host (#203).
 *
 * A builder entity with `access.basePath` gets a concrete item route (`(public)/blog/[...slug]`): a facade
 * that statically imports the entity's config - and the project's item template when it has one - and
 * passes them to the factories here, so nothing resolves an entity or a template by a runtime key, and no
 * other entity's config is in the route's module graph. Core's `(public)/[...slug]` route
 * (public-catch-all-page.tsx) keeps serving apps that still resolve the entity from the URL.
 */

import type { ComponentType } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageRenderer } from '@nextsparkjs/core/components/public/pageBuilder'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import type { BlockInstance } from '@nextsparkjs/core/types/blocks'
import type { PatternReference } from '@nextsparkjs/core/types/pattern-reference'
import { fetchPublishedItem, getResolvedBlocks, type PublishedItem } from './public-entity-shared'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

/** Props a project's item template receives (the catch-all's, so existing templates keep working). */
export interface PublicItemTemplateProps {
  params: Promise<{ slug: string }>
  searchParams: SearchParams
}

export interface ItemRouteProps {
  params: Promise<{ slug: string | string[] }>
  searchParams: SearchParams
}

/** The item slug of a `[slug]` or `[...slug]` route: a nested slug is joined, as the catch-all did. */
const slugOf = (slug: string | string[]) => (Array.isArray(slug) ? slug.join('/') : slug)

/**
 * Where a public item comes from. The default reads the database on every render; `public-item-route.cc` (the
 * Cache Components host's module) supplies a cached one.
 */
export interface PublicItemSource {
  /** The published item of `slug`, or null. */
  fetchItem(entity: EntityConfig, slug: string): Promise<PublishedItem | null>
  /** The item's blocks with pattern references expanded (public pages show the pattern's content). */
  resolveBlocks(blocks: (BlockInstance | PatternReference)[]): Promise<BlockInstance[]>
}

const databaseSource: PublicItemSource = { fetchItem: fetchPublishedItem, resolveBlocks: getResolvedBlocks }

/** The default rendering of a published item, or null when there is none. */
async function renderDefaultPublicItem(source: PublicItemSource, entity: EntityConfig, slug: string) {
  const item = await source.fetchItem(entity, slug)
  if (!item) return null

  // Resolve pattern references before rendering: this expands pattern blocks inline for public display
  const resolvedBlocks = await source.resolveBlocks(item.blocks as (BlockInstance | PatternReference)[])

  return (
    <main className="min-h-screen bg-background" data-cy="public-entity-page" data-entity={entity.slug} data-slug={slug}>
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

/**
 * @param config - the entity's config
 * @param Template - the project's item page for this entity, when it has one: it renders the item and
 *   does its own data fetching
 */
function itemRoute(source: PublicItemSource, config: EntityConfig, Template?: ComponentType<PublicItemTemplateProps>) {
  return async function PublicItemRoute({ params, searchParams }: ItemRouteProps) {
    const slug = slugOf((await params).slug)
    if (Template) return <Template params={Promise.resolve({ slug })} searchParams={searchParams} />

    const item = await renderDefaultPublicItem(source, config, slug)
    if (!item) notFound()
    return item
  }
}

/** `generateMetadata` of a builder entity's item page. */
function itemMetadata(source: PublicItemSource, config: EntityConfig) {
  return async function generatePublicItemMetadata({ params }: Pick<ItemRouteProps, 'params'>): Promise<Metadata> {
    const slug = slugOf((await params).slug)
    const item = await source.fetchItem(config, slug)
    if (item) {
      return {
        title: item.seoTitle || `${item.title} | Boilerplate`,
        description: item.seoDescription || item.excerpt || undefined,
        openGraph: {
          title: item.seoTitle || item.title,
          description: item.seoDescription || item.excerpt || undefined,
          images: item.ogImage ? [item.ogImage] : item.featuredImage ? [item.featuredImage] : [],
          type: 'article',
        },
      }
    }
    return { title: 'Not Found' }
  }
}

/** The route and metadata factories of the item pages, over an item source. */
export function bindPublicItemRoutes(source: PublicItemSource) {
  return {
    createPublicItemRoute: (config: EntityConfig, Template?: ComponentType<PublicItemTemplateProps>) => itemRoute(source, config, Template),
    createPublicItemMetadata: (config: EntityConfig) => itemMetadata(source, config),
  }
}

const databaseRoutes = bindPublicItemRoutes(databaseSource)
export const createPublicItemRoute = databaseRoutes.createPublicItemRoute
export const createPublicItemMetadata = databaseRoutes.createPublicItemMetadata
