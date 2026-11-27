/**
 * @jest-environment jsdom
 */

// #580: the settings panel and the sidebar list the categories of a post at the API route of its taxonomy type
// (`post_category` -> /api/v1/post-categories), not at the type with an `s` appended (post-categorys, a 404).

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigPanel } from '@/core/components/dashboard/block-editor/config-panel'
import { EntityFieldsSidebar } from '@/core/components/dashboard/block-editor/entity-fields-sidebar'

const mockFetch = jest.fn<(url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>>()
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/test', () => ({ sel: (path: string) => path.split('.').pop() }))
jest.mock('@/core/lib/api/entities', () => ({ fetchWithTeam: (url: string) => mockFetch(url) }))

const config = (type: string) => ({
  builder: { sidebarFields: [] },
  taxonomies: { enabled: true, types: [{ type, field: 'categories', multiple: true }] },
})

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const panel = (type: string) => (
  <ConfigPanel
    entityConfig={config(type) as never}
    entityFields={{}}
    onEntityFieldChange={jest.fn()}
    pageSettings={{ seo: {}, customFields: [] } as never}
    onPageSettingsChange={jest.fn()}
  />
)
const sidebar = (type: string) => (
  <EntityFieldsSidebar entityConfig={config(type) as never} fields={{}} onChange={jest.fn()} />
)

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'c1', name: 'News', slug: 'news' }] }) })
})

describe.each([
  ['ConfigPanel', panel],
  ['EntityFieldsSidebar', sidebar],
])('%s', (_name, element) => {
  test('requests post_category at /api/v1/post-categories and lists its items', async () => {
    renderWith(element('post_category'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/v1/post-categories'))
    expect(await screen.findByText('News')).toBeInTheDocument()
  })

  test('pluralises a type that does not end in y with an s', async () => {
    renderWith(element('tag'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/v1/tags'))
  })
})
