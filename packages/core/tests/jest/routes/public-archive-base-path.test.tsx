/**
 * The archive route tells its grid where the entity's items are served, so the cards link to `<basePath>/<slug>` (#573):
 * the entity's `access.basePath`, the deprecated `builder.public.basePath`, '' for the site root and nothing without one.
 */
jest.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
jest.mock('@nextsparkjs/core/components/public/entities/PublicEntityGrid', () => ({ PublicEntityGrid: () => null }))
jest.mock('@nextsparkjs/core/lib/seo/page-metadata', () => ({ pageMetadata: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/i18n/public-translations', () => ({ getPublicTranslations: jest.fn() }))

import { Suspense, type ReactElement } from 'react'
import { createPublicArchiveRoute } from '../../../src/routes/_internal/public-archive-route'
import type { EntityConfig } from '../../../src/lib/entities/types'

const entity = (access: Record<string, unknown>, builder?: Record<string, unknown>) =>
  ({ slug: 'posts', fields: [], enabled: true, names: { singular: 'Post', plural: 'Posts' }, access: { public: true, ...access }, ui: { public: { hasArchivePage: true } }, builder }) as unknown as EntityConfig

/** The props the route gives its grid: Route > Suspense > ArchiveGrid (async) > PublicEntityGrid. */
async function gridProps(config: EntityConfig) {
  const root = createPublicArchiveRoute(config)({ searchParams: Promise.resolve({}) }) as ReactElement<{ children: ReactElement[] }>
  const suspense = root.props.children.find(child => child.type === Suspense) as ReactElement<{ children: ReactElement<{ config: EntityConfig; searchParams: Promise<object> }> }>
  const archiveGrid = suspense.props.children
  const grid = await (archiveGrid.type as (props: unknown) => Promise<ReactElement<{ basePath?: string }>>)(archiveGrid.props)
  return grid.props
}

test('the grid gets the base path of the entity', async () => {
  expect((await gridProps(entity({ basePath: '/blog' }))).basePath).toBe('/blog')
})

test('the deprecated builder base path is read too', async () => {
  expect((await gridProps(entity({}, { enabled: true, public: { basePath: '/news' } }))).basePath).toBe('/news')
})

test('an entity at the site root gets an empty base path, and one without a base path gets none', async () => {
  expect((await gridProps(entity({ basePath: '/' }))).basePath).toBe('')
  expect((await gridProps(entity({}))).basePath).toBeUndefined()
})
