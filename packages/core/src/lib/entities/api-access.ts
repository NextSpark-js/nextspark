/**
 * Per-operation access to the generic entity API (#376).
 *
 * `access.api` is `true`, `false`, or an object that names the operations the generic routes serve:
 * `{ read?, create?, update?, delete? }`. This module is the one place that decides, so the handlers,
 * the OpenAPI document, the MCP tools, the API explorer and the config validation all agree.
 *
 * - `true` / `false` keep their meaning (#312): every operation is served, and `false` additionally
 *   closes the entity to API-key callers (handled by the handler, not here).
 * - An object is fail-closed: a missing key is `false`. It applies to session and API-key callers alike.
 *
 * Methods map to operations like this (the most restrictive operation wins when a route is unclear):
 *   GET -> read, POST -> create, PATCH / PUT -> update, DELETE -> delete.
 * Child routes belong to their parent record: GET -> read, and POST / PUT / DELETE -> update
 * (changing a child is an update of the parent, as its permission check already treats it).
 * Search, filters, `distinct`, `ids`, metadata and `?children=` ride on the GET they are part of -> read.
 */

export type ApiOperation = 'read' | 'create' | 'update' | 'delete'

export const API_OPERATIONS: readonly ApiOperation[] = ['read', 'create', 'update', 'delete']

export type ApiOperationAccess = Partial<Record<ApiOperation, boolean>>

/** The generic routes of an entity: its collection, one record, and the child routes of a record. */
export type ApiRouteKind = 'collection' | 'item' | 'childCollection' | 'childItem'

/** The methods each route serves and the operation each one needs. */
const ROUTE_METHODS: Record<ApiRouteKind, ReadonlyArray<readonly [string, ApiOperation]>> = {
  collection: [['GET', 'read'], ['POST', 'create']],
  item: [['GET', 'read'], ['PATCH', 'update'], ['DELETE', 'delete']],
  childCollection: [['GET', 'read'], ['POST', 'update']],
  childItem: [['PUT', 'update'], ['DELETE', 'update']],
}

type WithApiAccess = { access?: { api?: boolean | ApiOperationAccess } }

/** Whether the generic API serves `operation` for this entity (an object names the operations; `true`/`false` serve all). */
export function isApiOperationEnabled(config: WithApiAccess, operation: ApiOperation): boolean {
  const api = config.access?.api
  return typeof api === 'object' && api !== null ? api[operation] === true : true
}

/** The methods of a route that are enabled, in the `Allow` header order. `OPTIONS` (CORS preflight) is always served. */
export function allowedMethods(config: WithApiAccess, route: ApiRouteKind): string[] {
  return [...ROUTE_METHODS[route].filter(([, operation]) => isApiOperationEnabled(config, operation)).map(([method]) => method), 'OPTIONS']
}

/** Validation messages for an `access.api` value; empty when it is valid. */
export function apiAccessErrors(api: unknown): string[] {
  if (typeof api === 'boolean') return []
  if (typeof api !== 'object' || api === null || Array.isArray(api)) {
    return ['access.api must be a boolean or an object { read?, create?, update?, delete? }']
  }
  const errors: string[] = []
  for (const [key, value] of Object.entries(api)) {
    if (!(API_OPERATIONS as readonly string[]).includes(key)) {
      errors.push(`access.api has an unknown operation "${key}" (use ${API_OPERATIONS.join(', ')})`)
    } else if (typeof value !== 'boolean') {
      errors.push(`access.api.${key} must be a boolean`)
    }
  }
  return errors
}

/** The methods of `route` that stay once the entity's disabled operations are removed. */
export function enabledRouteMethods(config: WithApiAccess, route: ApiRouteKind, methods: string[]): string[] {
  const allowed = new Set(allowedMethods(config, route))
  return methods.filter(method => allowed.has(method))
}
