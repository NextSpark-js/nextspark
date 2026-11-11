/**
 * #425: with a `features` flag off, the merged configs that the menus read (config-client and config-sync) link to no
 * page the host left out: the mobile navigation, the top bar's user and settings menus, and the settings pages. With
 * every flag on they are the configs as merged. The links written in components are checked by
 * tests/node/feature-links.test.ts.
 */
import { isServedPathWith } from '@/core/lib/config/feature-pages'

let flags = { billing: true }
jest.mock('@nextsparkjs/registries/features', () => ({ get FEATURES() { return flags } }))

type Loaded = { APP_CONFIG_MERGED: any; DASHBOARD_CONFIG: any }

function load(module: 'config-client' | 'config-sync'): Loaded {
  let loaded: Loaded | undefined
  jest.isolateModules(() => {
    loaded = require(`@/core/lib/config/${module}`)
  })
  return loaded!
}

/** Every link the menus of a merged config show. */
function menuLinks({ APP_CONFIG_MERGED, DASHBOARD_CONFIG }: Loaded): string[] {
  return [
    ...(APP_CONFIG_MERGED.mobileNav?.items ?? []),
    ...(APP_CONFIG_MERGED.mobileNav?.moreSheetItems ?? []),
    ...(DASHBOARD_CONFIG.topbar?.userMenu?.items ?? []),
    ...(DASHBOARD_CONFIG.topbar?.settingsMenu?.links ?? []),
  ].map((item: { href?: string }) => item.href).filter((href): href is string => typeof href === 'string')
    .concat(DASHBOARD_CONFIG.getEnabledSettingsPages().map(({ key }: { key: string }) => `/dashboard/settings/${key}`))
}

describe.each(['config-client', 'config-sync'] as const)('%s with features.billing', (module) => {
  afterEach(() => { flags = { billing: true } })

  it('false: no menu links to the billing, plans or invoices pages, and those settings pages are disabled', () => {
    flags = { billing: false }
    const config = load(module)
    const links = menuLinks(config)
    expect(links.length).toBeGreaterThan(0)
    expect(links.filter(href => !isServedPathWith(flags, href))).toEqual([])
    expect(config.DASHBOARD_CONFIG.isSettingsPageEnabled('billing')).toBe(false)
    expect(config.DASHBOARD_CONFIG.isSettingsPageEnabled('plans')).toBe(false)
    expect(config.DASHBOARD_CONFIG.isSettingsPageEnabled('profile')).toBe(true)
  })

  it('true: the menus keep their billing links', () => {
    const links = menuLinks(load(module))
    expect(links).toContain('/dashboard/settings/billing')
    expect(links).toContain('/dashboard/settings/plans')
  })
})
