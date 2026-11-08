/**
 * Typed entity clients (#277).
 *
 * `nextspark prepare` generates, for every entity, a client built with `createEntityClient` (and one per child
 * entity with `createEntityChildClient`), typed with the entity's own contract types. This module is the runtime
 * those generated files call: `entityApi` / `fetchWithTeam` stay the transport, so authentication, the team header
 * and the base path are exactly the ones the dashboard uses.
 *
 * Browser only: the transport carries the session cookie and the active team, which exist only there. On the server use the services.
 *
 * No React in here: the TanStack Query hooks are in `hooks/entity-client`, so a route that only calls the client
 * does not bundle them.
 */

import { entityApi, fetchWithTeam, type EntityData } from './entities'

export interface EntityListInfo {
  timestamp: string
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface EntityListResult<T> {
  success: true
  data: T[]
  info: EntityListInfo
}

/** The query-string filters of a list: a field of the entity, or one of the three reserved keys. */
export type EntityFilterKey<T> = Extract<keyof T, string> | 'search' | 'sortBy' | 'sortOrder'

export interface EntityClientListParams<T> {
  page?: number
  limit?: number
  includeMeta?: boolean
  filters?: Partial<Record<EntityFilterKey<T>, string>>
}

/**
 * The TanStack Query keys of an entity. Everything is under `['entity', slug]`, the prefix the dashboard's own
 * hooks use, so one invalidation of `keys.all` refreshes the generated hooks and the dashboard lists alike.
 * The active team is part of every other key: a team switch never shows another team's cached rows.
 */
export interface EntityQueryKeys {
  readonly all: readonly ['entity', string]
  list(params?: object): readonly unknown[]
  detail(id: string): readonly unknown[]
  children(parentId: string, child: string): readonly unknown[]
}

function activeTeamId(): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem('activeTeamId') : null
  } catch {
    return null
  }
}

export function entityQueryKeys(slug: string): EntityQueryKeys {
  return {
    all: ['entity', slug],
    list: params => ['entity', slug, activeTeamId(), 'list', params ?? {}],
    detail: id => ['entity', slug, activeTeamId(), 'detail', id],
    children: (parentId, child) => ['entity', slug, activeTeamId(), 'children', parentId, child],
  }
}

/** What a delete answers, for entities and for child rows alike: `{ success: true, id }`. */
export interface EntityDeleteResult {
  success: true
  id: string
}

export interface EntityClient<T, TCreate, TUpdate> {
  readonly slug: string
  readonly keys: EntityQueryKeys
  list(params?: EntityClientListParams<T>): Promise<EntityListResult<T>>
  get(id: string): Promise<T>
  create(data: TCreate): Promise<T>
  update(id: string, data: TUpdate): Promise<T>
  delete(id: string): Promise<EntityDeleteResult>
}

export function createEntityClient<T, TCreate, TUpdate>(slug: string): EntityClient<T, TCreate, TUpdate> {
  return {
    slug,
    keys: entityQueryKeys(slug),
    list: params => entityApi.list(slug, params) as unknown as Promise<EntityListResult<T>>,
    get: id => entityApi.get(slug, id) as unknown as Promise<T>,
    create: data => entityApi.create(slug, data as EntityData) as unknown as Promise<T>,
    update: (id, data) => entityApi.update(slug, id, data as Partial<EntityData>) as unknown as Promise<T>,
    delete: id => entityApi.delete(slug, id) as unknown as Promise<EntityDeleteResult>,
  }
}

/** The columns the child routes add to every row. */
export interface EntityChildColumns {
  id: string
  parentId: string
  createdAt: string
  updatedAt: string
}

export interface EntityChildClient<TRow, TCreate, TUpdate> {
  readonly slug: string
  readonly child: string
  readonly keys: EntityQueryKeys
  list(parentId: string): Promise<TRow[]>
  create(parentId: string, data: TCreate): Promise<TRow>
  update(parentId: string, id: string, data: TUpdate): Promise<TRow>
  delete(parentId: string, id: string): Promise<EntityDeleteResult>
}

async function childRequest<R>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<R> {
  const response = await fetchWithTeam(`/api/v1/${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const result = (await response.json().catch(() => ({}))) as { data?: R; error?: string; message?: string }
  if (!response.ok) throw new Error(result.error || result.message || `Request failed (${response.status})`)
  return (method === 'DELETE' ? result : result.data) as R
}

/** The client of a child entity (`/api/v1/<slug>/<parentId>/child/<child>`), a part of its parent record. */
export function createEntityChildClient<TRow, TCreate, TUpdate>(slug: string, child: string): EntityChildClient<TRow, TCreate, TUpdate> {
  const base = (parentId: string) => `${encodeURIComponent(slug)}/${encodeURIComponent(parentId)}/child/${encodeURIComponent(child)}`
  return {
    slug,
    child,
    keys: entityQueryKeys(slug),
    list: parentId => childRequest<TRow[]>(base(parentId), 'GET'),
    create: (parentId, data) => childRequest<TRow>(base(parentId), 'POST', data),
    update: (parentId, id, data) => childRequest<TRow>(`${base(parentId)}/${encodeURIComponent(id)}`, 'PUT', data),
    delete: (parentId, id) => childRequest<EntityDeleteResult>(`${base(parentId)}/${encodeURIComponent(id)}`, 'DELETE'),
  }
}
