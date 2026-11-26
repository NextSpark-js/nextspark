/**
 * @jest-environment jsdom
 *
 * A successful create, update, delete or bulk operation is counted; a failed one is not (#576).
 */
import { EntityApiClient, fetchWithTeam, entityMutations } from '@/core/lib/api/entities'

const respond = (ok: boolean) =>
  jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => ({ data: { id: '1' } }) })

describe('entity mutation count', () => {
  const client = new EntityApiClient()
  beforeEach(() => {
    jest.spyOn(client as never, 'getEndpointPath' as never).mockResolvedValue('tasks' as never)
  })

  test.each([
    ['create', (c: EntityApiClient) => c.create('tasks', {})],
    ['update', (c: EntityApiClient) => c.update('tasks', '1', {})],
    ['delete', (c: EntityApiClient) => c.delete('tasks', '1')],
    ['bulk operation', (c: EntityApiClient) => c.executeBulkOperation('tasks', 'op', ['1'])],
  ])('%s counts once when it succeeds and not when it fails', async (_name, run) => {
    const before = entityMutations
    global.fetch = respond(true) as never
    await run(client)
    expect(entityMutations).toBe(before + 1)

    global.fetch = respond(false) as never
    await expect(run(client)).rejects.toThrow()
    expect(entityMutations).toBe(before + 1)
  })
})

describe('fetchWithTeam (child rows, useEntityMutations)', () => {
  test.each(['POST', 'PATCH', 'PUT', 'DELETE'])('%s counts when it succeeds, not when it fails', async (method) => {
    const before = entityMutations
    global.fetch = respond(false) as never
    await fetchWithTeam('/api/v1/tasks', { method })
    expect(entityMutations).toBe(before)
    global.fetch = respond(true) as never
    await fetchWithTeam('/api/v1/tasks', { method })
    expect(entityMutations).toBe(before + 1)
  })

  test('a read does not count', async () => {
    const before = entityMutations
    global.fetch = respond(true) as never
    await fetchWithTeam('/api/v1/tasks')
    await fetchWithTeam('/api/v1/tasks', { method: 'GET' })
    expect(entityMutations).toBe(before)
  })
})
