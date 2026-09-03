/**
 * Regression test for the entity-config serialization boundary.
 *
 * `serializeEntityConfig`/`serializeChildEntityConfig` feed the `entities`
 * prop that `apps/dev/app/dashboard/(main)/layout.tsx` passes into
 * `DashboardShell` ('use client'). `EntityConfig.hooks` / ChildEntityDefinition's
 * `hooks` hold live functions — if either serializer forwards them, React
 * throws "Functions cannot be passed directly to Client Components" the
 * moment ANY entity in the whole app declares hooks, crashing the dashboard
 * for every user (not just for that entity), since callers pass the full
 * entity list as one array. Caught end-to-end via /do:test-package on
 * 2026-09-03; this test pins the fix at the unit level so it can't regress
 * silently again.
 */
jest.mock('server-only', () => ({}))

import {
  serializeEntityConfig,
  serializeChildEntityConfig,
} from '@/core/lib/entities/serialization'
import type { EntityConfig, ChildEntityDefinition } from '@/core/lib/entities/types'
import { CheckSquare } from 'lucide-react'

const BASE_ENTITY: EntityConfig = {
  slug: 'tasks',
  enabled: true,
  names: { singular: 'Task', plural: 'Tasks' },
  icon: CheckSquare,
  access: { public: false, api: true },
  ui: {
    dashboard: { showInMenu: true, showInTopbar: true },
    public: { hasArchivePage: false, hasSinglePage: false },
    features: {
      searchable: true,
      sortable: true,
      filterable: true,
      bulkOperations: false,
      importExport: false,
    },
  },
  fields: [],
  hooks: {
    beforeCreate: [async () => ({ continue: true })],
    afterCreate: [async () => undefined],
  },
} as unknown as EntityConfig

describe('serializeEntityConfig', () => {
  it('strips hooks so no function crosses the Server -> Client boundary', () => {
    const serialized = serializeEntityConfig(BASE_ENTITY)

    expect(serialized).not.toHaveProperty('hooks')
    expect(JSON.stringify(serialized)).not.toContain('function')
  })

  it('still resolves iconName and i18nFallbackLocale as before', () => {
    const serialized = serializeEntityConfig(BASE_ENTITY)

    expect(serialized.iconName).toBe('CheckSquare')
    expect(serialized.i18nFallbackLocale).toBe('en')
  })

  it('is safe to pass through JSON (the real constraint React enforces)', () => {
    const serialized = serializeEntityConfig(BASE_ENTITY)
    expect(() => JSON.parse(JSON.stringify(serialized))).not.toThrow()
  })
})

describe('serializeChildEntityConfig', () => {
  const CHILD_ENTITY = {
    slug: 'subtasks',
    parent: 'tasks',
    table: 'subtasks',
    fields: [],
    hooks: {
      beforeChildCreate: [async () => ({ continue: true })],
    },
  } as unknown as ChildEntityDefinition

  it('strips hooks the same way as serializeEntityConfig', () => {
    const serialized = serializeChildEntityConfig(CHILD_ENTITY)

    expect(serialized).not.toHaveProperty('hooks')
    expect(JSON.stringify(serialized)).not.toContain('function')
  })
})
