/**
 * The Cache Components route modules put the page they wrap behind a Suspense boundary of their own (what Next.js's
 * instant-navigation check looks for): a wrapper that passed the page through would pass every other test.
 */
import { Suspense } from 'react'
import type { ReactElement } from 'react'

jest.mock('next/navigation', () => ({ notFound: jest.fn(), redirect: jest.fn() }))
jest.mock('@nextsparkjs/core/components/entities/wrappers/EntityDetailWrapper', () => ({ EntityDetailWrapper: () => null }))
jest.mock('../../../src/routes/_internal/entity-edit-view', () => ({ EntityEditView: () => null }))
jest.mock('@nextsparkjs/core/components/public/pageBuilder', () => ({ PageRenderer: () => null }))
jest.mock('next/cache', () => ({ cacheLife: jest.fn(), cacheTag: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/db', () => ({ query: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/blocks/patterns-resolver.service', () => ({ PatternsResolverService: {} }))
jest.mock('../../../src/routes/_internal/public-entity-shared', () => ({ fetchPublishedItem: jest.fn(), getResolvedBlocks: jest.fn(), buildPublicSelectClause: jest.fn() }))

import { behindSuspense } from '../../../src/routes/_internal/suspended-route'
import { createEntityDetailRoute } from '../../../src/routes/_internal/entity-detail-route.cc'
import { createEntityEditRoute } from '../../../src/routes/_internal/entity-edit-route.cc'
import { createPublicItemRoute } from '../../../src/routes/_internal/public-item-route.cc'
import PublicHome from '../../../src/routes/(public)/page.cc'
import type { EntityConfig } from '../../../src/lib/entities/types'

const config = { slug: 'tasks' } as unknown as EntityConfig
const props = { params: Promise.resolve({ id: '1', slug: 'a' }), searchParams: Promise.resolve({}) }
const root = (element: unknown) => element as ReactElement

describe('routes behind a Suspense boundary', () => {
  it('behindSuspense renders the route inside a Suspense element', () => {
    const Route = () => null
    const element = root(behindSuspense(Route)({}))
    expect(element.type).toBe(Suspense)
    expect(root((element.props as { children: unknown }).children).type).toBe(Route)
  })

  it.each([
    ['entity detail', () => createEntityDetailRoute(config, [])],
    ['entity edit', () => createEntityEditRoute(config)],
    ['public item', () => createPublicItemRoute(config)],
    ['public home', () => PublicHome],
  ])('%s: the module the Cache Components host uses has a Suspense root', (_name, make) => {
    expect(root((make() as (p: unknown) => unknown)(props)).type).toBe(Suspense)
  })
})
