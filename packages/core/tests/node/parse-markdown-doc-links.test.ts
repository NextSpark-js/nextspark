/**
 * remark-doc-links.test.ts exercises the plugin directly against a simulated
 * mdast tree; it says nothing about whether parseMarkdownFile actually wires
 * it into the real remark pipeline. remark is ESM-only and Jest's
 * transformIgnorePatterns excludes it, so that integration is only
 * exercisable outside Jest - here, through tsx --test.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseMarkdownFile } from '../../src/lib/docs/parser'

function writeDocFile(relativeDir: string, fileName: string, content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-docs-'))
  const sectionDir = path.join(dir, relativeDir)
  fs.mkdirSync(sectionDir, { recursive: true })
  const filePath = path.join(sectionDir, fileName)
  fs.writeFileSync(filePath, content)
  return filePath
}

test('parseMarkdownFile routes a same-tree relative link to its served route', async () => {
  const filePath = writeDocFile(
    'docs/public/01-overview',
    '01-introduction.md',
    '---\ntitle: Introduction\n---\n\nSee [Customization](./02-customization.md) for more.\n'
  )
  // The link target has to exist too - resolveRelativeDocLink leaves a
  // reference to a page nobody wrote untouched rather than routing to it.
  fs.writeFileSync(path.join(path.dirname(filePath), '02-customization.md'), '---\ntitle: Customization\n---\n')

  const { html } = await parseMarkdownFile(filePath)

  assert.match(html, /href="\/docs\/overview\/customization"/)
  assert.doesNotMatch(html, /02-customization\.md/)
})

test('parseMarkdownFile routes a reference-style link to its served route', async () => {
  const filePath = writeDocFile(
    'docs/public/01-overview',
    '01-introduction.md',
    '---\ntitle: Introduction\n---\n\nSee [Customization][custom] for more.\n\n[custom]: ./02-customization.md\n'
  )
  fs.writeFileSync(path.join(path.dirname(filePath), '02-customization.md'), '---\ntitle: Customization\n---\n')

  const { html } = await parseMarkdownFile(filePath)

  assert.match(html, /href="\/docs\/overview\/customization"/)
  assert.doesNotMatch(html, /02-customization\.md/)
})

test('parseMarkdownFile leaves a link to a page nobody wrote untouched', async () => {
  const filePath = writeDocFile(
    'docs/public/01-overview',
    '01-introduction.md',
    '---\ntitle: Introduction\n---\n\nSee [Customization](./02-customization.md) for more.\n'
  )

  const { html } = await parseMarkdownFile(filePath)

  assert.match(html, /href="\.\/02-customization\.md"/)
})
