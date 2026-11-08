/**
 * #412: the title and description of the superadmin area come from the catalog (`generateMetadata`), as the layouts
 * export them; a static `metadata` would stay English whatever the locale (and the generated app tree re-exports both names).
 */
// what the layouts import and the test does not need (the same stubs as area-access.test)
jest.mock('next/navigation', () => ({ redirect: jest.fn(), useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/headers', () => ({ headers: async () => new Headers() }))
jest.mock('@nextsparkjs/core/lib/auth', () => ({ getTypedSession: jest.fn(), auth: { api: { getSession: jest.fn() } } }))
jest.mock('@nextsparkjs/core/lib/i18n/client-messages', () => ({ selectMessages: () => ({}), getConfiguredClientNamespaces: () => ({ superadmin: [], dashboard: [] }) }))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({ APP_CONFIG_MERGED: { i18n: { supportedLocales: ['en'], defaultLocale: 'en' } } }))
jest.mock('@nextsparkjs/core/components/app/guards/SuperAdminGuard', () => ({ SuperAdminGuard: () => null }))
jest.mock('@nextsparkjs/core/components/app/guards/DeveloperGuard', () => ({ DeveloperGuard: () => null }))
jest.mock('@nextsparkjs/core/providers/DashboardProviders', () => ({ DashboardProviders: () => null }))
jest.mock('@nextsparkjs/core/components/superadmin/layouts/SuperadminSidebar', () => ({ SuperadminSidebar: () => null }))
jest.mock('@nextsparkjs/core/lib/plugins/nav-items', () => ({ getAllPluginNavItems: () => [] }))
jest.mock('@nextsparkjs/core/providers/static-intl-provider', () => ({ StaticIntlProvider: () => null }))

import * as isrLayout from '../../../src/routes/superadmin/layout'
import * as ccLayout from '../../../src/routes/superadmin/layout.cc'
import en from '@/core/messages/en/index'

describe.each([['layout', isrLayout], ['layout.cc', ccLayout]] as const)('superadmin/%s', (_name, layout) => {
  it('exports generateMetadata, not a static metadata', async () => {
    expect('metadata' in layout).toBe(false)
    expect(await layout.generateMetadata()).toEqual({
      title: en.superadmin.layout.metaTitle,
      description: en.superadmin.layout.metaDescription,
      robots: 'noindex, nofollow',
    })
  })
})
