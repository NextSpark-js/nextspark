/**
 * #574: the list route reads the first page behind a Suspense boundary of its own, whose fallback is the list without it.
 * The route itself does not wait for the read: if it did, the entity's loading skeleton (wider than a phone screen)
 * would stay on screen while the read runs and move the bottom navigation when it goes.
 */
import React from 'react'

const mockRead = jest.fn()
const mockHeaders = jest.fn()
jest.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
jest.mock('next/headers', () => ({ headers: async () => mockHeaders() }))
jest.mock('@nextsparkjs/core/components/entities/wrappers/EntityListWrapper', () => ({ EntityListWrapper: () => null }))
jest.mock('@nextsparkjs/core/lib/api/entity/list-first-page', () => ({ readEntityListFirstPage: (...args: unknown[]) => mockRead(...args) }))

import { createEntityListRoute } from '../../../src/routes/_internal/entity-list-route'
import { EntityListWrapper } from '@nextsparkjs/core/components/entities/wrappers/EntityListWrapper'

const CONFIG = { slug: 'tasks', enabled: true, ui: { dashboard: { showInMenu: true } } } as never

test('the route answers before the read does, with the list placeholder as the fallback', async () => {
  mockRead.mockReturnValue(new Promise(() => {}))
  const Route = createEntityListRoute(CONFIG)
  const element = await Promise.race([
    Route({ searchParams: Promise.resolve({}) }),
    new Promise(resolve => setTimeout(() => resolve('waited for the read'), 200)),
  ]) as React.ReactElement<{ fallback: React.ReactElement<{ entityType: string; initialPage?: unknown }>; children: React.ReactElement }>
  expect(element).not.toBe('waited for the read')
  expect(element.type).toBe(React.Suspense)
  expect(element.props.fallback.type).toBe(EntityListWrapper)
  expect(element.props.fallback.props).toEqual({ entityType: 'tasks', placeholder: true })
})

/** The list element the boundary's content renders for a request with these headers. */
async function content(headers: Record<string, string>) {
  mockHeaders.mockReturnValue(new Headers(headers))
  const element = await createEntityListRoute(CONFIG)({ searchParams: Promise.resolve({ q: undefined }) }) as React.ReactElement<{ children: React.ReactElement<{ slug: string; searchParams: Promise<unknown> }> }>
  const Inner = element.props.children.type as (props: unknown) => Promise<React.ReactElement<{ initialPage: unknown }>>
  return Inner(element.props.children.props)
}

test.each([
  ['a document request', { 'sec-fetch-mode': 'navigate' }],
  ['a client with no Sec-Fetch-Mode', {}],
])('%s: the boundary content passes the read page to the list', async (_name, headers) => {
  const page = { key: 'k', teamId: 't', data: [] }
  mockRead.mockReset().mockResolvedValue(page)
  expect((await content(headers)).props.initialPage).toBe(page)
  expect(mockRead).toHaveBeenCalledWith('tasks', { q: undefined })
})

test('a client navigation or a prefetch (a fetch for the browser) reads nothing: the list requests as before', async () => {
  mockRead.mockReset()
  expect((await content({ 'sec-fetch-mode': 'cors' })).props.initialPage).toBeNull()
  expect(mockRead).not.toHaveBeenCalled()
})
