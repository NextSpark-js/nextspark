/**
 * Reserved Slugs for Pages System
 *
 * This file contains all slugs that cannot be used for dynamic pages
 * to prevent conflicts with system routes, API endpoints, and existing entities.
 *
 * Auto-updated by build-registry.mjs to include entity slugs from ENTITY_REGISTRY
 */

export const RESERVED_SLUGS = [
  // Core system routes
  'api',
  'auth',
  'admin',
  'login',
  'register',
  'dashboard',
  'signin',
  'signout',
  'signup',
  'verify',
  'reset-password',
  'forgot-password',

  // Next.js internals
  '_next',
  '_vercel',
  '_error',
  '_document',
  '_app',

  // Common static assets
  'public',
  'static',
  'assets',
  'images',
  'theme',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',

  // Reserved for potential future use
  'app',
  'core',
  'lib',
  'components',
  'utils',
  'styles',
  'fonts',

  // Common page names that might conflict
  'index',
  'home',
  'page',
  'post',
  'posts',
  'blog',
  'article',
  'articles',

  // API versioning
  'v1',
  'v2',
  'v3',

  // Will be extended with entity slugs from ENTITY_REGISTRY
  // by build-registry.mjs
] as const

export type ReservedSlug = (typeof RESERVED_SLUGS)[number]

/**
 * Check if a slug is reserved
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase() as ReservedSlug)
}

/**
 * Validate a slug for pages system
 * Returns error message if invalid, null if valid
 */
export function validatePageSlug(slug: string): string | null {
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
  if (isReservedSlug(slug)) {
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
