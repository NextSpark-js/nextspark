/**
 * @jest-environment jsdom
 */

// #215: the builder's manual slug input is checked with the API's rule before saving, and a slug the API
// refuses is shown next to the input instead of a generic "Validation error".

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BuilderEditorView } from '@/core/components/dashboard/block-editor/builder-editor-view'

jest.mock('uuid', () => ({ v4: () => 'uuid' }))
const mockToastError = jest.fn()
jest.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => mockToastError(...args), success: jest.fn() } }))
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

const entityConfig = { name: 'pages', apiPath: 'pages', displayName: 'Pages', features: { enabled: true }, access: { basePath: '/' }, builder: { enabled: true } }
const fetchMock = jest.fn<typeof fetch>()

function renderBuilder(stored?: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <BuilderEditorView entitySlug="pages" entityConfig={entityConfig as never} mode={stored ? 'edit' : 'create'} id={stored ? 'p1' : undefined} />
    </QueryClientProvider>
  )
  if (!stored) fireEvent.change(screen.getByPlaceholderText('placeholders.title'), { target: { value: 'About' } })
  return {
    setSlug: (value: string) => fireEvent.change(document.getElementById('builder-slug') as HTMLInputElement, { target: { value } }),
    save: () => fireEvent.click(document.querySelector('[data-cy="publishButton"]') as HTMLElement),
  }
}

beforeEach(() => {
  mockToastError.mockClear()
  fetchMock.mockReset()
  global.fetch = fetchMock
})

describe('builder slug input', () => {
  test('a slug outside the format is reported next to the input and never sent', async () => {
    const builder = renderBuilder()
    builder.setSlug('Not A Slug!')
    builder.save()

    expect(await screen.findByRole('alert')).toHaveTextContent('lowercase letters, numbers, and hyphens')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('a reserved slug is reported with the reason', async () => {
    const builder = renderBuilder()
    builder.setSlug('dashboard')
    builder.save()

    expect(await screen.findByRole('alert')).toHaveTextContent('reserved')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('typing again clears the message', async () => {
    const builder = renderBuilder()
    builder.setSlug('dashboard')
    builder.save()
    await screen.findByRole('alert')
    builder.setSlug('dash')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('a valid slug is sent to the API', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 'p1' } }), { status: 201 }))
    const builder = renderBuilder()
    builder.setSlug('about-us')
    builder.save()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ slug: 'about-us' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('the slug field error of the API is shown next to the input', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: false, error: 'Slug "about" is taken', code: 'VALIDATION_ERROR',
      details: [{ code: 'custom', path: ['slug'], message: 'Slug "about" is taken' }],
    }), { status: 400 }))
    const builder = renderBuilder()
    builder.setSlug('about')
    builder.save()

    expect(await screen.findByRole('alert')).toHaveTextContent('Slug "about" is taken')
    expect(mockToastError).toHaveBeenCalledWith('Slug "about" is taken')
  })

  test.each(['home', 'a', 'about--us'])('edit mode: a page with the stored slug %j saves a change without sending or judging it', async slug => {
    fetchMock.mockImplementation(async (_url, init) => init?.method === 'PATCH'
      ? new Response(JSON.stringify({ success: true, data: { id: 'p1' } }), { status: 200 })
      : new Response(JSON.stringify({ success: true, data: { id: 'p1', title: 'Legacy', slug, status: 'draft', blocks: [] } }), { status: 200 }))
    renderBuilder({ slug })
    await waitFor(() => expect((document.getElementById('builder-slug') as HTMLInputElement).value).toBe(slug))
    fireEvent.change(screen.getByPlaceholderText('placeholders.title'), { target: { value: 'Legacy, edited' } })
    fireEvent.click(document.querySelector('[data-cy="publishButton"]') as HTMLElement)

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true))
    const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body))
    expect(body.title).toBe('Legacy, edited')
    expect(body).not.toHaveProperty('slug')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('edit mode: changing the stored slug to an invalid one is refused and the change is judged', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: 'p1', title: 'Legacy', slug: 'a', status: 'draft', blocks: [] } }), { status: 200 }))
    renderBuilder({ slug: 'a' })
    await waitFor(() => expect((document.getElementById('builder-slug') as HTMLInputElement).value).toBe('a'))
    fireEvent.change(document.getElementById('builder-slug') as HTMLInputElement, { target: { value: 'Bad Slug' } })
    fireEvent.click(document.querySelector('[data-cy="publishButton"]') as HTMLElement)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
  })
})
