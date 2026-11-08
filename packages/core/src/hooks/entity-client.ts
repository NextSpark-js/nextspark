'use client'

/**
 * TanStack Query hooks over the typed entity clients (#277). The generated `<slug>.hooks.ts` files are one-line
 * wrappers around these, so the behaviour (what is requested, when, and what a mutation invalidates) lives here
 * once and is tested once.
 *
 * Invalidation rules:
 * - every mutation of an entity (create, update, delete, and any child mutation: a child is part of its parent)
 *   invalidates `client.keys.all`, i.e. every query under `['entity', slug]`: lists, items, child lists and the
 *   dashboard's own lists of that entity. The mutation settles when those queries have been refetched;
 * - update also writes the returned row into the item's cache, so an open detail view updates at once;
 * - delete also removes the deleted item's cached query. A component that still has that item mounted
 *   (`useTask(id)`) observes it again and may request it, so unmount or disable it (`enabled: false`) when you delete.
 */

import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query'
import { useOptionalTeamContext } from '../contexts/TeamContext'
import type { EntityChildClient, EntityClient, EntityClientListParams, EntityDeleteResult, EntityListResult } from '../lib/api/entity-client'

export type EntityQueryOptions<TData> = Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'>
export type EntityMutationOptions<TData, TVariables> = Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>

// Nothing is requested before the team is chosen (no TeamProvider above: nothing to wait for)
function useTeamReady() {
  return useOptionalTeamContext()?.isReady ?? true
}

export function useEntityList<T, TCreate, TUpdate>(
  client: EntityClient<T, TCreate, TUpdate>,
  params?: EntityClientListParams<T>,
  options?: EntityQueryOptions<EntityListResult<T>>
) {
  const teamReady = useTeamReady()
  return useQuery<EntityListResult<T>, Error>({
    ...options,
    queryKey: client.keys.list(params),
    queryFn: () => client.list(params),
    enabled: teamReady && (options?.enabled ?? true),
  })
}

/** One item; nothing is requested while `id` is undefined. */
export function useEntityItem<T, TCreate, TUpdate>(
  client: EntityClient<T, TCreate, TUpdate>,
  id: string | undefined,
  options?: EntityQueryOptions<T>
) {
  const teamReady = useTeamReady()
  return useQuery<T, Error>({
    ...options,
    queryKey: client.keys.detail(id ?? ''),
    queryFn: () => client.get(id as string),
    enabled: teamReady && Boolean(id) && (options?.enabled ?? true),
  })
}

export function useEntityCreate<T, TCreate, TUpdate>(client: EntityClient<T, TCreate, TUpdate>, options?: EntityMutationOptions<T, TCreate>) {
  const queryClient = useQueryClient()
  return useMutation<T, Error, TCreate>({
    ...options,
    mutationFn: async data => {
      const created = await client.create(data)
      await queryClient.invalidateQueries({ queryKey: client.keys.all })
      return created
    },
  })
}

export function useEntityUpdate<T, TCreate, TUpdate>(client: EntityClient<T, TCreate, TUpdate>, options?: EntityMutationOptions<T, { id: string; data: TUpdate }>) {
  const queryClient = useQueryClient()
  return useMutation<T, Error, { id: string; data: TUpdate }>({
    ...options,
    mutationFn: async ({ id, data }) => {
      const updated = await client.update(id, data)
      queryClient.setQueryData(client.keys.detail(id), updated)
      await queryClient.invalidateQueries({ queryKey: client.keys.all })
      return updated
    },
  })
}

export function useEntityDelete<T, TCreate, TUpdate>(client: EntityClient<T, TCreate, TUpdate>, options?: EntityMutationOptions<EntityDeleteResult, string>) {
  const queryClient = useQueryClient()
  return useMutation<EntityDeleteResult, Error, string>({
    ...options,
    mutationFn: async id => {
      const deleted = await client.delete(id)
      // Drops the cached item; an observer still mounted on it re-creates the query (see the rules above)
      queryClient.removeQueries({ queryKey: client.keys.detail(id) })
      await queryClient.invalidateQueries({ queryKey: client.keys.all })
      return deleted
    },
  })
}

/** The rows of a child entity of one parent record; nothing is requested while `parentId` is undefined. */
export function useEntityChildList<TRow, TCreate, TUpdate>(
  client: EntityChildClient<TRow, TCreate, TUpdate>,
  parentId: string | undefined,
  options?: EntityQueryOptions<TRow[]>
) {
  const teamReady = useTeamReady()
  return useQuery<TRow[], Error>({
    ...options,
    queryKey: client.keys.children(parentId ?? '', client.child),
    queryFn: () => client.list(parentId as string),
    enabled: teamReady && Boolean(parentId) && (options?.enabled ?? true),
  })
}

export function useEntityChildCreate<TRow, TCreate, TUpdate>(client: EntityChildClient<TRow, TCreate, TUpdate>, options?: EntityMutationOptions<TRow, { parentId: string; data: TCreate }>) {
  const queryClient = useQueryClient()
  return useMutation<TRow, Error, { parentId: string; data: TCreate }>({
    ...options,
    mutationFn: async ({ parentId, data }) => {
      const created = await client.create(parentId, data)
      await queryClient.invalidateQueries({ queryKey: client.keys.all })
      return created
    },
  })
}

export function useEntityChildUpdate<TRow, TCreate, TUpdate>(client: EntityChildClient<TRow, TCreate, TUpdate>, options?: EntityMutationOptions<TRow, { parentId: string; id: string; data: TUpdate }>) {
  const queryClient = useQueryClient()
  return useMutation<TRow, Error, { parentId: string; id: string; data: TUpdate }>({
    ...options,
    mutationFn: async ({ parentId, id, data }) => {
      const updated = await client.update(parentId, id, data)
      await queryClient.invalidateQueries({ queryKey: client.keys.all })
      return updated
    },
  })
}

export function useEntityChildDelete<TRow, TCreate, TUpdate>(client: EntityChildClient<TRow, TCreate, TUpdate>, options?: EntityMutationOptions<EntityDeleteResult, { parentId: string; id: string }>) {
  const queryClient = useQueryClient()
  return useMutation<EntityDeleteResult, Error, { parentId: string; id: string }>({
    ...options,
    mutationFn: async ({ parentId, id }) => {
      const deleted = await client.delete(parentId, id)
      await queryClient.invalidateQueries({ queryKey: client.keys.all })
      return deleted
    },
  })
}
