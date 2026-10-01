/**
 * What the generic entity handlers put in a response row, described once.
 *
 * The handlers (lib/api/entity/generic-handler.ts) build their SELECT lists and their taxonomy
 * expansion from these functions, and the generated portable contracts render the response DTOs
 * from the same ones, so a column the API returns cannot be missing from the contract.
 *
 * PORTABLE: imports zod and its siblings in this directory and nothing else.
 */

import * as z from 'zod'
import type { EntityConfig } from './types'

/** The columns every entity row carries, in the order the handlers select them. */
export const BASE_RESPONSE_COLUMNS = ['id', 'userId', 'teamId', 'createdAt', 'updatedAt'] as const

/**
 * The system columns a handler selects for an entity, ahead of its configured fields:
 * the base columns, `blocks` for builder entities, and the soft-delete markers where the handler
 * selects them (list and read do; create returns the row it just inserted without them).
 */
export function entityResponseSystemColumns(
  config: Pick<EntityConfig, 'builder' | 'table'>,
  { includeSoftDelete }: { includeSoftDelete: boolean }
): string[] {
  const columns: string[] = [...BASE_RESPONSE_COLUMNS]
  if (config.builder?.enabled) columns.push('blocks')
  if (includeSoftDelete && config.table?.softDelete) columns.push('deletedAt', 'deletedBy')
  return columns
}

/** The fields the taxonomy expansion adds to every row of a taxonomy-enabled entity (each an array of terms). */
export function taxonomyResponseFields(config: Pick<EntityConfig, 'taxonomies'>): string[] {
  if (!config.taxonomies?.enabled) return []
  return config.taxonomies.types.map(type => type.field)
}

/** One taxonomy term as the expansion returns it. */
export const taxonomyTermSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  color: z.string().nullish(),
  icon: z.string().nullish(),
})

/** One block of a builder entity's `blocks`. */
export const builderBlockSchema = z.object({
  id: z.string(),
  blockSlug: z.string(),
  props: z.record(z.string(), z.unknown()).optional(),
})

/** What a create or update accepts as `blocks`: the block list, or anything (the editor's own flexibility). */
export const builderBlocksSchema = z.union([z.array(builderBlockSchema), z.unknown()])

/** `?metas=` expansion: the entity's metadata by key. */
export const metasResponseSchema = z.record(z.string(), z.unknown())

/** `?child=` expansion: the child rows by child entity name. */
export const childrenResponseSchema = z.record(z.string(), z.array(z.unknown()))

/**
 * What the `pg` driver hands the API for a column of this SQL type, unless a type parser is configured
 * (none is: a test fails if one appears). The handlers return raw rows, so this is the wire type:
 * NUMERIC/DECIMAL, BIGINT and MONEY arrive as strings (exact, no float rounding), INT/FLOAT as numbers,
 * DATE/TIMESTAMP as ISO strings once JSON-encoded.
 *
 * @returns `null` for a type this does not know
 */
export function pgWireKind(sqlType: string): 'number' | 'string' | 'boolean' | 'unknown' | null {
  const type = sqlType.trim().toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
  if (type.endsWith('[]')) return 'unknown'
  if (['smallint', 'int2', 'integer', 'int', 'int4', 'serial', 'serial4', 'smallserial', 'serial2', 'real', 'float4', 'float', 'float8', 'double precision'].includes(type)) return 'number'
  if (['bigint', 'int8', 'bigserial', 'serial8', 'numeric', 'decimal', 'money'].includes(type)) return 'string'
  if (['boolean', 'bool'].includes(type)) return 'boolean'
  if (['text', 'varchar', 'character varying', 'char', 'character', 'bpchar', 'citext', 'uuid', 'date', 'time', 'timetz', 'time without time zone', 'time with time zone', 'timestamp', 'timestamptz', 'timestamp without time zone', 'timestamp with time zone', 'interval'].includes(type)) return 'string'
  if (['json', 'jsonb'].includes(type)) return 'unknown'
  return null
}
