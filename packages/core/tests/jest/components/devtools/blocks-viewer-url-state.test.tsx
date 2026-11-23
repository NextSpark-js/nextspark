/**
 * @jest-environment jsdom
 *
 * A devtools screen reads and writes the URL, and Back goes to the list with its query, also after an outside reset (#519).
 */
import React from 'react'
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react'

const mockReplace = jest.fn()
let mockSearch = ''
let mockPath = '/devtools/blocks'
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => mockPath,
  useSearchParams: () => new URLSearchParams(mockSearch),
  useParams: () => ({ teamId: 't1' }),
}))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => Object.assign((key: string) => key, { has: () => false }) }))
jest.mock('@/core/hooks/useLocalizedText', () => ({ useLocalizedText: () => (v: string) => v }))
jest.mock('@nextsparkjs/registries/testing-registry', () => ({ TAGS_REGISTRY: { blocks: {} } }))
jest.mock('@nextsparkjs/registries/block-registry.client', () => {
  const block = (slug: string, category: string) => ({ slug, name: slug, description: 'd', category, scope: ['pages'], fieldDefinitions: [], examples: [] })
  return { BLOCK_REGISTRY: { alpha: block('alpha', 'hero'), beta: block('beta', 'content') } }
})
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))

import { BlocksViewer } from '@/core/components/devtools/BlocksViewer'
import { useAreaUrlState, useListBackHref } from '@/core/hooks/useAreaUrlState'

beforeEach(() => { jest.useFakeTimers(); mockReplace.mockClear(); mockSearch = ''; mockPath = '/devtools/blocks'; sessionStorage.clear() })
afterEach(() => jest.useRealTimers())

const names = () => screen.queryAllByText(/^(alpha|beta)$/).map(e => e.textContent)

it('BlocksViewer: ?category=hero shows only hero; unknown category is all', () => {
  mockSearch = 'category=hero'
  const { unmount } = render(<BlocksViewer />)
  expect(names()).toEqual(['alpha'])
  unmount()
  mockSearch = 'category=bogus&coverage=nope'
  render(<BlocksViewer />)
  expect(names().sort()).toEqual(['alpha', 'beta'])
})

it('BlocksViewer: clicking a category writes it with replace after the debounce', () => {
  render(<BlocksViewer />)
  fireEvent.click(screen.getByText('content', { selector: 'button' }))
  expect(names()).toEqual(['beta'])
  expect(mockReplace).not.toHaveBeenCalled()
  act(() => { jest.advanceTimersByTime(300) })
  expect(mockReplace).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledWith('/devtools/blocks?category=content', { scroll: false })
})

const SPEC = { q: { default: '' } } as const

it('Back: the detail links to the list with the query the list last wrote', () => {
  const { result } = renderHook(() => useAreaUrlState(SPEC))
  act(() => result.current[1]({ q: 'hero' }))
  act(() => { jest.advanceTimersByTime(300) })
  const { result: back } = renderHook(() => useListBackHref('/devtools/blocks'))
  expect(back.current).toBe('/devtools/blocks?q=hero')
})

it('Back after an outside reset (sidebar link to the bare list) is the bare list', () => {
  mockSearch = 'q=hero'
  const { rerender } = renderHook(() => useAreaUrlState(SPEC))
  mockSearch = ''
  rerender()
  const { result: back } = renderHook(() => useListBackHref('/devtools/blocks'))
  expect(back.current).toBe('/devtools/blocks')
})
