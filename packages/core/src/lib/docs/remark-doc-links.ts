/**
 * remark plugin: rewrite a docs page's own relative markdown links
 * (`./02-customization.md`, `../02-features/01-components.md`) into the route
 * the page builder actually serves (`/docs/overview/customization`).
 *
 * Content is authored and read as files on disk, organised the same way the
 * docs registry scans them (`docs/<public|superadmin>/<NN-section>/<NN-page>.md`),
 * but the browser never sees that layout - only the section/page slugs the
 * registry derives from it. A relative link left untranslated resolves against
 * the rendered page's URL instead of the source tree, so it 404s. Only a link
 * that resolves inside this same docs tree can be translated this way; one
 * that escapes it (a plugin's own docs, for instance) has no route to point at
 * and is left untouched for the author to fix or remove at the source.
 */
import path from 'path'
import { cleanFilename } from './utils'

const DOC_TREE_PATTERN = /\/docs\/(public|superadmin)\/([^/]+)\/([^/]+)\.md$/

/**
 * The `/docs/...` or `/superadmin/docs/...` route for a relative link written
 * inside `filePath`, or null when the link isn't a same-tree relative `.md`
 * reference (an absolute path, an external URL, or one that resolves outside
 * `docs/public` and `docs/superadmin`).
 */
export function resolveRelativeDocLink(url: string, filePath: string): string | null {
  const match = url.match(/^(\.{1,2}\/[^?#]+\.md)(#.*)?$/)
  if (!match) return null

  const [, relativePath, hash = ''] = match
  const resolved = path.resolve(path.dirname(filePath), relativePath).replace(/\\/g, '/')
  const treeMatch = resolved.match(DOC_TREE_PATTERN)
  if (!treeMatch) return null

  const [, source, sectionDir, pageFile] = treeMatch
  const sectionSlug = cleanFilename(sectionDir)
  const pageSlug = cleanFilename(pageFile)
  const base = source === 'superadmin' ? '/superadmin/docs' : '/docs'
  return `${base}/${sectionSlug}/${pageSlug}${hash}`
}

interface MarkdownNode {
  type: string
  url?: string
  children?: MarkdownNode[]
}

/**
 * A reference-style link (`[Text][id]`) carries no url of its own - the mdast
 * parser keeps it on a separate `definition` node (`[id]: ./page.md`), a
 * sibling wherever it was written, that every matching `linkReference` is
 * resolved against in a later pass. Rewriting the `definition`'s url here
 * routes every reference to it in one step.
 */
function rewriteLinks(node: MarkdownNode, filePath: string): void {
  if (!node.children) return

  for (const child of node.children) {
    if ((child.type === 'link' || child.type === 'definition') && child.url) {
      const resolved = resolveRelativeDocLink(child.url, filePath)
      if (resolved) child.url = resolved
    }
    rewriteLinks(child, filePath)
  }
}

/**
 * Unified/remark plugin. Runs on the mdast tree before it is converted to
 * rehype, so the generated `<a>` already carries the routed href.
 */
export function remarkDocLinks(filePath: string) {
  return (tree: unknown): void => {
    rewriteLinks(tree as MarkdownNode, filePath)
  }
}
