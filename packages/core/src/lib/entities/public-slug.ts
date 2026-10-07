/**
 * Slugs of public entities (#215)
 *
 * A slug that ends up in a public URL is validated on write, with the one format the templates' pages and
 * posts tables enforce (`validatePageSlug`): lowercase letters, digits and hyphens, no dot. Reserved words
 * are refused only for an entity served at the site root (`access.basePath: '/'`), where they would shadow
 * a route. Existing rows are not rewritten, and a slug that did not change is never judged (the callers check).
 */

import type { EntityConfig } from './types'
import { validatePageSlug } from '../constants/reserved-slugs'

/** What the slug rule reads of an entity: the server's config, or the client registry's lighter one. */
export interface SlugScope {
  access?: { basePath?: string; allowNestedSlugs?: boolean }
  builder?: { public?: { basePath?: string } }
}

/** The base path an entity's public items are served under, when it has one. */
const basePathOf = (entity: SlugScope) => entity.access?.basePath ?? entity.builder?.public?.basePath

/** Whether the entity has a `slug` field that becomes part of a public URL. */
export function hasPublicSlug(entity: EntityConfig): boolean {
  return entity.fields.some(field => field.name === 'slug') && (entity.access?.public === true || basePathOf(entity) !== undefined)
}

/**
 * The first segments of the base paths the other entities are served under (`/blog/x` -> `blog`): a root page with
 * that slug would be shadowed by their routes.
 */
export function otherBasePathSegments(entity: SlugScope, entities: readonly (SlugScope & { slug?: string })[]): string[] {
  return entities
    .filter(other => other !== entity)
    .map(other => basePathOf(other)?.split('/').filter(Boolean)[0])
    .filter((segment): segment is string => Boolean(segment))
}

/**
 * The reason `slug` cannot be a public slug of `entity`, or null when it can. `taken` are the base path segments
 * of the other entities (`otherBasePathSegments`), reserved for an entity at the site root.
 */
export function validatePublicSlug(entity: SlugScope, slug: string, taken: readonly string[] = []): string | null {
  const atRoot = basePathOf(entity) === '/'
  const segments = slug.split('/')
  if (segments.length > 1 && !(atRoot ? entity.access?.allowNestedSlugs : basePathOf(entity))) {
    return 'Slug cannot contain slashes'
  }
  for (const [index, segment] of segments.entries()) {
    const reason = validatePageSlug(segment, { checkReserved: atRoot && index === 0, reserved: taken })
    if (reason) return reason
  }
  return null
}

/**
 * The validation issue (Zod's shape, so clients read it like any other field error) for the `slug` of a
 * write body, or null: the entity has no public slug, the body does not carry one (an update that leaves it
 * alone), or it is valid. Meant to run after the schema accepted the body, so a present slug is a string or null.
 */
export function publicSlugIssue(entity: EntityConfig, data: Record<string, unknown>, taken: readonly string[] = []) {
  if (!hasPublicSlug(entity) || typeof data.slug !== 'string') return null
  const message = validatePublicSlug(entity, data.slug, taken)
  return message ? { code: 'custom', path: ['slug'], message } : null
}
