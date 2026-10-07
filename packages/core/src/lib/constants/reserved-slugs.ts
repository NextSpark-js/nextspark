/**
 * Reserved Slugs for Pages System
 *
 * The slugs a page at the site root cannot take because a route of the host already answers that URL: Next serves
 * a static segment before the generated `(public)/[slug]` page. They are the first segments of core's route
 * manifest (`src/routes/manifest.json`; a test fails when the two drift) plus `_next`. The base paths of the
 * other registered entities are added where the check runs (`validatePublicSlug`); the routes a project adds
 * under `templates/` are the project's to avoid.
 */

export const RESERVED_SLUGS = [
  '_next',
  '403',
  'accept-invite',
  'api',
  'auth-error',
  'dashboard',
  'devtools',
  'docs',
  'forgot-password',
  'login',
  'public',
  'reset-password',
  'signup',
  'superadmin',
  'verify-email',
] as const

export type ReservedSlug = (typeof RESERVED_SLUGS)[number]

/**
 * Check if a slug is reserved: one of core's routes, or one of `extra` (other entities' base path segments)
 */
export function isReservedSlug(slug: string, extra: readonly string[] = []): boolean {
  const lower = slug.toLowerCase()
  return (RESERVED_SLUGS as readonly string[]).includes(lower) || extra.includes(lower)
}

/**
 * Validate a slug for pages system
 * Returns error message if invalid, null if valid
 *
 * The format is the one the templates' `valid_slug` / `valid_post_slug` constraints enforce
 * (`^[a-z0-9\-]+$`, no dot: a dotted last segment is read as a file request by the public item routes),
 * plus the stricter rules below, which only apply to new writes. `checkReserved: false` skips the reserved
 * list, `reserved` adds words to it, for an entity whose URLs are not at the site root (`/blog/v1` cannot shadow a root route).
 */
export function validatePageSlug(
  slug: string,
  { checkReserved = true, reserved = [] }: { checkReserved?: boolean; reserved?: readonly string[] } = {}
): string | null {
  // Check if empty
  if (!slug || slug.trim().length === 0) {
    return 'Slug cannot be empty'
  }

  // Check format (lowercase, numbers, hyphens only)
  const slugRegex = /^[a-z0-9\-]+$/
  if (!slugRegex.test(slug)) {
    return 'Slug can only contain lowercase letters, numbers, and hyphens'
  }

  // Check if starts or ends with hyphen
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return 'Slug cannot start or end with a hyphen'
  }

  // Check for consecutive hyphens
  if (slug.includes('--')) {
    return 'Slug cannot contain consecutive hyphens'
  }

  // Check length
  if (slug.length > 100) {
    return 'Slug cannot be longer than 100 characters'
  }

  if (slug.length < 2) {
    return 'Slug must be at least 2 characters long'
  }

  // Check if reserved
  if (checkReserved && isReservedSlug(slug, reserved)) {
    return `Slug "${slug}" is reserved by the system`
  }

  return null
}

/**
 * Generate a slug from a string (typically a title)
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/\-\-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '') // Remove leading hyphens
    .replace(/-+$/, '') // Remove trailing hyphens
    .slice(0, 100) // Limit length
}

/**
 * Suggest alternative slugs if the current one is taken or reserved
 */
export function suggestAlternativeSlug(slug: string, existingSlugs: string[] = []): string[] {
  const suggestions: string[] = []
  const baseSlug = slug.replace(/-\d+$/, '') // Remove trailing numbers

  // Try with numbers suffix
  for (let i = 1; i <= 5; i++) {
    const candidate = `${baseSlug}-${i}`
    if (!isReservedSlug(candidate) && !existingSlugs.includes(candidate)) {
      suggestions.push(candidate)
    }
  }

  // Try with common suffixes
  const suffixes = ['page', 'new', 'info', 'details', 'view']
  for (const suffix of suffixes) {
    const candidate = `${baseSlug}-${suffix}`
    if (!isReservedSlug(candidate) && !existingSlugs.includes(candidate)) {
      suggestions.push(candidate)
    }
  }

  return suggestions.slice(0, 5) // Return max 5 suggestions
}
