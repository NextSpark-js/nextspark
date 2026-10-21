/**
 * @jest-environment jsdom
 */

// #327: a save that happens inside the settings form's 500 ms debounce window still carries the last edit.

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BuilderEditorView } from '@/core/components/dashboard/block-editor/builder-editor-view'
import { DynamicForm } from '@/core/components/dashboard/block-editor/dynamic-form'
import type { FieldDefinition } from '@/core/types/blocks'

jest.mock('uuid', () => ({ v4: () => 'uuid' }))
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/contexts/sidebar-context', () => ({ useSidebar: () => ({ isCollapsed: false }) }))
jest.mock('@/core/lib/services/block.service', () => ({ BlockService: { getForScope: () => [] } }))
jest.mock('@/core/lib/test', () => ({ sel: (path: string) => path.split('.').pop() }))
jest.mock('@/core/components/dashboard/block-editor/block-picker', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/block-canvas', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/batch-action-bar', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/page-settings-panel', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/entity-fields-sidebar', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/config-panel', () => new Proxy({}, { get: () => () => null }))
// DynamicForm's widgets the text field does not use
jest.mock('@/core/components/ui/image-upload', () => ({ ImageUpload: () => null }))
jest.mock('@/core/components/ui/rich-text-editor', () => ({ RichTextEditor: () => null }))
jest.mock('@/core/components/media/MediaLibrary', () => ({ MediaLibrary: () => null }))
jest.mock('@/core/components/dashboard/block-editor/array-field', () => ({ ArrayField: () => null }))
jest.mock('@/core/lib/api/entities', () => ({ fetchWithTeam: jest.fn() }))
// A button to select the stored block, and the real form inside a stand-in for the settings panel
jest.mock('@/core/components/dashboard/block-editor/block-preview-canvas', () => ({
  BlockPreviewCanvas: ({ blocks, onSelectBlock }: { blocks: { id: string }[]; onSelectBlock: (id: string) => void }) => (
    <button data-testid="select" onClick={() => onSelectBlock(blocks[0].id)} />
  ),
}))
jest.mock('@/core/components/dashboard/block-editor/block-settings-panel', () => ({
  BlockSettingsPanel: ({ block, onUpdateProps, flushRef }: { block?: { props: Record<string, unknown> }; onUpdateProps: (p: Record<string, unknown>) => void; flushRef?: { current: (() => void) | null } }) =>
    block ? <DynamicForm fieldDefinitions={[{ name: 'title', type: 'text', label: 'Title' }] as FieldDefinition[]} values={block.props} onChange={onUpdateProps} flushRef={flushRef} /> : null,
}))

const entityConfig = { name: 'pages', apiPath: 'pages', displayName: 'Pages', features: { enabled: true }, access: { basePath: '/' }, builder: { enabled: true } }
const stored = { id: 'p1', title: 'About', slug: 'about', status: 'draft', blocks: [{ id: 'b1', blockSlug: 'hero', props: { title: 'a' } }] }
let current = stored
const fetchMock = jest.fn<typeof fetch>()
const patchBodies = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH').map(([, init]) => JSON.parse(String(init?.body)))

async function openBlock(entity = stored) {
  current = entity
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <BuilderEditorView entitySlug="pages" entityConfig={entityConfig as never} mode="edit" id="p1" />
    </QueryClientProvider>
  )
  await waitFor(() => expect(screen.getByTestId('select')).toBeInTheDocument())
  fireEvent.click(screen.getByTestId('select'))
  await waitFor(() => expect(document.querySelector('[data-cy="field"]')).not.toBeNull())
  const input = document.querySelector('[data-cy="field"]')
  act(() => { jest.advanceTimersByTime(20) }) // lets the form's mount-time sync settle
  return input as HTMLInputElement
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (_url, init) => init?.method === 'PATCH'
    ? new Response(JSON.stringify({ success: true, data: { id: 'p1' } }), { status: 200 })
    : new Response(JSON.stringify({ success: true, data: current }), { status: 200 }))
  global.fetch = fetchMock
})
afterEach(() => jest.useRealTimers())

describe('builder save inside the settings debounce window', () => {
  test.each([
    ['saveButton', 'draft'],
    ['publishButton', 'published'],
  ])('%s saves the edit made less than 500 ms ago', async (button, status) => {
    const input = await openBlock()
    fireEvent.change(input, { target: { value: 'edited' } })
    act(() => { jest.advanceTimersByTime(100) })
    fireEvent.click(document.querySelector(`[data-cy="${button}"]`) as HTMLElement)

    await waitFor(() => expect(patchBodies()).toHaveLength(1))
    expect(patchBodies()[0].blocks[0].props).toEqual({ title: 'edited' })
    expect(patchBodies()[0].status).toBe(status)
  })

  test('update of a published page saves the edit made less than 500 ms ago', async () => {
    const input = await openBlock({ ...stored, status: 'published' })
    fireEvent.change(input, { target: { value: 'edited' } })
    fireEvent.click(document.querySelector('[data-cy="publishButton"]') as HTMLElement)

    await waitFor(() => expect(patchBodies()).toHaveLength(1))
    expect(patchBodies()[0].blocks[0].props).toEqual({ title: 'edited' })
    expect(patchBodies()[0].status).toBe('published')
  })

  test('a save without edits sends the stored blocks unchanged', async () => {
    await openBlock()
    fireEvent.click(document.querySelector('[data-cy="publishButton"]') as HTMLElement)

    await waitFor(() => expect(patchBodies()).toHaveLength(1))
    expect(patchBodies()[0].blocks).toEqual(stored.blocks)
  })
})

// #354: the refetch after a save must not overwrite what was typed while the save was running.
describe('builder refetch after a save', () => {
  const gets = () => fetchMock.mock.calls.filter(([, init]) => !init?.method || init.method === 'GET').length

  test('keeps an edit made while the save request was in flight', async () => {
    const input = await openBlock()
    fireEvent.change(input, { target: { value: 'first' } })
    let finishSave!: () => void
    fetchMock.mockImplementation(async (_url, init) => {
      if (init?.method !== 'PATCH') return new Response(JSON.stringify({ success: true, data: current }), { status: 200 })
      await new Promise<void>((resolve) => { finishSave = resolve })
      current = { ...stored, blocks: [{ id: 'b1', blockSlug: 'hero', props: { title: 'first' } }] }
      return new Response(JSON.stringify({ success: true, data: { id: 'p1' } }), { status: 200 })
    })
    fireEvent.click(document.querySelector('[data-cy="saveButton"]') as HTMLElement)
    await waitFor(() => expect(patchBodies()).toHaveLength(1))

    // typed after the request went out, and sent to the parent by the form's debounce
    fireEvent.change(input, { target: { value: 'newer' } })
    act(() => { jest.advanceTimersByTime(600) })
    const getsBefore = gets()
    await act(async () => { finishSave() })

    // the entity was fetched again after the save, and the editor still holds the newer text
    await waitFor(() => expect(gets()).toBeGreaterThan(getsBefore))
    expect((document.querySelector('[data-cy="field"]') as HTMLInputElement).value).toBe('newer')
  })

  test('a stale cached copy is replaced by the fresh fetch on mount', async () => {
    current = { ...stored, blocks: [{ id: 'b1', blockSlug: 'hero', props: { title: 'fresh' } }] }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['pages', 'p1'], { success: true, data: stored }) // props.title is 'a'
    render(
      <QueryClientProvider client={client}>
        <BuilderEditorView entitySlug="pages" entityConfig={entityConfig as never} mode="edit" id="p1" />
      </QueryClientProvider>
    )
    await waitFor(() => expect(screen.getByTestId('select')).toBeInTheDocument())
    await waitFor(() => {
      fireEvent.click(screen.getByTestId('select'))
      expect((document.querySelector('[data-cy="field"]') as HTMLInputElement).value).toBe('fresh')
    })
  })

  test('the copy after a save replaces the form when nothing was typed meanwhile', async () => {
    const input = await openBlock()
    fireEvent.change(input, { target: { value: 'first' } })
    act(() => { jest.advanceTimersByTime(600) })
    // the server normalises what it stores
    fetchMock.mockImplementation(async (_url, init) => {
      if (init?.method !== 'PATCH') return new Response(JSON.stringify({ success: true, data: current }), { status: 200 })
      current = { ...stored, blocks: [{ id: 'b1', blockSlug: 'hero', props: { title: 'FIRST' } }] }
      return new Response(JSON.stringify({ success: true, data: { id: 'p1' } }), { status: 200 })
    })
    fireEvent.click(document.querySelector('[data-cy="saveButton"]') as HTMLElement)
    await waitFor(() => expect(patchBodies()).toHaveLength(1))
    await waitFor(() => {
      fireEvent.click(screen.getByTestId('select'))
      expect((document.querySelector('[data-cy="field"]') as HTMLInputElement).value).toBe('FIRST')
    })
  })

  test('a failed save leaves the unsaved edit in place when a later refetch brings other data', async () => {
    current = stored
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <BuilderEditorView entitySlug="pages" entityConfig={entityConfig as never} mode="edit" id="p1" />
      </QueryClientProvider>
    )
    await waitFor(() => expect(screen.getByTestId('select')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('select'))
    await waitFor(() => expect(document.querySelector('[data-cy="field"]')).not.toBeNull())
    act(() => { jest.advanceTimersByTime(20) })
    fireEvent.change(document.querySelector('[data-cy="field"]') as HTMLInputElement, { target: { value: 'unsaved' } })
    act(() => { jest.advanceTimersByTime(600) })

    fetchMock.mockImplementation(async (_url, init) => init?.method === 'PATCH'
      ? new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
      : new Response(JSON.stringify({ success: true, data: current }), { status: 200 }))
    fireEvent.click(document.querySelector('[data-cy="saveButton"]') as HTMLElement)
    await waitFor(() => expect(patchBodies()).toHaveLength(1))
    await waitFor(() => expect(client.isMutating()).toBe(0))

    // someone else changed the page; the refetch must differ from the cached copy to reach the form
    current = { ...stored, title: 'Other title', blocks: [{ id: 'b1', blockSlug: 'hero', props: { title: 'theirs' } }] }
    const getsBefore = fetchMock.mock.calls.filter(([, init]) => !init?.method || init.method === 'GET').length
    await act(async () => { await client.invalidateQueries({ queryKey: ['pages', 'p1'] }) })
    expect(fetchMock.mock.calls.filter(([, init]) => !init?.method || init.method === 'GET').length).toBeGreaterThan(getsBefore)

    await act(async () => { jest.advanceTimersByTime(700) })
    expect((document.querySelector('[data-cy="field"]') as HTMLInputElement).value).toBe('unsaved')
  })

  test('opening a different entity still replaces the blocks', async () => {
    current = stored
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const view = (id: string) => (
      <QueryClientProvider client={client}>
        <BuilderEditorView entitySlug="pages" entityConfig={entityConfig as never} mode="edit" id={id} />
      </QueryClientProvider>
    )
    const { rerender } = render(view('p1'))
    await waitFor(() => expect(screen.getByTestId('select')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('select'))
    await waitFor(() => expect((document.querySelector('[data-cy="field"]') as HTMLInputElement).value).toBe('a'))

    current = { ...stored, id: 'p2', blocks: [{ id: 'b2', blockSlug: 'hero', props: { title: 'other' } }] }
    rerender(view('p2'))
    // the block list is the other entity's: selecting its first block shows its text
    await waitFor(() => {
      fireEvent.click(screen.getByTestId('select'))
      expect((document.querySelector('[data-cy="field"]') as HTMLInputElement).value).toBe('other')
    })
  })
})
