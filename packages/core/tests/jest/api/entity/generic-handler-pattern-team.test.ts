/**
 * #344: the pattern references of a record are scoped to the team the record is written to. A user who belongs to
 * two teams cannot keep a reference to a pattern of the other one in a page of this team, on create or update.
 */

import { harness, makeRequest, SESSION_AUTH, PETS_ENTITY } from './__helpers__/generic-handler-harness'
import { handleGenericCreate, handleGenericUpdate } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness
// the pattern-usage service is replaced by the harness (see __helpers__); only this lookup matters here
const getExistingPatternIds = jest.requireMock('@/core/lib/services/pattern-usage.service').PatternUsageService.getExistingPatternIds as jest.Mock

type Res = { status: number }

const PAGES = { ...PETS_ENTITY, builder: { enabled: true }, fields: [...PETS_ENTITY.fields, { name: 'blocks', type: 'json', api: { readOnly: false } }] } as unknown as EntityConfig
const HEADERS = { 'x-team-id': 'team-A', 'x-builder-source': 'true' }
const ref = (id: string) => ({ type: 'pattern', ref: id, id: `ref-${id}` })
const hero = { id: 'b1', blockSlug: 'hero', props: {} }

/** The patterns that exist, by owner team. The user belongs to both teams (RLS alone would show both). */
const OWNER: Record<string, string> = { 'pat-A': 'team-A', 'pat-B': 'team-B' }

beforeEach(() => {
  harness.reset()
  mocks.resolveEntityFromUrl.mockResolvedValue({ isValidEntity: true, entityConfig: PAGES, entityName: 'pets' })
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'pet-1' }] })
  getExistingPatternIds.mockImplementation(async (ids: string[], _user: string, team: string) => new Set(ids.filter(id => OWNER[id] === team)))
})

const savedBlocks = () => {
  const [sql, params] = mocks.mutateWithRLS.mock.calls.find(([s]: [string]) => /^\s*(INSERT|UPDATE)/i.test(s) && s.includes('"blocks"'))
  return JSON.parse((params as unknown[]).find(p => typeof p === 'string' && p.startsWith('[')) as string) as unknown[]
}

describe('pattern references on save', () => {
  it('create: keeps the pattern of the target team and drops the one of the user\'s other team', async () => {
    const res = await (handleGenericCreate(makeRequest({
      method: 'POST', url: 'http://localhost/api/v1/pets', headers: HEADERS,
      body: { name: 'Home', blocks: [hero, ref('pat-A'), ref('pat-B')] },
    })) as unknown as Promise<Res>)
    expect(res.status).toBe(201)
    expect(getExistingPatternIds).toHaveBeenCalledWith(['pat-A', 'pat-B'], 'session-user-1', 'team-A')
    expect(savedBlocks()).toEqual([hero, ref('pat-A')])
  })

  it('update: scopes the references to the team the page is updated in', async () => {
    const res = await (handleGenericUpdate(
      makeRequest({ method: 'PATCH', url: 'http://localhost/api/v1/pets/pet-1', headers: HEADERS, body: { blocks: [ref('pat-B'), hero] } }),
      { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) }
    ) as unknown as Promise<Res>)
    expect(res.status).toBe(200)
    expect(getExistingPatternIds).toHaveBeenCalledWith(['pat-B'], 'session-user-1', 'team-A')
    expect(savedBlocks()).toEqual([hero])
  })

  it('does not look anything up when the blocks hold no pattern reference', async () => {
    await handleGenericCreate(makeRequest({ method: 'POST', url: 'http://localhost/api/v1/pets', headers: HEADERS, body: { name: 'Home', blocks: [hero] } }))
    expect(getExistingPatternIds).not.toHaveBeenCalled()
    expect(savedBlocks()).toEqual([hero])
  })
})
