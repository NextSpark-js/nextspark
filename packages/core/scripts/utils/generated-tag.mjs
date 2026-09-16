/**
 * The generated tag `nextspark sync:app` puts on the files it writes, read here
 * for the build steps that rewrite part of such a file. The format and what it
 * means are the CLI's (packages/cli/src/utils/generated-tag.ts):
 *
 *   /* @nextspark-generated core@<version> path=<path> sha256=<hash of the rest> *\/
 *
 * The path runs up to the ` sha256=` that ends it, and is a JSON string when the
 * CLI had to quote it. On the first line, or the second after a shebang. While the hash matches, the
 * file is core's to update; a rewrite that leaves a stale hash makes sync treat
 * the file as changed by the project and stop updating it.
 */

import { createHash } from 'node:crypto'

const TAG_LINE = /^(?:\/\/|\/\*) @nextspark-generated core@\S+(?: path=.+?)? sha256=([0-9a-f]{64})(?: \*\/)?$/

/**
 * The hash a tag records: of the text below the tag, with CRLF line endings
 * read as LF, so a checkout that converts line endings keeps its tags intact.
 */
export function generatedHash(text) {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')
}

/**
 * A file split around its generated tag, or null when it has none.
 *
 * @param {string} text
 * @returns {{ head: string, line: string, body: string, intact: boolean } | null}
 *   `head` is the shebang line before the tag, if any; `line` the tag line with
 *   its line ending; `body` the file without the tag line; `intact` whether the
 *   body still hashes to what the tag recorded
 */
export function splitGeneratedTag(text) {
  const shebangEnd = text.startsWith('#!') ? text.indexOf('\n') : -1
  const head = text.slice(0, shebangEnd + 1)
  const newline = text.indexOf('\n', head.length)
  const lineEnd = newline === -1 ? text.length : newline + 1

  const match = TAG_LINE.exec(text.slice(head.length, newline === -1 ? text.length : newline).replace(/\r$/, ''))
  if (!match) return null

  const body = head + text.slice(lineEnd)
  return { head, line: text.slice(head.length, lineEnd), body, intact: generatedHash(body) === match[1] }
}

/**
 * `text` with what is below its generated tag passed through `rewrite`. A tag
 * that matched the file before is given the hash of the rewritten content, so
 * the file stays core's to update; a tag that no longer matched - the project
 * changed the file - is kept as it was. A file with no tag is rewritten whole.
 *
 * @param {string} text
 * @param {(body: string) => string} rewrite - Receives and returns the file without its tag line
 */
export function rewriteBelowGeneratedTag(text, rewrite) {
  const tag = splitGeneratedTag(text)
  if (!tag) return rewrite(text)

  const body = rewrite(tag.body)
  let line = tag.intact ? tag.line.replace(/sha256=[0-9a-f]{64}/, `sha256=${generatedHash(body)}`) : tag.line
  if (!line.endsWith('\n') && body.length > tag.head.length) line += '\n'

  return tag.head + line + body.slice(tag.head.length)
}
