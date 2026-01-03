/**
 * Documentation Utility Functions
 *
 * Helper functions for docs processing that don't depend on markdown parsing
 */

/**
 * Extract order number from filename with format: "01-filename.md"
 *
 * @param filename - File or folder name
 * @returns Order number (999 if no prefix found)
 */
export function extractOrderFromFilename(filename: string): number {
  const match = filename.match(/^(\d+)-/)
  return match ? parseInt(match[1], 10) : 999
}

/**
 * Clean filename by removing order prefix and extension
 *
 * @param filename - File or folder name
 * @returns Clean slug
 *
 * @example
 * cleanFilename('01-introduction.md') // 'introduction'
 * cleanFilename('02-getting-started') // 'getting-started'
 */
export function cleanFilename(filename: string): string {
  return filename.replace(/^\d+-/, '').replace(/\.md$/, '')
}

/**
 * Convert slug to human-readable title
 *
 * @param slug - Kebab-case slug
 * @returns Title case string
 *
 * @example
 * slugToTitle('getting-started') // 'Getting Started'
 * slugToTitle('api-reference') // 'API Reference'
 */
export function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
