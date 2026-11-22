/**
 * @jest-environment jsdom
 *
 * #547: the API Explorer sidebar applies its saved groups after mount. Reading localStorage while rendering made
 * the first client render differ from the server HTML (React error #418 after a reload with saved groups).
 */
import React from 'react'
import { renderToString } from 'react-dom/server'
import { render, screen, cleanup } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import { ApiEndpointsSidebar } from '../../../../../src/components/devtools/api-explorer/ApiEndpointsSidebar'

const route = (path: string) => ({ path, methods: ['GET'], source: 'core' }) as never
const routes = { core: [route('/api/v1/billing/x'), route('/api/v1/teams/y')], entity: [], theme: [], plugin: [] } as never
const props = { routes, selectedEndpoint: null, onSelectEndpoint: jest.fn(), isCollapsed: false, onToggleCollapse: jest.fn() }
const P = 'nextspark:apiExplorer:'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('ApiEndpointsSidebar saved state', () => {
  test('the server-side render does not depend on what localStorage holds', () => {
    const empty = renderToString(<ApiEndpointsSidebar {...props} />)
    localStorage.setItem(P + 'sidebar:expandedPrefixes', JSON.stringify(['core:billing']))
    localStorage.setItem(P + 'sidebar:expandedCategories', JSON.stringify([]))
    expect(renderToString(<ApiEndpointsSidebar {...props} />)).toBe(empty)
  })

  test('after mount the saved groups open, and the saved state is not overwritten by the defaults', () => {
    localStorage.setItem(P + 'sidebar:expandedPrefixes', JSON.stringify(['core:billing']))
    render(<ApiEndpointsSidebar {...props} />)
    const billing = screen.getAllByRole('button').find((b) => b.getAttribute('data-cy')?.includes('billing'))!
    expect(billing.getAttribute('aria-expanded')).toBe('true')
    expect(JSON.parse(localStorage.getItem(P + 'sidebar:expandedPrefixes')!)).toEqual(['core:billing'])
  })
})
