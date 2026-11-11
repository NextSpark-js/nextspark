/**
 * The pages each `features` flag of nextspark.config.ts leaves out when false (#425): the URLs of the page routes that
 * scripts/build/registry/host/features.mjs omits from the host. A node test compares the two with the route manifest.
 * No registry import, so tools and tests can read it; the app reads it through ./build-features.
 */
export const FEATURE_PAGES = {
  billing: ['/dashboard/settings/billing', '/dashboard/settings/plans', '/dashboard/settings/invoices'],
} as const

export type FeatureFlags = { readonly [flag in keyof typeof FEATURE_PAGES]: boolean }

/** False for a link to a page that a flag set to false left out of the app (the page or anything under it). */
export function isServedPathWith(features: FeatureFlags, href: string): boolean {
  const path = href.split(/[?#]/, 1)[0]
  return !(Object.keys(FEATURE_PAGES) as (keyof typeof FEATURE_PAGES)[]).some(
    flag => !features[flag] && FEATURE_PAGES[flag].some(page => path === page || path.startsWith(`${page}/`)),
  )
}
