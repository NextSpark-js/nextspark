/**
 * The `features` of nextspark.config.ts as the generated host was built with them (#425).
 *
 * `nextspark prepare` leaves out the core routes of a feature set to `false` (scripts/build/registry/host/features.mjs)
 * and writes the flags to the generated `features` registry. The UI reads them here, so it links to no page the host
 * does not serve. Client-safe: the registry holds booleans only.
 */
import { FEATURES } from '@nextsparkjs/registries/features'
import { isServedPathWith } from './feature-pages'

export { FEATURES }

/** False for a link to a page that a feature turned off left out of the app (the page or anything under it). */
export function isServedPath(href: string): boolean {
  return isServedPathWith(FEATURES, href)
}

/** The items of a configured menu whose `href` the app serves (an item without one is kept). */
export function servedLinks<T extends { href?: string }>(items: readonly T[] | undefined): T[] | undefined {
  return items?.filter(item => typeof item.href !== 'string' || isServedPath(item.href))
}

const allOn = () => Object.values(FEATURES).every(Boolean)

type MobileNavLinks = { mobileNav?: { items?: { href?: string }[]; moreSheetItems?: { href?: string }[] } }

/** The app config without the mobile navigation's links to pages a feature left out (the same object with every flag on). */
export function servedAppConfig<T extends MobileNavLinks>(config: T): T {
  if (allOn() || !config.mobileNav) return config
  return { ...config, mobileNav: { ...config.mobileNav, items: servedLinks(config.mobileNav.items), moreSheetItems: servedLinks(config.mobileNav.moreSheetItems) } }
}

type DashboardLinks = {
  topbar?: { userMenu?: { items?: { href?: string }[] }; settingsMenu?: { links?: { href?: string }[] } }
  settings?: { pages?: Record<string, { enabled?: boolean }> }
}

/**
 * The dashboard config without the top bar menus' links to pages a feature left out, and with those settings pages
 * disabled (the settings menu lists the enabled ones). The same object with every flag on; its methods are kept.
 */
export function servedDashboardConfig<T extends DashboardLinks>(config: T): T {
  if (allOn()) return config
  const { topbar, settings } = config
  return {
    ...config,
    topbar: topbar && {
      ...topbar,
      userMenu: topbar.userMenu && { ...topbar.userMenu, items: servedLinks(topbar.userMenu.items) },
      settingsMenu: topbar.settingsMenu && { ...topbar.settingsMenu, links: servedLinks(topbar.settingsMenu.links) },
    },
    settings: !settings?.pages ? settings : {
      ...settings,
      pages: Object.fromEntries(Object.entries(settings.pages).map(([key, page]) => [
        key,
        isServedPath(`/dashboard/settings/${key}`) ? page : { ...page, enabled: false },
      ])),
    },
  }
}
