/**
 * @jest-environment jsdom
 */

// #583: opening a stored entity fills the form with its taxonomy terms (as ids), so the category list shows them,
// a change adds to them, and a save that leaves them alone does not send them.

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BuilderEditorView } from '@/core/components/dashboard/block-editor/builder-editor-view'

jest.mock('uuid', () => ({ v4: () => 'uuid' }))
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/contexts/sidebar-context', () => ({ useSidebar: () => ({ isCollapsed: false }) }))
jest.mock('@/core/lib/services/block.service', () => ({ BlockService: { getForScope: () => [] } }))
jest.mock('@/core/lib/test', () => ({ sel: (path: string) => path.split('.').pop() }))
// The panels around the header are not under test (and pull in the media library and the auth client)
jest.mock('@/core/components/dashboard/block-editor/block-picker', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/block-canvas', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/block-preview-canvas', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/block-settings-panel', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/batch-action-bar', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/page-settings-panel', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/entity-fields-sidebar', () => new Proxy({}, { get: () => () => null }))
jest.mock('@/core/components/dashboard/block-editor/config-panel', () => new Proxy({}, { get: () => () => null }))

const entityConfig = {
  name: 'posts', apiPath: 'posts', displayName: 'Posts', features: { enabled: true }, access: { basePath: '/posts' },
  builder: { enabled: true, sidebarFields: ['excerpt'] },
  taxonomies: { enabled: true, types: [{ type: 'post_category', field: 'categories', multiple: true }] },
}
const fetchMock = jest.fn<typeof fetch>()
const terms = [{ id: 'c1', name: 'One', slug: 'one' }, { id: 'c2', name: 'Two', slug: 'two' }]

// Stands for the panels that show the form's fields: it lists what the form holds and adds one more category
const Panel = ({ entityFields, onEntityFieldChange }: { entityFields: Record<string, unknown>; onEntityFieldChange: (f: string, v: unknown) => void }) => (
  <div>
    <output data-testid="categories">{JSON.stringify(entityFields.categories ?? null)}</output>
    <button data-testid="add" onClick={() => onEntityFieldChange('categories', [...((entityFields.categories as string[]) ?? []), 'c3'])} />
  </div>
)

function renderEdit() {
  fetchMock.mockImplementation(async (_url, init) => init?.method === 'PATCH'
    ? new Response(JSON.stringify({ success: true, data: { id: 'p1' } }), { status: 200 })
    : new Response(JSON.stringify({ success: true, data: { id: 'p1', title: 'Old', slug: 'old', status: 'draft', blocks: [], excerpt: 'x', categories: terms } }), { status: 200 }))
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <BuilderEditorView entitySlug="posts" entityConfig={entityConfig as never} mode="edit" id="p1" components={{ ConfigPanel: Panel } as never} />
    </QueryClientProvider>
  )
}
const patched = () => fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')
const patchBody = () => JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body))
const save = () => fireEvent.click(document.querySelector('[data-cy="publishButton"]') as HTMLElement)

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock
})

describe('builder edit mode: taxonomy terms', () => {
  test('the form holds the ids of the stored terms', async () => {
    renderEdit()
    await waitFor(() => expect(screen.getByTestId('categories')).toHaveTextContent('["c1","c2"]'))
  })

  test('adding a category and saving sends all of them', async () => {
    renderEdit()
    await waitFor(() => expect(screen.getByTestId('categories')).toHaveTextContent('["c1","c2"]'))
    fireEvent.click(screen.getByTestId('add'))
    save()
    await waitFor(() => expect(patched()).toBe(true))
    expect(patchBody().categories).toEqual(['c1', 'c2', 'c3'])
  })

  test('a save that changes only the title does not send the categories', async () => {
    renderEdit()
    await waitFor(() => expect(screen.getByTestId('categories')).toHaveTextContent('["c1","c2"]'))
    fireEvent.change(screen.getByPlaceholderText('placeholders.title'), { target: { value: 'New' } })
    save()
    await waitFor(() => expect(patched()).toBe(true))
    expect(patchBody()).toMatchObject({ title: 'New', excerpt: 'x' })
    expect(patchBody()).not.toHaveProperty('categories')
  })
})
