/**
 * @jest-environment jsdom
 *
 * #526: an endpoint opens with its body filled (first preset, else the required fields), one empty row to type
 * into, the full path in a tooltip, and only the group of the selected endpoint open in the sidebar.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import {
  bodySkeleton,
  createEmptyRows,
  groupKeyForPath,
  initialBody,
} from '../../../../../src/components/devtools/api-explorer/explorer-helpers'
import { ApiEndpointsSidebar } from '../../../../../src/components/devtools/api-explorer/ApiEndpointsSidebar'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

const preset = (method: string, payload?: Record<string, unknown>) => ({ id: method, title: method, method, payload }) as never

describe('initialBody', () => {
  test('uses the first preset of the method that has a body, with its placeholders resolved', () => {
    const body = JSON.parse(
      initialBody('POST', [preset('GET'), preset('POST', { email: 'a-{{UNIQUE}}@example.test' }), preset('POST', { other: 1 })], null)
    )
    expect(body.email).toMatch(/^a-[a-z0-9]+@example\.test$/)
    expect(body.other).toBeUndefined()
  })
  test('falls back to the required-field skeleton for a POST', () => {
    expect(JSON.parse(initialBody('POST', [], { name: '' }))).toEqual({ name: '' })
  })
  test('a PATCH is not given the create skeleton', () => {
    expect(initialBody('PATCH', [], { name: '' })).toBe('')
  })
  test('a method with no body stays empty', () => {
    expect(initialBody('GET', [preset('GET', { a: 1 })], { a: 1 })).toBe('')
  })
})

describe('bodySkeleton', () => {
  const field = (over: Record<string, unknown>) => ({ name: 'f', type: 'text', required: true, ...over }) as never
  test('keeps required writable fields, with an empty value of their type', () => {
    expect(
      bodySkeleton([
        field({ name: 'title' }),
        field({ name: 'qty', type: 'number' }),
        field({ name: 'on', type: 'boolean' }),
        field({ name: 'kind', type: 'select', options: [{ value: 'a' }] }),
        field({ name: 'note', required: false }),
        field({ name: 'id', api: { readOnly: true } }),
        field({ name: 'tier', defaultValue: 'free' }),
      ])
    ).toEqual({ title: '', qty: 0, on: false, kind: 'a', tier: 'free' })
  })
  test('is null when nothing is required', () => {
    expect(bodySkeleton([field({ required: false })])).toBeNull()
  })
})

test('the editors start with one empty row', () => {
  expect(createEmptyRows()).toHaveLength(1)
})

describe('sidebar', () => {
  const routes = {
    core: [{ path: '/api/v1/billing/checkout', methods: ['POST'] }],
    entity: [{ path: '/api/v1/customers', methods: ['GET'] }],
    theme: [{ path: '/api/ai/orchestrator', methods: ['GET'] }],
    plugin: [],
  } as never

  test('groupKeyForPath names the category and group of an endpoint', () => {
    expect(groupKeyForPath(routes, '/api/ai/orchestrator')).toBe('theme:ai')
    expect(groupKeyForPath(routes, '/nope')).toBeNull()
  })

  const renderSidebar = (path: string) =>
    render(
      <ApiEndpointsSidebar
        routes={routes}
        selectedEndpoint={{ path, method: 'GET' }}
        onSelectEndpoint={() => {}}
        isCollapsed={false}
        onToggleCollapse={() => {}}
      />
    )

  test('only the group of the selected endpoint is open, and its path has a tooltip', () => {
    renderSidebar('/api/v1/customers')
    expect(screen.getByTitle('GET /api/v1/customers')).toBeTruthy()
    // The theme group is closed even though a theme route exists: no category is favoured.
    expect(screen.queryByTitle('GET /api/ai/orchestrator')).toBeNull()
    expect(screen.queryByTitle('POST /api/v1/billing/checkout')).toBeNull()
  })

  test('selecting a theme endpoint opens the theme group instead', () => {
    renderSidebar('/api/ai/orchestrator')
    expect(screen.getByTitle('GET /api/ai/orchestrator')).toBeTruthy()
    expect(screen.queryByTitle('GET /api/v1/customers')).toBeNull()
  })
})
