/**
 * The title of a docs page. One implementation for the registry generator (the sidebar) and the docs pages
 * (`src/lib/docs/utils.ts` re-exports it), so `<title>`, `og:title`, breadcrumb, `<h1>` and sidebar never disagree.
 *
 * The frontmatter `title` wins. Without one the page takes its first `#` heading (outside code fences) and drops that
 * line from the body, because the page renders the title as its own `<h1>`; without a heading either, it takes the file
 * name (`01-introduction.md` -> `Introduction`).
 *
 * @param {unknown} frontmatterTitle
 * @param {string} content markdown without the frontmatter
 * @param {string} filePath
 * @returns {{ title: string, content: string, source: 'frontmatter' | 'heading' | 'filename' }}
 */
function resolveDocTitle(frontmatterTitle, content, filePath) {
  if (typeof frontmatterTitle === 'string' && frontmatterTitle.trim()) {
    return { title: frontmatterTitle.trim(), content, source: 'frontmatter' }
  }

  const lines = content.split('\n')
  let fence = null
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
    return { title, content: lines.join('\n'), source: 'heading' }
  }

  const base = (filePath.split(/[\\/]/).pop() ?? '').replace(/\.md$/i, '').replace(/^\d+-/, '')
  const title = base
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  return { title: title || 'Untitled', content, source: 'filename' }
}

module.exports = { resolveDocTitle }
