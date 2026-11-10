/**
 * @jest-environment jsdom
 *
 * Entity names, field labels, placeholders, descriptions and select options read the entity's catalog of the active
 * locale (#421), and a key the catalog lacks keeps the config's text. The list, the form and the detail of the
 * starter's tasks, in Spanish and German, with the starter's own config and catalogs.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'

type Messages = Record<string, unknown>
let mockMessages: Messages = {}
let mockLocale = 'es'

function mockRead(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Messages)[part] : undefined), mockMessages)
}

// next-intl's translator over the active messages: `has`, and `{placeholders}` filled in
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useMessages: () => mockMessages,
  useTranslations: (namespace?: string) => {
    const full = (key: string) => (namespace ? `${namespace}.${key}` : key)
    const t = (key: string, values: Record<string, unknown> = {}) => {
      const message = mockRead(full(key))
      if (typeof message !== 'string') return full(key)
      return message.replace(/\{(\w+)\}/g, (_: string, name: string) => String(values[name] ?? `{${name}}`))
    }
    t.has = (key: string) => typeof mockRead(full(key)) === 'string'
    t.rich = t
    return t
  },
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/tasks' }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false }) }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ teamId: 'team-1', isReady: true }) }))
jest.mock('@/core/hooks/useUrlFilters', () => ({ useUrlFilters: () => ({ filters: {}, setFilter: jest.fn() }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({
  usePermission: () => true,
  usePermissions: (map: Record<string, string>) => Object.fromEntries(Object.keys(map).map(key => [key, true])),
}))
const mockListEntityData = jest.fn()
jest.mock('@/core/lib/api/entities', () => ({
  listEntityData: (...args: unknown[]) => mockListEntityData(...args),
  deleteEntityData: jest.fn(),
  duplicateEntityData: jest.fn(),
}))
jest.mock('@/core/components/entities/EntityBulkActions', () => ({ EntityBulkActions: () => null }))
jest.mock('@/core/components/shared/MultiSelectFilter', () => ({
  MultiSelectFilter: ({ label, options }: { label: string; options: Array<{ label: string }> }) => (
    <div data-testid="filter">{[label, ...options.map(option => option.label)].join('|')}</div>
  ),
}))
// The select's options, rendered as they are (the real one mounts them only while open)
jest.mock('@/core/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span data-testid="select-placeholder">{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div data-testid="select-option">{children}</div>,
}))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import { taskEntityConfig } from '../../../../templates/projects/starter/entities/tasks/tasks.config'
import esTasks from '../../../../templates/projects/starter/entities/tasks/messages/es.json'
import deTasks from '../../../../templates/projects/starter/entities/tasks/messages/de.json'
import esCore from '@/core/messages/es/index'
import deCore from '@/core/messages/de/index'
import type { EntityConfig } from '@/core/lib/entities/types'

const mockConfigs: EntityConfig[] = []
jest.mock('@/core/lib/entities/registry.client', () => ({
  getAllEntityConfigs: () => mockConfigs,
  getEnabledEntities: () => mockConfigs,
}))

import { EntityListWrapper } from '@/core/components/entities/wrappers/EntityListWrapper'
import { EntityForm } from '@/core/components/entities/EntityForm'
import { EntityDetail } from '@/core/components/entities/EntityDetail'
import { useEntityConfig, clearEntityConfigCache } from '@/core/hooks/useEntityConfig'

const RECORD = { id: 'task-1', title: 'Informe trimestral', status: 'in-progress', priority: 'urgent', createdAt: '2026-01-02T10:00:00Z', updatedAt: '2026-01-02T10:00:00Z' }

const LOCALES = {
  es: { core: esCore, tasks: esTasks, names: ['Tareas', 'tarea'], manage: 'Administra tus tareas', title: 'Título', titlePlaceholder: 'Ingresa el título de la tarea...', titleHelp: 'El título de la tarea', status: 'Estado', inProgress: 'En progreso', urgent: 'Urgente', todo: 'Por hacer', priority: 'Prioridad' },
  de: { core: deCore, tasks: deTasks, names: ['Aufgaben', 'Aufgabe'], manage: 'Verwalten Sie Ihre Aufgaben', title: 'Titel', titlePlaceholder: 'Aufgabentitel eingeben...', titleHelp: 'Der Titel der Aufgabe', status: 'Status', inProgress: 'In Bearbeitung', urgent: 'Dringend', todo: 'Zu erledigen', priority: 'Priorität' },
} as const

function useLocaleCatalog(locale: keyof typeof LOCALES, tasks: Messages = LOCALES[locale].tasks as Messages) {
  mockLocale = locale
  mockMessages = { ...(LOCALES[locale].core as Messages), tasks }
}

function TasksForm() {
  const { config } = useEntityConfig('tasks', { silent: true })
  return config ? <EntityForm entityConfig={config} mode="create" onSubmit={async () => {}} /> : null
}

function TasksDetail() {
  const { config } = useEntityConfig('tasks', { silent: true })
  return config ? <EntityDetail entityConfig={config} data={RECORD} enableActions={false} /> : null
}

beforeEach(() => {
  clearEntityConfigCache()
  mockConfigs.splice(0, mockConfigs.length, taskEntityConfig)
  mockListEntityData.mockReset().mockResolvedValue({ data: [RECORD] })
})

describe.each(['es', 'de'] as const)('the tasks of the starter in %s', (locale) => {
  const text = LOCALES[locale]

  test('the list names the entity, its columns, its filters and its select values from the catalog', async () => {
    useLocaleCatalog(locale)
    const { rerender } = render(<EntityListWrapper entityType="tasks" />)

    expect(await screen.findByRole('heading', { name: text.names[0] })).toBeTruthy()
    // the entity name inside a sentence: lower case in Spanish, capitalized in German
    expect(screen.getByText(text.manage)).toBeTruthy()
    // the list waits one render for the URL filters of the entity's filter schema (useUrlFilters re-parses in the app)
    rerender(<EntityListWrapper entityType="tasks" />)
    await waitFor(() => expect(screen.getByText(RECORD.title)).toBeTruthy())
    const headers = screen.getAllByRole('columnheader').map(cell => cell.textContent)
    expect(headers).toEqual(expect.arrayContaining([text.title, text.status, text.priority]))
    expect(screen.getByText(text.inProgress)).toBeTruthy()
    expect(screen.getByText(text.urgent)).toBeTruthy()
    expect(screen.getAllByTestId('filter')[0].textContent?.startsWith(`${text.status}|${text.todo}|${text.inProgress}`)).toBe(true)
    expect(document.body.textContent).not.toMatch(/\bTo Do\b|\bIn Progress\b|\bUrgent\b|\bPriority\b/)
  })

  test('the form labels, placeholders, help texts and select options come from the catalog', () => {
    useLocaleCatalog(locale)
    render(<TasksForm />)

    expect(screen.getByText(text.title, { selector: 'label' })).toBeTruthy()
    expect(screen.getByPlaceholderText(text.titlePlaceholder)).toBeTruthy()
    expect(screen.getByText(text.titleHelp)).toBeTruthy()
    const options = screen.getAllByTestId('select-option').map(option => option.textContent)
    expect(options).toEqual(expect.arrayContaining([text.todo, text.inProgress, text.urgent]))
    expect(options).not.toContain('To Do')
  })

  test('the detail shows the labels and the select values from the catalog, under the record title', () => {
    useLocaleCatalog(locale)
    render(<TasksDetail />)

    expect(screen.getByRole('heading', { name: RECORD.title })).toBeTruthy()
    const detail = screen.getByText(text.inProgress).closest('div')!.parentElement!
    expect(within(detail).getByText(text.status)).toBeTruthy()
    expect(screen.getByText(text.urgent)).toBeTruthy()
  })

  test('a key the catalog lacks shows the text of the config, without errors', () => {
    const tasks = JSON.parse(JSON.stringify(text.tasks))
    delete tasks.fields.priority.label
    delete tasks.fields.status.options.todo
    useLocaleCatalog(locale, tasks)
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})

    render(<TasksForm />)

    expect(screen.getByText('Priority', { selector: 'label' })).toBeTruthy()
    const options = screen.getAllByTestId('select-option').map(option => option.textContent)
    expect(options).toContain('To Do')
    expect(options).toContain(text.inProgress)
    expect(document.body.textContent).not.toMatch(/tasks\.fields\./)
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })
})

test('an entity without a catalog keeps its own config object and texts', () => {
  useLocaleCatalog('es', undefined as unknown as Messages)
  delete mockMessages.tasks
  let seen: EntityConfig | null = null
  function Probe() {
    seen = useEntityConfig('tasks', { silent: true }).config
    return null
  }
  render(<Probe />)
  expect(seen).toBe(taskEntityConfig)
})
