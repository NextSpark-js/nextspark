/**
 * @jest-environment jsdom
 *
 * The Features and Flows viewers scroll to the card named by the URL hash when they mount: the dashboard's gap
 * links point at `#key`, and the browser tries before the cards exist (#498).
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@nextsparkjs/registries/testing-registry', () => {
  const entry = (key: string) => ({ key, name: key, description: 'd', category: 'core', tag: `feat-${key}`, testing: { hasTests: false, testCount: 0 } })
  return {
    FEATURE_REGISTRY: { billing: entry('billing'), plans: entry('plans') },
    FLOW_REGISTRY: { signup: entry('signup'), checkout: entry('checkout') },
    COVERAGE_SUMMARY: { features: { total: 2, withTests: 0, withoutTests: 2 }, flows: { total: 2, withTests: 0, withoutTests: 2 } },
  }
})

import { FeaturesViewer } from '@/core/components/devtools/FeaturesViewer'
import { FlowsViewer } from '@/core/components/devtools/FlowsViewer'

const scrollIntoView = jest.fn()

beforeEach(() => {
  scrollIntoView.mockReset()
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView
})

const scrolledIds = () => scrollIntoView.mock.contexts.map((el) => (el as Element).id)

describe.each([
  ['FeaturesViewer', FeaturesViewer, 'billing'],
  ['FlowsViewer', FlowsViewer, 'checkout'],
] as const)('%s', (_name, Viewer, key) => {
  test('scrolls to the card of the URL hash on mount', () => {
    window.history.replaceState({}, '', `/devtools/x#${key}`)
    render(<Viewer />)
    expect(scrolledIds()).toEqual([key])
  })

  test('does not scroll without a hash or for a hash with no card', () => {
    window.history.replaceState({}, '', '/devtools/x')
    render(<Viewer />)
    window.history.replaceState({}, '', '/devtools/x#nothing')
    render(<Viewer />)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
