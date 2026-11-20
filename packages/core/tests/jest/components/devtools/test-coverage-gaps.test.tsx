/**
 * @jest-environment jsdom
 *
 * The Test Coverage Dashboard lists the features and flows without tests, with a link to each, and says that
 * everything has tests only when the cards agree (#498).
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
}))

import { TestCoverageDashboard } from '@/core/components/devtools/TestCoverageDashboard'

const entry = (key: string, hasTests: boolean, extra = {}) => ({ key, name: `Name ${key}`, testing: { hasTests, testCount: hasTests ? 1 : 0 }, ...extra })

function respondWith(data: Record<string, unknown>) {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: { tags: {}, meta: {}, summary: { totalTags: 1, testFiles: 1, byCategory: {} }, ...data },
    }),
  })) as unknown as typeof fetch
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('TestCoverageDashboard gaps (#498)', () => {
  test('lists each feature and flow without tests, linked to its card', async () => {
    respondWith({
      summary: { totalTags: 1, testFiles: 1, byCategory: {}, features: { total: 2, withTests: 1, withoutTests: 1 }, flows: { total: 2, withTests: 0, withoutTests: 2 } },
      features: [entry('auth', true), entry('billing', false)],
      flows: [entry('signup', false, { criticalPath: true }), entry('checkout', false)],
    })
    render(<TestCoverageDashboard />)

    const links = await screen.findAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Name signup', '/devtools/flows#signup'],
      ['Name billing', '/devtools/features#billing'],
      ['Name checkout', '/devtools/flows#checkout'],
    ])
    expect(screen.queryByText('noGaps')).toBeNull()
  })

  test('does not say everything has tests when the summary counts features or flows without tests', async () => {
    respondWith({
      summary: { totalTags: 1, testFiles: 1, byCategory: {}, features: { total: 17, withTests: 15, withoutTests: 2 }, flows: { total: 3, withTests: 0, withoutTests: 3 } },
    })
    render(<TestCoverageDashboard />)

    await screen.findByText('gaps')
    expect(screen.queryByText('noGaps')).toBeNull()
  })

  test('says everything has tests when nothing is missing', async () => {
    respondWith({
      summary: { totalTags: 1, testFiles: 1, byCategory: {}, features: { total: 1, withTests: 1, withoutTests: 0 }, flows: { total: 1, withTests: 1, withoutTests: 0 } },
      features: [entry('auth', true)],
      flows: [entry('signup', true)],
    })
    render(<TestCoverageDashboard />)

    expect(await screen.findByText('noGaps')).toBeTruthy()
  })
})
