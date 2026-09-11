/**
 * pnpm-workspace.yaml surgery
 *
 * Both project shapes have to put their own `packages:` list into a file they
 * did not write: create-nextspark-app writes it before the install to carry
 * `allowBuilds` (pnpm 11's build-script allowlist), and it can also hold the
 * user's overrides or catalogs. Replacing the file wholesale takes all of that
 * with it, which is how a generated project ends up installing without its
 * native binaries.
 *
 * Everything here edits text rather than parsing and re-serialising: the file
 * carries comments — create-nextspark-app explains `allowBuilds` in one — and a
 * YAML round-trip would drop them.
 */

/** Strip the quotes a YAML scalar may or may not carry. */
function unquote(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

/** `packages:` on its own line, opening a block list. */
function findBlockIndex(lines: string[]): number {
  return lines.findIndex(line => /^packages:\s*$/.test(line))
}

/** `packages: ['a', 'b']`, the whole list on one line. */
function findInlineIndex(lines: string[]): number {
  return lines.findIndex(line => /^packages:\s*\[.*\]\s*$/.test(line))
}

/**
 * Where a block list ends: the first line after `packages:` that is not one of
 * its items. Blank lines and comments sit inside the list and do not end it.
 */
function blockEndIndex(lines: string[], packagesIndex: number): number {
  let end = packagesIndex + 1

  for (; end < lines.length; end++) {
    const line = lines[end]
    if (/^\s+-\s*.+$/.test(line)) continue
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    break
  }

  return end
}

/** The entries of an inline list: `packages: ['apps/*', "web"]`. */
function parseInlineEntries(line: string): string[] {
  const inside = line.slice(line.indexOf('[') + 1, line.lastIndexOf(']'))
  return inside
    .split(',')
    .map(unquote)
    .filter(entry => entry.length > 0)
}

/** The entries a block list declares, unquoted. */
function parseBlockEntries(lines: string[], packagesIndex: number): string[] {
  const entries: string[] = []

  for (const line of lines.slice(packagesIndex + 1, blockEndIndex(lines, packagesIndex))) {
    const item = line.match(/^\s+-\s*(.+?)\s*$/)
    if (item) entries.push(unquote(item[1]))
  }

  return entries
}

/** The globs the file's `packages:` key declares, whichever form it uses. */
export function readPackageEntries(content: string): string[] {
  const lines = content.split('\n')
  const blockIndex = findBlockIndex(lines)
  if (blockIndex !== -1) return parseBlockEntries(lines, blockIndex)

  const inlineIndex = findInlineIndex(lines)
  if (inlineIndex !== -1) return parseInlineEntries(lines[inlineIndex])

  return []
}

function renderBlock(entries: string[]): string[] {
  return ['packages:', ...entries.map(entry => `  - '${entry}'`)]
}

/**
 * Add the globs the project needs to the file's `packages:` list, leaving
 * everything else in place. Entries already declared are not repeated,
 * whatever quoting they use.
 */
export function addPackageEntries(content: string, required: string[]): string {
  const declared = readPackageEntries(content)
  const missing = required.filter(entry => !declared.includes(entry))
  if (missing.length === 0) return content

  const lines = content.split('\n')
  const inlineIndex = findInlineIndex(lines)

  if (inlineIndex !== -1) {
    // Prepending a second `packages:` would leave the key duplicated and the
    // file unparseable, so this one line becomes a block list holding both.
    lines.splice(inlineIndex, 1, ...renderBlock([...declared, ...missing]))
    return lines.join('\n')
  }

  const blockIndex = findBlockIndex(lines)
  if (blockIndex === -1) {
    return [...renderBlock(missing), '', ...lines].join('\n')
  }

  // Appended after what the file already declares, so the user's own globs keep
  // the position — and the precedence — they were written with.
  lines.splice(blockEndIndex(lines, blockIndex), 0, ...missing.map(entry => `  - '${entry}'`))
  return lines.join('\n')
}

/**
 * Replace the file's `packages:` list with exactly these globs, keeping every
 * other key. Used where the project shape dictates the whole list (a monorepo
 * root) rather than adding to whatever is there.
 */
export function setPackageEntries(content: string, entries: string[]): string {
  const block = renderBlock(entries)

  if (content.trim() === '') {
    return `${block.join('\n')}\n`
  }

  const lines = content.split('\n')
  const inlineIndex = findInlineIndex(lines)

  if (inlineIndex !== -1) {
    lines.splice(inlineIndex, 1, ...block)
    return lines.join('\n')
  }

  const blockIndex = findBlockIndex(lines)
  if (blockIndex !== -1) {
    lines.splice(blockIndex, blockEndIndex(lines, blockIndex) - blockIndex, ...block)
    return lines.join('\n')
  }

  return [...block, '', ...lines].join('\n')
}
