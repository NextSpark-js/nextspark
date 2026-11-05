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

/**
 * The title of a docs page and the markdown to render under it.
 *
 * The frontmatter `title` wins. Without one the page takes its first `#` heading (outside code fences) and drops that
 * line from the body, because the page renders the title as its own `<h1>`; without a heading either, it takes the file
 * name (`01-introduction.md` -> `Introduction`). Every route reads the title from here, so `<title>`, `og:title`, the
 * breadcrumb and the `<h1>` never disagree and never show `undefined`.
 */
export function resolveDocTitle(
  frontmatterTitle: unknown,
  content: string,
  filePath: string
): { title: string; content: string } {
  if (typeof frontmatterTitle === 'string' && frontmatterTitle.trim()) {
    return { title: frontmatterTitle.trim(), content }
  }

  const lines = content.split('\n')
  let fence: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].match(/^\s{0,3}(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) fence = marker[1][0]
      else if (marker[1][0] === fence) fence = null
      continue
    }
    if (fence) continue
    const heading = lines[i].match(/^ {0,3}#[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/)
    if (!heading) continue
    const title = heading[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '').trim()
    if (!title) continue
    lines.splice(i, lines[i + 1]?.trim() === '' ? 2 : 1)
    return { title, content: lines.join('\n') }
  }

  const base = (filePath.split(/[\\/]/).pop() ?? '').replace(/\.md$/i, '')
  return { title: slugToTitle(cleanFilename(base)) || 'Untitled', content }
}
