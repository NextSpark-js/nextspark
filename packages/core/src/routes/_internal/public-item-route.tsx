/**
 * The public item page of a builder entity, for the generated host (#203).
 *
 * A builder entity with `access.basePath` gets a concrete item route (`(public)/blog/[...slug]`): a facade
 * that statically imports the entity's config - and the project's item template when it has one - and
 * passes them to the factories here, so nothing resolves an entity or a template by a runtime key, and no
 * other entity's config is in the route's module graph.
 */

import type { ComponentType } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageRenderer } from '@nextsparkjs/core/components/public/pageBuilder'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import type { BlockInstance } from '@nextsparkjs/core/types/blocks'
import type { PatternReference } from '@nextsparkjs/core/types/pattern-reference'
import { fetchPublishedItem, getResolvedBlocks, isPublicEntity, type PublishedItem } from './public-entity-shared'
import { STATIC_FILE_EXTENSION } from '@nextsparkjs/core/lib/entities/public-item-slug'
import { getPublicTranslations } from '@nextsparkjs/core/lib/i18n/public-translations'

export { STATIC_FILE_EXTENSION }

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

const isFileRequest = (slug: string) => STATIC_FILE_EXTENSION.test(slug)

/** The item slug of a `[slug]` or `[...slug]` route: a nested slug is joined, as the catch-all did. */
const slugOf = (slug: string | string[]) => (Array.isArray(slug) ? slug.join('/') : slug)

/**
 * The template's `generateStaticParams` in the shape of the generated route (#370). The contract is the template's
 * props: `slug` is a string with the levels joined by `/` (an array is accepted too). A `[...slug]` route takes
 * arrays and a `[slug]` route strings, so the slug is converted; the other keys are kept. Whatever Next.js passes
 * reaches `generate`, and its own signature is kept (an `interface` result, `({ params })`, sync or async).
 */
export function createPublicItemStaticParams<A extends unknown[]>(
  generate: (...args: A) => readonly object[] | Promise<readonly object[]>,
  catchAll: boolean
) {
  return async function generateStaticParams(...args: A) {
    return (await generate(...args)).map((entry: { slug?: unknown }) => {
      const { slug } = entry
      if (slug === undefined) return entry
      if (catchAll) return Array.isArray(slug) ? entry : { ...entry, slug: String(slug).split('/') }
      return Array.isArray(slug) ? { ...entry, slug: slug.join('/') } : entry
    })
  }
}

/**
 * Where a public item comes from. The default reads the database on every render; `public-item-route.cc` (the
 * Cache Components host's module) supplies a cached one.
 */
export interface PublicItemSource {
  /** The published item of `slug`, or null. */
  fetchItem(entity: EntityConfig, slug: string): Promise<PublishedItem | null>
  /** The item's blocks with pattern references expanded (public pages show the pattern's content). */
  resolveBlocks(blocks: (BlockInstance | PatternReference)[], teamId: string | undefined): Promise<BlockInstance[]>
}

const databaseSource: PublicItemSource = { fetchItem: fetchPublishedItem, resolveBlocks: getResolvedBlocks }

/** The default rendering of a published item, or null when there is none. */
async function renderDefaultPublicItem(source: PublicItemSource, entity: EntityConfig, slug: string) {
  const item = await source.fetchItem(entity, slug)
  if (!item) return null

  // Resolve pattern references before rendering: this expands pattern blocks inline for public display
  const resolvedBlocks = await source.resolveBlocks(item.blocks as (BlockInstance | PatternReference)[], item.teamId)

  return (
    <div className="min-h-screen bg-background" data-cy="public-entity-page" data-entity={entity.slug} data-slug={slug}>
      <PageRenderer
        page={{
          id: item.id,
          title: item.title,
          slug: item.slug,
          blocks: resolvedBlocks,
          locale: item.locale || 'en',
          teamId: item.teamId,
        }}
      />
    </div>
  )
}

/**
 * @param config - the entity's config
 * @param Template - the project's item page for this entity, when it has one: it renders the item and
 *   does its own data fetching
 */
function itemRoute(source: PublicItemSource, config: EntityConfig, Template?: ComponentType<PublicItemTemplateProps>, NotFoundView?: ComponentType) {
  // With a view, a missing item renders it in place (the Cache Components module, whose notFound() cannot change the
  // status and left an empty body, #423); without one it throws notFound(), which keeps the 404 of the ISR host.
  const missing = NotFoundView ? () => <NotFoundView /> : () => notFound()
  return async function PublicItemRoute({ params, searchParams }: ItemRouteProps) {
    const slug = slugOf((await params).slug)
    if (!isPublicEntity(config) || isFileRequest(slug)) return missing()
    if (Template) return <Template params={Promise.resolve({ slug })} searchParams={searchParams} />

    const item = await renderDefaultPublicItem(source, config, slug)
    return item ?? missing()
  }
}

/** `generateMetadata` of a builder entity's item page. */
function itemMetadata(source: PublicItemSource, config: EntityConfig, noindexMissing: boolean) {
  return async function generatePublicItemMetadata({ params }: Pick<ItemRouteProps, 'params'>): Promise<Metadata> {
    const slug = slugOf((await params).slug)
    // A missing item rendered in place throws no notFound(), so the noindex Next.js adds for one is set here
    const missingMetadata: Metadata = { title: (await getPublicTranslations('public.route'))('notFound'), ...(noindexMissing ? { robots: { index: false } } : {}) }
    if (!isPublicEntity(config) || isFileRequest(slug)) return missingMetadata
    const item = await source.fetchItem(config, slug)
    if (item) {
      return {
        title: item.seoTitle ? { absolute: item.seoTitle } : item.title,
        description: item.seoDescription || item.excerpt || undefined,
        openGraph: {
          title: item.seoTitle || item.title,
          description: item.seoDescription || item.excerpt || undefined,
          images: item.ogImage ? [item.ogImage] : item.featuredImage ? [item.featuredImage] : [],
          type: 'article',
        },
      }
    }
    return missingMetadata
  }
}

/**
 * The route and metadata factories of the item pages, over an item source. `NotFoundView`: what a missing item renders
 * instead of throwing notFound() (the route's third argument, the project's not-found, takes its place), and its
 * metadata then says noindex. The ISR host passes none and ignores a third argument.
 */
export function bindPublicItemRoutes(source: PublicItemSource, NotFoundView?: ComponentType) {
  return {
    createPublicItemRoute: (config: EntityConfig, Template?: ComponentType<PublicItemTemplateProps>, ProjectNotFound?: ComponentType) =>
      itemRoute(source, config, Template, NotFoundView && (ProjectNotFound ?? NotFoundView)),
    createPublicItemMetadata: (config: EntityConfig) => itemMetadata(source, config, Boolean(NotFoundView)),
  }
}

const databaseRoutes = bindPublicItemRoutes(databaseSource)
export const createPublicItemRoute = databaseRoutes.createPublicItemRoute
export const createPublicItemMetadata = databaseRoutes.createPublicItemMetadata
