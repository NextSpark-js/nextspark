/**
 * Relation references (#343): a `relation` / `relation-multi` value must name records the caller can see.
 * Shared by the generic REST handler and GenericEntityService (server actions); no HTTP, auth or CORS in here.
 */

import { queryWithRLS } from '../db'
import { getAllEntityConfigs } from './registry'
import type { EntityField } from './types'

/**
 * How one validated field value is bound in an INSERT or UPDATE: the placeholder's cast and the value. A relation
 * keeps a single id, a user field its id, and relation-multi, tags, multiselect and other objects go in as JSONB.
 */
export function bindFieldValue(field: Pick<EntityField, 'type'>, value: unknown): { cast: '' | '::jsonb'; value: unknown } {
  if (field.type === 'relation') {
    let relationId: unknown = null
    if (Array.isArray(value) && value.length > 0) {
      const firstItem = value[0]
      relationId = typeof firstItem === 'object' && firstItem && 'id' in firstItem ? firstItem.id : firstItem
    } else if (typeof value === 'object' && value && 'id' in value) {
      relationId = (value as { id: unknown }).id
    } else if (typeof value === 'string') {
      relationId = value
    }
    // An empty id is no relation
    if (typeof relationId === 'string' && relationId.trim() === '') relationId = null
    return { cast: '', value: relationId }
  }
  // relation-multi may arrive as a JSON string (the schema's transform) OR as a raw JS array when the field declared
  // `defaultValue: []` and the client omitted the key. A raw `[]` handed to pg-node casts to the Postgres array
  // literal `{}::jsonb`, which breaks every consumer that expects `Array.isArray(row.field)`.
  if (field.type === 'relation-multi') {
    return { cast: '::jsonb', value: typeof value === 'string' ? value : JSON.stringify(Array.isArray(value) ? value : []) }
  }
  if (field.type === 'tags') return { cast: '::jsonb', value: JSON.stringify(Array.isArray(value) ? value : []) }
  // SQL NULL, not JSONB "null"
  if ((field.type === 'multiselect' || field.type === 'user') && value === null) return { cast: '', value: null }
  // A user field stores the id (FK to users): an array of user objects, a single id string, or nothing
  if (field.type === 'user') {
    if (Array.isArray(value) && value.length > 0) {
      const userId = value[0]?.id
      return { cast: '', value: userId ? String(userId) : null }
    }
    return { cast: '', value: typeof value === 'string' ? value : null }
  }
  if (field.type === 'multiselect' || Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return { cast: '::jsonb', value: JSON.stringify(value) }
  }
  return { cast: '', value }
}

/** The ids a `relation` / `relation-multi` value holds, as the INSERT or UPDATE would store them; null if unreadable. */
function relationIds(field: Pick<EntityField, 'type'>, value: unknown): string[] | null {
  const bound = bindFieldValue(field, value).value
  let raw: unknown[]
  if (field.type === 'relation-multi') {
    try {
      const parsed = typeof bound === 'string' ? JSON.parse(bound) : bound
      if (!Array.isArray(parsed)) return null
      raw = parsed
    } catch {
      return null
    }
  } else {
    raw = bound === null ? [] : [bound]
  }
  const ids: string[] = []
  for (const item of raw) {
    const id = item && typeof item === 'object' && 'id' in item ? (item as { id: unknown }).id : item
    // Anything that is not a string, a number or `{ id }` cannot be checked, so it is not written
    if (typeof id !== 'string' && typeof id !== 'number') return null
    if (typeof id === 'string' && id.trim() === '') continue
    ids.push(String(id))
  }
  return [...new Set(ids)]
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Name of the first relation field in `data` that refers to a record the caller cannot see, or null when all are fine.
 * A foreign key does not apply row-level security and relation-multi is JSONB with no foreign key, so every id of the
 * fields present in `data` is looked up with one `SELECT` per field, through the caller's RLS, on the table of the
 * related entity. An id that does not exist and one the caller cannot see are indistinguishable. Fields absent from
 * `data`, empty values, relations to something that is not a registered entity and read-only fields are not checked;
 * `includeReadOnly` checks the last too, for writers that do store them. For an `external` caller (an API key) an id of
 * an entity closed to external callers (`access.api: false`, `enabled: false`) is always invalid and its table is not
 * queried, so the answer says nothing about whether the id exists (#346).
 */
export async function findInvalidRelationField(
  fields: EntityField[],
  data: Record<string, unknown>,
  userId: string,
  { includeReadOnly = false, external = false }: { includeReadOnly?: boolean; external?: boolean } = {}
): Promise<string | null> {
  for (const field of fields) {
    if ((field.type !== 'relation' && field.type !== 'relation-multi') || !(field.name in data) || (field.api?.readOnly && !includeReadOnly)) continue
    const ids = relationIds(field, data[field.name])
    if (!ids) return field.name
    const target = field.relation?.entity && getAllEntityConfigs().find(entity => entity.slug === field.relation?.entity)
    if (ids.length === 0 || !target) continue
    if (external && (target.access?.api === false || target.enabled === false)) return field.name
    let visible: { id: string | number }[]
    try {
      visible = await queryWithRLS<{ id: string | number }>(
        `SELECT id FROM "${target.tableName || target.slug}" WHERE id = ANY($1)`,
        [ids],
        userId
      )
    } catch (error) {
      // An id the column's type cannot hold (SQLSTATE 22P02) matches no row
      if ((error as { code?: unknown } | null)?.code === '22P02') return field.name
      throw error
    }
    // Exact match; only a uuid, which the database returns lowercase whatever the input case, is compared lowercased
    const seen = new Set(visible.map(row => String(row.id)))
    if (ids.some(id => !seen.has(UUID_PATTERN.test(id) ? id.toLowerCase() : id))) return field.name
  }
  return null
}
