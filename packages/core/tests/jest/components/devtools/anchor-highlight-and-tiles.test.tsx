/**
 * @jest-environment jsdom
 *
 * #529: the card a link anchors to is highlighted for ~2 s, and the coverage tiles lead to the pages that list
 * what they count.
 */
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { render, screen, act } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => true }),
}))

import { TestCoverageDashboard } from '@/core/components/devtools/TestCoverageDashboard'
import { useScrollToHash, HIGHLIGHT_MS } from '@/core/components/devtools/use-scroll-to-hash'

function Cards() {
  useScrollToHash()
  return (<><div id="a" data-testid="a" /><div id="b" data-testid="b" /></>)
}

describe('useScrollToHash highlight', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    Element.prototype.scrollIntoView = jest.fn() as unknown as typeof Element.prototype.scrollIntoView
  })
  afterEach(() => jest.useRealTimers())

  test('highlights the anchored card, then removes the highlight after ~2 s', () => {
    window.history.replaceState({}, '', '/devtools/x#b')
    render(<Cards />)
    expect(screen.getByTestId('b').classList.contains('ring-2')).toBe(true)
    expect(screen.getByTestId('a').classList.contains('ring-2')).toBe(false)
    act(() => { jest.advanceTimersByTime(HIGHLIGHT_MS + 1) })
    expect(screen.getByTestId('b').classList.contains('ring-2')).toBe(false)
  })
})

describe('TestCoverageDashboard tiles', () => {
  test('each tile and category links to the page that lists it', async () => {
    jest.useRealTimers()
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          tags: {}, meta: {}, features: [], flows: [],
          summary: {
            totalTags: 5, testFiles: 3, byCategory: { layers: 2 },
            features: { total: 2, withTests: 2, withoutTests: 0 }, flows: { total: 1, withTests: 1, withoutTests: 0 },
          },
        },
      }),
    })) as unknown as typeof fetch
    const { container } = render(<TestCoverageDashboard />)
    await screen.findByText('features')
    const href = (cy: string) => container.querySelector(`[data-cy="${cy}"]`)?.closest('a')?.getAttribute('href')
    expect(href('devtools-tests-dashboard-stat-features')).toBe('/devtools/features')
    expect(href('devtools-tests-dashboard-stat-flows')).toBe('/devtools/flows')
    expect(href('devtools-tests-dashboard-stat-tags')).toBe('/devtools/tags')
    expect(href('devtools-tests-dashboard-category-layers')).toBe('/devtools/tags#layers')
  })

  test('selector tags are counted apart from "other", so each tile matches its destination', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          meta: {}, features: [], flows: [],
          tags: { other: { a: { tag: '@smoke2' }, b: { tag: '@SEL_x' }, c: { tag: '@SEL_y' } } },
          summary: {
            totalTags: 3, testFiles: 1, byCategory: { other: 3 },
            features: { total: 0, withTests: 0, withoutTests: 0 }, flows: { total: 0, withTests: 0, withoutTests: 0 },
          },
        },
      }),
    })) as unknown as typeof fetch
    const { container } = render(<TestCoverageDashboard />)
    await screen.findByText('features')
    const n = (c: string) => container.querySelector(`[data-cy="devtools-tests-dashboard-category-${c}"] p`)?.textContent
    expect(n('other')).toBe('1')
    expect(n('selectors')).toBe('2')
  })
})
