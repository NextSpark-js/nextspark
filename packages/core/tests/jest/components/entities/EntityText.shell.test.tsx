/**
 * @jest-environment jsdom
 *
 * Outside the list, form and detail pages, the dashboard names entities from their catalog too (#421): the sidebar,
 * the enabled-entities, quick-create and search hooks, and the child sections of a detail page, with the entity
 * name inside a sentence in lower case except in German. The starter's tasks, in Spanish and German.
 */
import React from 'react'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'

type Messages = Record<string, unknown>
let mockMessages: Messages = {}
let mockLocale = 'es'

function mockRead(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Messages)[part] : undefined), mockMessages)
}

// One translator per namespace and catalog, as next-intl memoizes its own (the search hooks memoize on it)
const mockTranslators = new Map<string, unknown>()
let mockTranslatorsFor: Messages | null = null
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useMessages: () => mockMessages,
  useTranslations: (namespace?: string) => {
    if (mockTranslatorsFor !== mockMessages) {
      mockTranslators.clear()
      mockTranslatorsFor = mockMessages
    }
    const cached = mockTranslators.get(namespace ?? '')
    if (cached) return cached
    const full = (key: string) => (namespace ? `${namespace}.${key}` : key)
    const t = (key: string, values: Record<string, unknown> = {}) => {
      const message = mockRead(full(key))
      if (typeof message !== 'string') return full(key)
      return message.replace(/\{(\w+)\}/g, (_: string, name: string) => String(values[name] ?? `{${name}}`))
    }
    t.has = (key: string) => typeof mockRead(full(key)) === 'string'
    t.rich = t
    mockTranslators.set(namespace ?? '', t)
    return t
  },
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/dashboard' }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
// stable objects, as the real hooks return
const mockAuth = { user: { id: 'u1', role: 'member' }, isLoading: false }
const mockPermissions = ['tasks.create']
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => mockAuth }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ teamId: 'team-1', isReady: true }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({
  usePermission: () => true,
  useOptionalPermission: () => true,
  useAllPermissions: () => mockPermissions,
  usePermissions: (map: Record<string, string>) => Object.fromEntries(Object.keys(map).map(key => [key, true])),
}))
jest.mock('@/core/components/entities/EntityChildManager', () => ({
  EntityChildManager: ({ childEntityConfig }: { childEntityConfig: { display: { title: string; description: string } } }) => (
    <section data-testid="child">{`${childEntityConfig.display.title}|${childEntityConfig.display.description}`}</section>
  ),
}))

import { taskEntityConfig } from '../../../../templates/projects/starter/entities/tasks/tasks.config'
import esTasks from '../../../../templates/projects/starter/entities/tasks/messages/es.json'
import deTasks from '../../../../templates/projects/starter/entities/tasks/messages/de.json'
import esCore from '@/core/messages/es/index'
import deCore from '@/core/messages/de/index'
import type { EntityConfig } from '@/core/lib/entities/types'
import type { SerializableEntityConfig } from '@/core/lib/entities/serialization'

const mockConfigs: EntityConfig[] = []
jest.mock('@/core/lib/entities/registry.client', () => ({
  getAllEntityConfigs: () => mockConfigs,
  getEnabledEntities: () => mockConfigs,
}))
jest.mock('@/core/lib/entities/queries', () => ({
  getEntity: (name: string) => mockConfigs.find(config => config.slug === name),
  getEntityMetadata: (name: string) => ({ name }),
  getEntityRegistry: () => Object.fromEntries(mockConfigs.map(config => [config.slug, { name: config.slug, config }])),
}))

import { DynamicNavigation } from '@/core/components/dashboard/navigation/DynamicNavigation'
import { EntityDetail } from '@/core/components/entities/EntityDetail'
import { useEnabledEntities } from '@/core/hooks/useEnabledEntities'
import { useQuickCreateEntities } from '@/core/hooks/useQuickCreateEntities'
import { useEntitySearch } from '@/core/hooks/useEntitySearch'
import { useSearch } from '@/core/hooks/useSearch'

const LOCALES = {
  es: { core: esCore, tasks: esTasks, plural: 'Tareas', singular: 'tarea', manage: 'Administra tus tareas' },
  de: { core: deCore, tasks: deTasks, plural: 'Aufgaben', singular: 'Aufgabe', manage: 'Verwalten Sie Ihre Aufgaben' },
} as const

const PARENT = {
  slug: 'projects',
  names: { singular: 'project', plural: 'Projects' },
  icon: () => null,
  fields: [],
} as unknown as EntityConfig

beforeEach(() => {
  mockConfigs.splice(0, mockConfigs.length, taskEntityConfig)
})

describe.each(['es', 'de'] as const)('the shell around the starter tasks in %s', (locale) => {
  const text = LOCALES[locale]
  beforeEach(() => {
    mockLocale = locale
    mockMessages = { ...(text.core as Messages), tasks: text.tasks as Messages }
  })

  test('the sidebar names the entity from the catalog', () => {
    render(<DynamicNavigation entities={[taskEntityConfig as unknown as SerializableEntityConfig]} />)
    expect(screen.getByText(text.plural)).toBeTruthy()
    expect(screen.queryByText('Tasks')).toBeNull()
  })

  test('the enabled-entities and quick-create hooks name the entity from the catalog', () => {
    expect(renderHook(() => useEnabledEntities()).result.current.entities.map(entity => entity.names.plural)).toEqual([text.plural])
    expect(renderHook(() => useQuickCreateEntities()).result.current.entities.map(entity => entity.names.singular)).toEqual([text.singular])
  })

  test.each([
    ['useEntitySearch', () => useEntitySearch()],
    ['useSearch', () => useSearch()],
  ] as const)('%s names the entity and its "manage" line from the catalogs', async (_name, hook) => {
    const { result } = renderHook(hook)
    // the query is the translated name: useSearch matches on title, description and category only
    act(() => result.current.setQuery(text.singular.toLowerCase()))
    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0))
    const entity = result.current.results.find(item => item.id === 'entity-tasks')!
    expect(entity.title).toBe(text.singular)
    expect(entity.description).toBe(text.manage)
  })

  test('a child section of a detail page names the child entity from its catalog', () => {
    render(<EntityDetail entityConfig={PARENT} data={{ id: 'p1', title: 'Web' }} childEntityNames={['tasks']} enableActions={false} />)
    const [title, description] = screen.getByTestId('child').textContent!.split('|')
    expect(title).toBe(text.plural)
    expect(description).toContain(locale === 'de' ? 'Aufgaben' : 'tareas')
  })
})
