/**
 * The docs registry lists each page under the title the page itself renders (frontmatter, first heading, file name)
 * and says so in the build output when a doc has no title (#400).
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/docs-registry-titles.test.mjs
 */

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { scanDocsDirectory } from '../generators/docs-registry.mjs'

test('the registry titles a page like the page does, and warns for a doc without a title', () => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-docs-titles-'))
  const section = join(root, 'docs', 'public', '01-overview')
  mkdirSync(section, { recursive: true })
  writeFileSync(join(section, '01-framed.md'), '---\ntitle: From Frontmatter\n---\n\n# Other\n')
  writeFileSync(join(section, '02-headed.md'), '# From Heading\n\nText\n')
  writeFileSync(join(section, '03-plain-file.md'), 'Just text\n')

  const lines = []
  const log = mock.method(console, 'log', (...args) => lines.push(args.join(' ')))
  let sections
  try {
    sections = scanDocsDirectory(join(root, 'docs', 'public'), 'public', root)
  } finally {
    log.mock.restore()
  }

  assert.deepEqual(
    sections[0].pages.map(p => p.title),
    ['From Frontmatter', 'From Heading', 'Plain File']
  )
  assert.equal(lines.some(l => l.includes('01-framed.md')), false)
  assert.ok(lines.some(l => l.includes('docs/public/01-overview/02-headed.md has no title; using "From Heading"')))
  assert.ok(lines.some(l => l.includes('docs/public/01-overview/03-plain-file.md has no title; using "Plain File"')))
})
