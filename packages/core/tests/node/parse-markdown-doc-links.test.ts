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
import { fileURLToPath } from 'node:url'
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

test('parseMarkdownFile gives a doc without frontmatter the title of its first heading, rendered once (#400)', async () => {
  const filePath = writeDocFile('docs/public/01-overview', '01-introduction.md', '# Welcome Aboard\n\nBody text.\n')

  const { metadata, html } = await parseMarkdownFile(filePath)

  assert.equal(metadata.title, 'Welcome Aboard')
  // The page renders the title as its own <h1>, so the body must not carry a second one.
  assert.doesNotMatch(html, /<h1/)
  assert.match(html, /Body text/)
})

test('parseMarkdownFile gives a doc with neither frontmatter nor heading the title of its file name (#400)', async () => {
  const filePath = writeDocFile('docs/public/01-overview', '01-getting-started.md', 'Just text.\n')

  const { metadata } = await parseMarkdownFile(filePath)

  assert.equal(metadata.title, 'Getting Started')
})

test('every doc of the starter template declares a title in its frontmatter (#400)', () => {
  const root = fileURLToPath(new URL('../../templates/projects/starter/docs', import.meta.url))
  const files = fs.readdirSync(root, { recursive: true }).map(String).filter(f => f.endsWith('.md'))
  assert.ok(files.length > 0)
  for (const f of files) {
    assert.match(fs.readFileSync(path.join(root, f), 'utf-8'), /^---\n(?:.*\n)*?title: \S/, `${f} has no frontmatter title`)
  }
})

test('parseMarkdownFile keeps the frontmatter title over a heading (#400)', async () => {
  const filePath = writeDocFile('docs/public/01-overview', '01-x.md', '---\ntitle: From Frontmatter\n---\n\n# Other\n')

  const { metadata } = await parseMarkdownFile(filePath)

  assert.equal(metadata.title, 'From Frontmatter')
})
