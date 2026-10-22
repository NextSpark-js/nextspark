/**
 * @jest-environment jsdom
 */

// #316: onBeforeSave and onBeforePublish run inside the editor's three save paths (Save draft, Update, Publish),
// can veto with a message or return the payload to send, and never leave the editor stuck when they fail.

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { THEME_REGISTRY } from '@nextsparkjs/registries/theme-registry.client'
import { BuilderEditorView } from '@/core/components/dashboard/block-editor/builder-editor-view'
import type { BuilderHook, EditorHooks } from '@/core/components/dashboard/block-editor/editor-extensions'

jest.mock('uuid', () => ({ v4: () => 'uuid' }))
const mockToastError = jest.fn()
jest.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => mockToastError(...args), success: jest.fn() } }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string, values?: Record<string, string>) => (values ? `${key}:${values.message}` : key) }))
jest.mock('@/core/contexts/sidebar-context', () => ({ useSidebar: () => ({ isCollapsed: false }) }))
jest.mock('@/core/lib/services/block.service', () => ({ BlockService: { getForScope: () => [] } }))
jest.mock('@/core/lib/test', () => ({ sel: (path: string) => path.split('.').pop() }))
jest.mock('@/core/components/dashboard/block-editor/block-picker', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/block-canvas', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/block-preview-canvas', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/block-settings-panel', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/batch-action-bar', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/page-settings-panel', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/entity-fields-sidebar', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/config-panel', () => new Proxy({}, { get: () => () => null }))

const entityConfig = { name: 'pages', apiPath: 'pages', displayName: 'Pages', features: { enabled: true }, access: { basePath: '/' }, builder: { enabled: true } }
const fetchMock = jest.fn<typeof fetch>()
const themeComponents = () => THEME_REGISTRY.default.components as Record<string, unknown>

const ok = () => new Response(JSON.stringify({ success: true, data: { id: 'p1' } }), { status: 200 })

/** Create mode shows Save draft and Publish; edit mode of a published page shows Save draft and Update. */
function renderBuilder(hooks?: EditorHooks, stored?: { status: string }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  if (stored) {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === 'PATCH' ? ok() : new Response(JSON.stringify({ success: true, data: { id: 'p1', title: 'About', slug: 'about', status: stored.status, blocks: [] } }), { status: 200 })
    )
  } else {
    fetchMock.mockImplementation(async () => ok())
  }
  render(
    <QueryClientProvider client={client}>
      <BuilderEditorView entitySlug="pages" entityConfig={entityConfig as never} mode={stored ? 'edit' : 'create'} id={stored ? 'p1' : undefined} hooks={hooks} />
    </QueryClientProvider>
  )
  return {
    ready: async () => {
      if (stored) await waitFor(() => expect((screen.getByPlaceholderText('placeholders.title') as HTMLInputElement).value).toBe('About'))
      else fireEvent.change(screen.getByPlaceholderText('placeholders.title'), { target: { value: 'About' } })
    },
    draft: () => fireEvent.click(document.querySelector('[data-cy="saveButton"]') as HTMLElement),
    publish: () => fireEvent.click(document.querySelector('[data-cy="publishButton"]') as HTMLElement),
  }
}

const writes = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST' || init?.method === 'PATCH')
const sent = (i = 0) => JSON.parse(String(writes()[i][1]?.body))

beforeEach(() => {
  mockToastError.mockClear()
  fetchMock.mockReset()
  global.fetch = fetchMock
})
afterEach(() => { delete themeComponents().builder })

describe('before-save and before-publish hooks', () => {
  test('a veto stops the request and shows its message', async () => {
    const onBeforePublish = jest.fn<BuilderHook>(async () => ({ veto: 'Add a hero block first' }))
    const b = renderBuilder({ onBeforePublish })
    await b.ready()
    b.publish()

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Add a hero block first'))
    expect(writes()).toHaveLength(0)
  })

  test('a hook that resolves lets the save proceed, with the payload and the action', async () => {
    const onBeforeSave = jest.fn<BuilderHook>(async () => undefined)
    const b = renderBuilder({ onBeforeSave })
    await b.ready()
    b.publish()

    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(onBeforeSave).toHaveBeenCalledTimes(1)
    expect(onBeforeSave.mock.calls[0][0]).toMatchObject({ title: 'About', status: 'published', blocks: [], settings: { seo: {}, customFields: [] } })
    expect(onBeforeSave.mock.calls[0][1]).toEqual({ action: 'publish', mode: 'create', entitySlug: 'pages', id: undefined })
    expect(mockToastError).not.toHaveBeenCalled()
  })

  test('Save draft: onBeforeSave runs and onBeforePublish does not', async () => {
    const onBeforeSave = jest.fn<BuilderHook>()
    const onBeforePublish = jest.fn<BuilderHook>()
    const b = renderBuilder({ onBeforeSave, onBeforePublish })
    await b.ready()
    b.draft()

    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(onBeforeSave.mock.calls[0][1]).toMatchObject({ action: 'draft' })
    expect(onBeforePublish).not.toHaveBeenCalled()
    expect(sent().status).toBe('draft')
  })

  test('Publish: onBeforeSave runs, then onBeforePublish', async () => {
    const order: string[] = []
    const b = renderBuilder({
      onBeforeSave: async () => { order.push('save') },
      onBeforePublish: async () => { order.push('publish') },
    })
    await b.ready()
    b.publish()

    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(order).toEqual(['save', 'publish'])
  })

  test('Update of a published page: both run, with the update action', async () => {
    const onBeforeSave = jest.fn<BuilderHook>()
    const onBeforePublish = jest.fn<BuilderHook>()
    const b = renderBuilder({ onBeforeSave, onBeforePublish }, { status: 'published' })
    await b.ready()
    b.publish()

    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(onBeforeSave.mock.calls[0][1]).toMatchObject({ action: 'update', mode: 'edit', id: 'p1' })
    expect(onBeforePublish).toHaveBeenCalledTimes(1)
  })

  test('a veto of onBeforeSave also stops a draft, and onBeforePublish is not asked', async () => {
    const onBeforePublish = jest.fn<BuilderHook>()
    const b = renderBuilder({ onBeforeSave: () => ({ veto: 'Title too short' }), onBeforePublish })
    await b.ready()
    b.draft()

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Title too short'))
    expect(writes()).toHaveLength(0)
    expect(onBeforePublish).not.toHaveBeenCalled()
  })

  test('an empty veto still says that the page was not saved', async () => {
    const b = renderBuilder({ onBeforeSave: () => ({ veto: '' }) })
    await b.ready()
    b.draft()
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('messages.saveBlocked'))
    expect(writes()).toHaveLength(0)
  })

  test('a hook can return the payload to send', async () => {
    const b = renderBuilder({
      onBeforeSave: (payload) => ({ data: { ...payload, title: 'About (checked)' } }),
      onBeforePublish: (payload) => ({ data: { ...payload, excerpt: `seen ${payload.title}` } }),
    })
    await b.ready()
    b.publish()

    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(sent()).toMatchObject({ title: 'About (checked)', excerpt: 'seen About (checked)', status: 'published' })
  })

  test('data that is not an object is reported and nothing is sent', async () => {
    const b = renderBuilder({ onBeforeSave: () => ({ data: null as never }) })
    await b.ready()
    b.draft()
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('messages.hookFailed:onBeforeSave returned data that is not an object'))
    expect(writes()).toHaveLength(0)
  })

  test.each([
    ['throws', () => { throw new Error('boom') }],
    ['rejects', () => Promise.reject(new Error('boom'))],
  ])('a hook that %s is reported as an error and the editor can save again', async (_name, failing) => {
    let fail = true
    const b = renderBuilder({ onBeforeSave: () => { if (fail) return failing() } })
    await b.ready()
    b.publish()

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('messages.hookFailed:boom'))
    expect(writes()).toHaveLength(0)
    // not stuck: the buttons are enabled again and a second try saves
    await waitFor(() => expect(document.querySelector('[data-cy="publishButton"]')).not.toBeDisabled())
    fail = false
    b.publish()
    await waitFor(() => expect(writes()).toHaveLength(1))
  })

  test('while a hook is pending the buttons are disabled and a second click does not run it again', async () => {
    let release!: () => void
    const onBeforeSave = jest.fn<BuilderHook>(() => new Promise<void>(resolve => { release = resolve }))
    const b = renderBuilder({ onBeforeSave })
    await b.ready()
    b.publish()
    await waitFor(() => expect(document.querySelector('[data-cy="publishButton"]')).toBeDisabled())
    b.publish()
    expect(onBeforeSave).toHaveBeenCalledTimes(1)

    release()
    await waitFor(() => expect(writes()).toHaveLength(1))
    await waitFor(() => expect(document.querySelector('[data-cy="publishButton"]')).not.toBeDisabled())
  })

  test('the hooks of components.builder in the theme configuration apply, and the prop wins', async () => {
    const themeSave = jest.fn<BuilderHook>(() => ({ veto: 'from theme' }))
    themeComponents().builder = { onBeforeSave: themeSave }
    const first = renderBuilder()
    await first.ready()
    first.draft()
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('from theme'))
    expect(writes()).toHaveLength(0)
    document.body.innerHTML = ''

    const propSave = jest.fn<BuilderHook>(() => undefined)
    const second = renderBuilder({ onBeforeSave: propSave })
    await second.ready()
    second.draft()
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(propSave).toHaveBeenCalledTimes(1)
    expect(themeSave).toHaveBeenCalledTimes(1)
  })

  test('without hooks the request goes out as before', async () => {
    const b = renderBuilder()
    await b.ready()
    b.publish()
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(sent()).toMatchObject({ title: 'About', status: 'published' })
  })
})
