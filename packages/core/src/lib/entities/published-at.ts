/**
 * The publishing date rule of public reads (#542).
 *
 * An entity with a `publishedAt` field schedules its items: a `published` row whose date has not come yet is not public.
 * Every public read of such an entity (the anonymous list and single read of the REST API, the public item pages and the
 * sitemap) adds this condition to `status = 'published'`; a row with no date counts as published now. Reads of an
 * authenticated user (the dashboard, the author, an admin) do not, so they keep seeing the scheduled rows.
 * The blog template's own public reads (`lib/public-posts.ts`, the feed) apply the same rule.
 */
import type { EntityConfig } from './types'

/** ` AND <condition>` to append to a public read's WHERE, or '' for an entity without `publishedAt`. `alias` is the table alias with its dot (`t.`). */
export function publishedAtClause(entity: Pick<EntityConfig, 'fields'>, alias = ''): string {
  if (!entity.fields?.some(field => field.name === 'publishedAt')) return ''
  return ` AND (${alias}"publishedAt" IS NULL OR ${alias}"publishedAt" <= NOW())`
}
