/**
 * The item slugs the generated public routes answer (public-item-route*.tsx), and the sitemap lists only those (#273).
 * A module of its own, with no imports, so the routes, the sitemap and a plain Node test share one definition.
 */

/**
 * The extensions of the static files a browser or crawler asks a site for. A request for one that reaches an item route
 * (`/favicon.ico`, `/robots.txt`, `/apple-touch-icon.png`) is not an item: it answers not found at once, without reading the
 * database or rendering a template. A slug may contain a dot (`release-1.0`, `v2.5`), so only these extensions on the last
 * segment count.
 */
export const STATIC_FILE_EXTENSION = /\.(?:ico|png|jpe?g|gif|svg|webp|avif|txt|xml|json|webmanifest|map|js|css|woff2?)$/i

/** The item slugs the public routes answer for (nested ones joined with `/`); anything else is not found. */
export const ITEM_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/
export const MAX_ITEM_SLUG_LENGTH = 200

/** Whether the public item route of an entity answers `slug` rather than not found. */
export function isServableSlug(
  entity: { access?: { basePath?: string; allowNestedSlugs?: boolean }; builder?: { public?: { basePath?: string } } },
  slug: unknown
): slug is string {
  if (typeof slug !== 'string' || slug.length > MAX_ITEM_SLUG_LENGTH || !ITEM_SLUG.test(slug) || STATIC_FILE_EXTENSION.test(slug)) return false
  const basePath = entity.access?.basePath ?? entity.builder?.public?.basePath
  // `[slug]` (one segment) serves the site root unless nested slugs are on; every other base path is `[...slug]`
  return !slug.includes('/') || basePath !== '/' || entity.access?.allowNestedSlugs === true
}
