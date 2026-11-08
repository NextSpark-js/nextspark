/** @jest-environment jsdom */
/**
 * The runtime of the generated entity clients and hooks (#277): the transport is `entityApi` / `fetchWithTeam`, the keys are
 * the dashboard's `['entity', slug, team, ...]`, and a mutation invalidates the entity's whole subtree.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

let mockTeam: { isReady: boolean } | undefined
jest.mock('@/core/contexts/TeamContext', () => ({ useOptionalTeamContext: () => mockTeam }))

const mockApi = {
  list: jest.fn<(slug: string, params?: unknown) => Promise<unknown>>(),
  get: jest.fn<(slug: string, id: string) => Promise<unknown>>(),
  create: jest.fn<(slug: string, data: unknown) => Promise<unknown>>(),
  update: jest.fn<(slug: string, id: string, data: unknown) => Promise<unknown>>(),
  delete: jest.fn<(slug: string, id: string) => Promise<unknown>>(),
}
const mockFetchWithTeam = jest.fn<(url: string, init?: RequestInit) => Promise<Response>>()
jest.mock('@/core/lib/api/entities', () => ({ entityApi: mockApi, fetchWithTeam: (url: string, init?: RequestInit) => mockFetchWithTeam(url, init) }))

import { createEntityChildClient, createEntityClient, entityQueryKeys } from '@/core/lib/api/entity-client'
import {
  useEntityChildCreate, useEntityChildDelete, useEntityChildList, useEntityChildUpdate,
  useEntityCreate, useEntityDelete, useEntityItem, useEntityList, useEntityUpdate,
} from '@/core/hooks/entity-client'

interface Task { id: string; title: string }
const tasks = createEntityClient<Task, { title: string }, { title?: string }>('tasks')
const lines = createEntityChildClient<{ id: string; sku: string }, { sku: string }, { sku?: string }>('orders', 'lines')

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { queryClient, wrapper }
}

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

beforeEach(() => {
  jest.clearAllMocks()
  mockTeam = undefined
  window.localStorage.clear()
})

describe('the client is a thin typed layer over entityApi', () => {
  test('each call goes to the entity by its slug with the arguments given', async () => {
    mockApi.list.mockResolvedValue({ success: true, data: [], info: {} })
    mockApi.get.mockResolvedValue({ id: 't1' })
    mockApi.create.mockResolvedValue({ id: 't2' })
    mockApi.update.mockResolvedValue({ id: 't1' })
    mockApi.delete.mockResolvedValue({ deleted: true, id: 't1' })
    await tasks.list({ limit: 5, filters: { title: 'x' } })
    await tasks.get('t1')
    await tasks.create({ title: 'a' })
    await tasks.update('t1', { title: 'b' })
    await tasks.delete('t1')
    expect(mockApi.list).toHaveBeenCalledWith('tasks', { limit: 5, filters: { title: 'x' } })
    expect(mockApi.get).toHaveBeenCalledWith('tasks', 't1')
    expect(mockApi.create).toHaveBeenCalledWith('tasks', { title: 'a' })
    expect(mockApi.update).toHaveBeenCalledWith('tasks', 't1', { title: 'b' })
    expect(mockApi.delete).toHaveBeenCalledWith('tasks', 't1')
  })

  test('child calls use the child routes: GET and POST on the collection, PUT and DELETE on the row, ids encoded', async () => {
    mockFetchWithTeam.mockImplementation(() => json({ success: true, data: [{ id: 'l1', sku: 'x' }] }))
    expect(await lines.list('o/1')).toEqual([{ id: 'l1', sku: 'x' }])
    mockFetchWithTeam.mockImplementation(() => json({ success: true, data: { id: 'l2', sku: 'y' } }))
    await lines.create('o1', { sku: 'y' })
    await lines.update('o1', 'l 2', { sku: 'z' })
    mockFetchWithTeam.mockImplementation(() => json({ success: true, id: 'l2' }))
    expect(await lines.delete('o1', 'l2')).toEqual({ success: true, id: 'l2' })
    expect(mockFetchWithTeam.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      'GET /api/v1/orders/o%2F1/child/lines',
      'POST /api/v1/orders/o1/child/lines',
      'PUT /api/v1/orders/o1/child/lines/l%202',
      'DELETE /api/v1/orders/o1/child/lines/l2',
    ])
    expect(mockFetchWithTeam.mock.calls[1][1]?.body).toBe('{"sku":"y"}')
  })

  test('a failed child request throws the API error message', async () => {
    mockFetchWithTeam.mockImplementation(() => json({ success: false, error: 'Child entity not found', code: 'NOT_FOUND' }, 404))
    await expect(lines.update('o1', 'nope', { sku: 'a' })).rejects.toThrow('Child entity not found')
  })
})

describe('query keys', () => {
  test('everything is under [entity, slug] and the active team is part of every other key', () => {
    window.localStorage.setItem('activeTeamId', 'team-a')
    const keys = entityQueryKeys('tasks')
    expect(keys.all).toEqual(['entity', 'tasks'])
    expect(keys.list({ limit: 5 })).toEqual(['entity', 'tasks', 'team-a', 'list', { limit: 5 }])
    expect(keys.detail('t1')).toEqual(['entity', 'tasks', 'team-a', 'detail', 't1'])
    expect(keys.children('o1', 'lines')).toEqual(['entity', 'tasks', 'team-a', 'children', 'o1', 'lines'])
    window.localStorage.setItem('activeTeamId', 'team-b')
    expect(keys.detail('t1')).toEqual(['entity', 'tasks', 'team-b', 'detail', 't1'])
  })
})

describe('queries', () => {
  test('a list is requested once and cached under its key; a different parameter is another query', async () => {
    mockApi.list.mockResolvedValue({ success: true, data: [{ id: 't1', title: 'a' }], info: {} })
    const { wrapper, queryClient } = setup()
    const { result, rerender } = renderHook(({ limit }) => useEntityList(tasks, { limit }), { wrapper, initialProps: { limit: 5 } })
    await waitFor(() => expect(result.current.data?.data[0]?.title).toBe('a'))
    expect(queryClient.getQueryData(tasks.keys.list({ limit: 5 }))).toBeDefined()
    rerender({ limit: 10 })
    await waitFor(() => expect(mockApi.list).toHaveBeenCalledTimes(2))
    expect(mockApi.list).toHaveBeenLastCalledWith('tasks', { limit: 10 })
  })

  test('nothing is requested until the team is ready, nor an item without an id, nor when disabled', async () => {
    mockApi.list.mockResolvedValue({ success: true, data: [], info: {} })
    mockApi.get.mockResolvedValue({ id: 't1', title: 'a' })
    const { wrapper } = setup()
    mockTeam = { isReady: false }
    const waiting = renderHook(() => useEntityList(tasks), { wrapper })
    const noId = renderHook(() => useEntityItem(tasks, undefined), { wrapper })
    mockTeam = { isReady: true }
    const off = renderHook(() => useEntityList(tasks, undefined, { enabled: false }), { wrapper })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(mockApi.list).not.toHaveBeenCalled()
    expect(mockApi.get).not.toHaveBeenCalled()
    expect([waiting, noId, off].every(hook => hook.result.current.fetchStatus === 'idle')).toBe(true)
    mockTeam = { isReady: true }
    const ready = renderHook(() => useEntityItem(tasks, 't1'), { wrapper })
    await waitFor(() => expect(ready.result.current.data?.title).toBe('a'))
  })

  test('child rows of a parent are listed under the children key; nothing is asked without a parent', async () => {
    mockFetchWithTeam.mockImplementation(() => json({ success: true, data: [{ id: 'l1', sku: 'x' }] }))
    const { wrapper, queryClient } = setup()
    const idle = renderHook(() => useEntityChildList(lines, undefined), { wrapper })
    expect(idle.result.current.fetchStatus).toBe('idle')
    const { result } = renderHook(() => useEntityChildList(lines, 'o1'), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'l1', sku: 'x' }]))
    expect(queryClient.getQueryData(lines.keys.children('o1', 'lines'))).toEqual([{ id: 'l1', sku: 'x' }])
  })
})

describe('invalidation rules', () => {
  /** Seed an item, a list, a child list and an unrelated entity's list, and report which of them a mutation invalidated. */
  function seeded(slug = 'tasks') {
    const { wrapper, queryClient } = setup()
    const own = entityQueryKeys(slug)
    const keys = {
      list: own.list({ limit: 5 }),
      detail: own.detail('t1'),
      other: own.detail('t2'),
      children: own.children('o1', 'lines'),
      dashboard: ['entity', slug, null, { pageSize: 10 }] as const,
      unrelated: entityQueryKeys('notes').list(),
    }
    for (const key of Object.values(keys)) queryClient.setQueryData(key, { seeded: true })
    const invalidated = () => Object.entries(keys).filter(([, key]) => queryClient.getQueryState(key)?.isInvalidated).map(([name]) => name).sort()
    return { wrapper, queryClient, keys, invalidated }
  }

  test('create invalidates every query of the entity (lists, items, children, the dashboard lists) and no other entity', async () => {
    mockApi.create.mockResolvedValue({ id: 't9', title: 'n' })
    const { wrapper, invalidated } = seeded()
    const { result } = renderHook(() => useEntityCreate(tasks), { wrapper })
    await act(async () => { await result.current.mutateAsync({ title: 'n' }) })
    expect(invalidated()).toEqual(['children', 'dashboard', 'detail', 'list', 'other'])
  })

  test('update writes the returned row into the item and invalidates the rest', async () => {
    mockApi.update.mockResolvedValue({ id: 't1', title: 'renamed' })
    const { wrapper, queryClient, keys } = seeded()
    const { result } = renderHook(() => useEntityUpdate(tasks), { wrapper })
    await act(async () => { await result.current.mutateAsync({ id: 't1', data: { title: 'renamed' } }) })
    expect(queryClient.getQueryData(keys.detail)).toEqual({ id: 't1', title: 'renamed' })
    expect(queryClient.getQueryState(keys.list)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(keys.unrelated)?.isInvalidated).toBe(false)
  })

  test('delete removes the item query, so it is not refetched, and invalidates the rest', async () => {
    mockApi.delete.mockResolvedValue({ deleted: true, id: 't1' })
    const { wrapper, queryClient, keys } = seeded()
    const { result } = renderHook(() => useEntityDelete(tasks), { wrapper })
    await act(async () => { await result.current.mutateAsync('t1') })
    expect(queryClient.getQueryState(keys.detail)).toBeUndefined()
    expect(queryClient.getQueryState(keys.other)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(keys.list)?.isInvalidated).toBe(true)
  })

  test('a failed mutation invalidates nothing and surfaces the error', async () => {
    mockApi.create.mockRejectedValue(new Error('The provided data is not valid.'))
    const { wrapper, invalidated } = seeded()
    const { result } = renderHook(() => useEntityCreate(tasks), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync({ title: '' })).rejects.toThrow('not valid') })
    expect(invalidated()).toEqual([])
  })

  test("the caller's own onSuccess still runs, after the invalidation", async () => {
    mockApi.create.mockResolvedValue({ id: 't9', title: 'n' })
    const { wrapper, invalidated } = seeded()
    let seen: string[] = []
    const { result } = renderHook(() => useEntityCreate(tasks, { onSuccess: () => { seen = invalidated() } }), { wrapper })
    await act(async () => { await result.current.mutateAsync({ title: 'n' }) })
    expect(seen).toContain('list')
  })

  test('child mutations invalidate the whole entity subtree: the child list and the parent item', async () => {
    mockFetchWithTeam.mockImplementation(() => json({ success: true, data: { id: 'l2', sku: 'y' } }))
    const { wrapper, invalidated } = seeded('orders')
    const create = renderHook(() => useEntityChildCreate(lines), { wrapper })
    await act(async () => { await create.result.current.mutateAsync({ parentId: 'o1', data: { sku: 'y' } }) })
    expect(invalidated()).toEqual(['children', 'dashboard', 'detail', 'list', 'other'])
    const update = renderHook(() => useEntityChildUpdate(lines), { wrapper })
    await act(async () => { await update.result.current.mutateAsync({ parentId: 'o1', id: 'l2', data: { sku: 'z' } }) })
    const remove = renderHook(() => useEntityChildDelete(lines), { wrapper })
    await act(async () => { await remove.result.current.mutateAsync({ parentId: 'o1', id: 'l2' }) })
    expect(mockFetchWithTeam.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'PUT', 'DELETE'])
  })
})
