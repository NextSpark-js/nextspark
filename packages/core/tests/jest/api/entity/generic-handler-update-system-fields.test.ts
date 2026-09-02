/**
 * Regression coverage for the #97 follow-up found in the integration E2E run:
 * the dashboard edit form PATCHes the whole record it loaded (system columns
 * included) and the strict update schema answered 400 "Unknown field(s): id,
 * createdAt, updatedAt", so no entity could be edited from the UI. The update
 * path must strip those columns and keep rejecting real typos.
 *
 * Uses the real schema generator through the harness mock.
 */

import { harness, makeRequest, SESSION_AUTH } from './__helpers__/generic-handler-harness'
import { handleGenericUpdate } from '@/core/lib/api/entity/generic-handler'
import type { EntityConfig } from '@/core/lib/entities/types'

const { mocks } = harness

type Res = { status: number; body: { success: boolean; code?: string; error?: string; data?: Record<string, unknown> } }
const TEAM_HEADERS = { 'x-team-id': 'team-1' }

const NOTES_ENTITY = {
  slug: 'notes',
  tableName: 'notes',
  access: { api: true },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      display: { label: 'Title', description: '', showInList: true, showInDetail: true, showInForm: true, order: 1 },
      validation: {},
      api: { searchable: true, sortable: true, readOnly: false },
    },
    {
      name: 'body',
      type: 'textarea',
      required: false,
      display: { label: 'Body', description: '', showInList: true, showInDetail: true, showInForm: true, order: 2 },
      validation: {},
      api: { searchable: false, sortable: false, readOnly: false },
    },
  ],
} as unknown as EntityConfig

const STORED_ROW = {
  id: 'note-1',
  userId: 'user-1',
  teamId: 'team-1',
  createdAt: '2026-09-01T22:24:55.058Z',
  updatedAt: '2026-09-01T22:24:55.058Z',
  title: 'Original',
  body: 'Original body',
}

function patch(body: Record<string, unknown>) {
  return handleGenericUpdate(
    makeRequest({ method: 'PATCH', url: 'http://localhost/api/v1/notes/note-1', headers: TEAM_HEADERS, body }),
    { params: Promise.resolve({ entity: 'notes', id: 'note-1' }) }
  ) as unknown as Promise<Res>
}

beforeEach(() => {
  harness.reset()
  mocks.resolveEntityFromUrl.mockResolvedValue({
    isValidEntity: true,
    entityConfig: NOTES_ENTITY,
    entityName: 'notes',
    hasCustomOverride: false,
  })
  mocks.authenticateRequest.mockResolvedValue(SESSION_AUTH())
  // Real schemas, not the permissive harness stub — the strict policy is the subject here.
  const { generateEntitySchemas } = jest.requireActual('@/core/lib/entities/schema-generator') as typeof import('@/core/lib/entities/schema-generator')
  mocks.generateEntitySchemas.mockImplementation(generateEntitySchemas)
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ ...STORED_ROW, title: 'Edited from the form' }] })
})

describe('handleGenericUpdate — PATCH with the full record (#97 follow-up)', () => {
  it('accepts the record the edit form sends back, system columns included, and updates the row', async () => {
    const response = await patch({ ...STORED_ROW, title: 'Edited from the form' })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    const updates = mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => sql.includes('UPDATE "notes"')) as Array<[string, unknown[]]>
    expect(updates).toHaveLength(1)
    const [sql, params] = updates[0]
    expect(params).toContain('Edited from the form')
    // The read-only columns from the body never reach the SET clause; the
    // handler stamps `updatedAt` itself with CURRENT_TIMESTAMP, not from input.
    for (const column of ['"id" = $', '"createdAt" = $', '"updatedAt" = $']) {
      expect(sql).not.toContain(column)
    }
    expect(sql).toContain('"updatedAt" = CURRENT_TIMESTAMP')
  })

  it('still answers 400 VALIDATION_ERROR naming a genuinely unknown key', async () => {
    const response = await patch({ ...STORED_ROW, titel: 'typo' })

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('VALIDATION_ERROR')
    expect(response.body.error).toBe('Unknown field(s): titel')
    // No UPDATE was issued (the only write is #105's audit-log row).
    const updates = mocks.mutateWithRLS.mock.calls.filter(([sql]: [string]) => sql.includes('UPDATE "notes"'))
    expect(updates).toHaveLength(0)
  })
})
