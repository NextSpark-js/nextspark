/**
 * Regression coverage for #97 (case 5): the create/update schemas built by
 * generateEntitySchemas used plain z.object(), whose default is to silently
 * STRIP unknown keys. `POST { notes: '...' }` against an entity whose field is
 * `note` returned 201 with the value quietly discarded. The schemas are now
 * strict: unknown keys fail validation so the handler can answer 400.
 */

jest.mock('server-only', () => ({}))

import { generateEntitySchemas } from '@/core/lib/entities/schema-generator'
import type { EntityConfig } from '@/core/lib/entities/types'
import { FileText } from 'lucide-react'

function makeConfig(extra: Partial<EntityConfig> = {}): EntityConfig {
  return {
    slug: 'events',
    enabled: true,
    names: { singular: 'Event', plural: 'Events' },
    icon: FileText,
    access: { public: false, api: true, metadata: false, shared: false },
    ui: {
      dashboard: { showInMenu: false, showInTopbar: false },
      public: { hasArchivePage: false, hasSinglePage: false },
      features: { searchable: false, sortable: false, filterable: false, bulkOperations: false, importExport: false },
    },
    i18n: { fallbackLocale: 'en', loaders: { en: async () => ({}) } },
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
        name: 'note',
        type: 'textarea',
        required: false,
        display: { label: 'Note', description: '', showInList: true, showInDetail: true, showInForm: true, order: 2 },
        validation: {},
        api: { searchable: false, sortable: false, readOnly: false },
      },
    ],
    ...extra,
  } as unknown as EntityConfig
}

describe('generateEntitySchemas — #97 strict object schemas', () => {
  it('create schema rejects an unknown key instead of stripping it', () => {
    const { create } = generateEntitySchemas(makeConfig())

    const result = create.safeParse({ title: 'Launch', notes: 'typo for note' })

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(i => i.code === 'unrecognized_keys')
      expect(issue).toBeDefined()
      expect((issue as { keys: string[] }).keys).toEqual(['notes'])
    }
  })

  it('update schema (partial) is strict as well', () => {
    const { update } = generateEntitySchemas(makeConfig())

    const ok = update.safeParse({ note: 'fine' })
    expect(ok.success).toBe(true)

    const bad = update.safeParse({ notes: 'typo' })
    expect(bad.success).toBe(false)
  })

  it('still accepts every declared field, plus the handler-managed `children`, `blocks` and builder `settings` keys', () => {
    const { create } = generateEntitySchemas(makeConfig({
      builder: { enabled: true },
      childEntities: {
        sessions: {
          fields: [{ name: 'label', type: 'text', required: false }],
        },
      },
    } as unknown as Partial<EntityConfig>))

    const result = create.safeParse({
      title: 'Launch',
      note: 'ok',
      blocks: [],
      settings: { seo: {}, customFields: [] },
      children: { sessions: [{ label: 'Day 1' }] },
    })

    expect(result.success).toBe(true)
  })

  it('rejects builder-only keys on entities without the builder enabled', () => {
    const { create } = generateEntitySchemas(makeConfig())

    expect(create.safeParse({ title: 'Launch', blocks: [] }).success).toBe(false)
    expect(create.safeParse({ title: 'Launch', settings: {} }).success).toBe(false)
  })

  it('child entity schemas are strict too', () => {
    const { create } = generateEntitySchemas(makeConfig({
      childEntities: {
        sessions: { fields: [{ name: 'label', type: 'text', required: false }] },
      },
    } as unknown as Partial<EntityConfig>))

    const result = create.safeParse({
      title: 'Launch',
      children: { sessions: [{ label: 'Day 1', lable: 'typo' }] },
    })

    expect(result.success).toBe(false)
  })
})

describe('generateEntitySchemas — update schema tolerates the record a client PATCHes back (#97 follow-up)', () => {
  const fullRecord = {
    id: 'row-1',
    userId: 'user-1',
    teamId: 'team-1',
    createdAt: '2026-09-01T22:24:55.058Z',
    updatedAt: '2026-09-01T22:24:55.058Z',
    title: 'Edited from the form',
    note: null,
  }

  it('strips the system/read-only columns instead of rejecting them as unknown keys', () => {
    const { update } = generateEntitySchemas(makeConfig())

    const result = update.safeParse(fullRecord)

    expect(result.success).toBe(true)
    expect(result.success && result.data).toEqual({ title: 'Edited from the form', note: null })
  })

  it('also strips soft-delete markers and entity fields flagged api.readOnly', () => {
    const { update } = generateEntitySchemas(makeConfig({
      table: { softDelete: true },
      fields: [
        ...makeConfig().fields,
        {
          name: 'computedScore',
          type: 'number',
          required: false,
          display: { label: 'Score', description: '', showInList: true, showInDetail: true, showInForm: false, order: 3 },
          validation: {},
          api: { searchable: false, sortable: true, readOnly: true },
        },
      ],
    } as unknown as Partial<EntityConfig>))

    const result = update.safeParse({ ...fullRecord, deletedAt: null, deletedBy: null, computedScore: 42 })

    expect(result.success).toBe(true)
    expect(result.success && result.data).toEqual({ title: 'Edited from the form', note: null })
  })

  it('still rejects a genuinely unknown key alongside the system columns', () => {
    const { update } = generateEntitySchemas(makeConfig())

    const result = update.safeParse({ ...fullRecord, notes: 'typo' })

    expect(result.success).toBe(false)
    expect(result.success || result.error.issues.map(issue => issue.code)).toContain('unrecognized_keys')
  })
})
