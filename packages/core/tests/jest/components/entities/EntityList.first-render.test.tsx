/**
 * @jest-environment node
 *
 * The page of an entity list is in the HTML the server sends (#566): the title and the subtitle, which are the
 * contentful paint of the page, no longer wait for the client to read the entity config in an effect. The shell
 * fills the client registry while it renders, before the page, on the server as in the browser, so the first
 * render of the list can read it.
 */
import React from 'react'
import { renderToString } from 'react-dom/server'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/pages' }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }))
jest.mock('@/core/hooks/useEntityText', () => ({ useLocalizedEntityConfig: (config: unknown) => config }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false }) }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ teamId: 'team-1', isReady: true }) }))
jest.mock('@/core/hooks/useUrlFilters', () => ({ useUrlFilters: () => ({ filters: {}, setFilter: jest.fn() }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/lib/api/entities', () => ({ listEntityData: jest.fn(), deleteEntityData: jest.fn(), duplicateEntityData: jest.fn() }))
jest.mock('@/core/components/entities/EntityTable', () => ({ EntityTable: () => <div data-testid="table" /> }))
jest.mock('@/core/components/entities/EntityBulkActions', () => ({ EntityBulkActions: () => null }))
jest.mock('@/core/components/shared/SearchInput', () => ({ SearchInput: () => null }))
jest.mock('@/core/components/shared/MultiSelectFilter', () => ({ MultiSelectFilter: () => null }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import { EntityListWrapper } from '@/core/components/entities/wrappers/EntityListWrapper'
import { useEntityConfig, clearEntityConfigCache } from '@/core/hooks/useEntityConfig'
import { clientEntityRegistry } from '@/core/lib/entities/registry.client'

const CONFIG = {
  slug: 'pages',
  enabled: true,
  names: { singular: 'Page', plural: 'Pages' },
  access: {},
  ui: { dashboard: { filters: [], columns: [] }, features: { bulkOperations: false, searchable: false } },
  fields: [],
} as never

beforeEach(() => {
  clearEntityConfigCache()
  clientEntityRegistry.clear()
})

test('the title is in the server HTML when the shell has filled the registry', () => {
  clientEntityRegistry.register(CONFIG)
  const html = renderToString(<EntityListWrapper entityType="pages" />)
  expect(html).toContain('<h1')
  expect(html).toContain('Pages')
})

test('with an empty registry the list is still the skeleton until the config is read', () => {
  const html = renderToString(<EntityListWrapper entityType="pages" />)
  expect(html).not.toContain('<h1')
})

test('eager: false keeps the old first render for the form and the detail', () => {
  clientEntityRegistry.register(CONFIG)
  let first: ReturnType<typeof useEntityConfig> | undefined
  const Probe = () => {
    const state = useEntityConfig('pages')
    first ??= state
    return null
  }
  renderToString(<Probe />)
  expect(first?.config).toBeNull()
  expect(first?.isLoading).toBe(true)
})
