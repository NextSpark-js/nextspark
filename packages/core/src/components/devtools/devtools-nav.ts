/** The devtools area's root: its dashboard. Every other devtools page lives under it. */
export const DEVTOOLS_ROOT = '/devtools'

/**
 * Whether the nav item at `href` is the current page: the item itself or a page under it. The area's root is
 * matched exactly, since it is a prefix of every devtools page (#496).
 */
export function isDevtoolsNavActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (href === DEVTOOLS_ROOT) return path === href
  return path === href || path.startsWith(href + '/')
}
