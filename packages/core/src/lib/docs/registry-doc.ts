/**
 * Which markdown file a docs page may read. The cached `loadDoc` of the docs pages is reachable as a server reference,
 * so it takes only a section and a page name: both are validated here, looked up in the build's docs registry, and the
 * file must sit under the docs root of its category (`docs/public`, `docs/superadmin`) of the project.
 */
import fs from 'fs'
import path from 'path'

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

interface RegistrySection {
  slug: string
  title: string
  pages: { slug: string; path: string }[]
}

/** The title and absolute file of a registry page, or null when the names or the file are not a doc of `category`. */
export function resolveRegistryDoc(
  sections: readonly RegistrySection[],
  category: 'public' | 'superadmin',
  sectionSlug: unknown,
  pageSlug: unknown,
  cwd: string = process.cwd()
): { sectionTitle: string; filePath: string } | null {
  if (typeof sectionSlug !== 'string' || typeof pageSlug !== 'string') return null
  if (!SEGMENT.test(sectionSlug) || !SEGMENT.test(pageSlug) || sectionSlug.includes('..') || pageSlug.includes('..')) return null

  const section = sections.find(s => s.slug === sectionSlug)
  const page = section?.pages.find(p => p.slug === pageSlug)
  if (!section || !page) return null

  const root = path.resolve(cwd, 'docs', category)
  const filePath = path.resolve(cwd, page.path)
  if (!filePath.startsWith(root + path.sep) || !filePath.endsWith('.md')) return null
  // A symlink under the root that points outside is not a doc of the category.
  try {
    const realRoot = fs.realpathSync(root)
    if (!fs.realpathSync(filePath).startsWith(realRoot + path.sep)) return null
  } catch {
    return null
  }
  return { sectionTitle: section.title, filePath }
}
