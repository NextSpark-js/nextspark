/**
 * Core's own docs (packages/core/docs) are kept as internal monorepo
 * reference and never published, and a plugin's own docs/ is never scanned
 * into the docs registry either - so any claim elsewhere in the docs that
 * /docs/core/, /docs/theme/ or /docs/plugins/ is a real route (as a link, in
 * prose, or in a URL-structure code block) points nowhere real. Likewise,
 * there is a single `pnpm build:registries` command that rebuilds every
 * registry together - a namespaced `registry:build:<type>` script does not
 * exist.
 *
 * The additional tests keep registry-source, import-path, generator, and
 * command references accurate throughout the core documentation.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

const CORE_DOCS_DIR = 'packages/core/docs'
const DOCUMENTATION_SYSTEM_DIR = 'packages/core/docs/15-documentation-system'
const AI_PLUGIN_INSTALL_DOC = 'plugins/ai/docs/01-getting-started/02-installation.md'

function docFiles(relDir: string): string[] {
  return fs.readdirSync(path.join(REPO_ROOT, relDir))
    .filter(name => name.endsWith('.md'))
    .map(name => path.join(relDir, name))
}

function coreDocFiles(relDir = CORE_DOCS_DIR): string[] {
  return fs.readdirSync(path.join(REPO_ROOT, relDir), { withFileTypes: true })
    .flatMap(entry => {
      const entryPath = path.join(relDir, entry.name)
      if (entry.isDirectory()) return coreDocFiles(entryPath)
      return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : []
    })
}

test('the documentation-system docs do not claim /docs/core/, /docs/theme/ or /docs/plugins/ is a real route', () => {
  for (const file of docFiles(DOCUMENTATION_SYSTEM_DIR)) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
    for (const unpublishedPath of ['/docs/core/', '/docs/theme/', '/docs/plugins/']) {
      assert.doesNotMatch(content, new RegExp(unpublishedPath.replace(/\//g, '\\/')), `${file} still claims ${unpublishedPath} is a route`)
    }
  }
})

test('core docs do not use the removed core docs registry import path', () => {
  for (const file of coreDocFiles()) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
    assert.doesNotMatch(
      content,
      /(?:@\/)?core\/lib\/registries\/docs-registry/,
      `${file} still names the removed core docs registry path`
    )
  }
})

test('core docs do not describe core or plugin documentation as registry sources', () => {
  for (const file of coreDocFiles()) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
    assert.doesNotMatch(
      content,
      /(?:scans?|scanning|indexes?)\s+(?:all\s+)?(?:markdown\s+files\s+in\s+)?`?(?:packages\/)?core\/docs(?:\/\*\*\/\*\.md)?/i,
      `${file} still describes core documentation as a docs registry source`
    )
    assert.doesNotMatch(
      content,
      /(?:scans?|scanning|indexes?)\s+(?:all\s+)?(?:`?(?:contents\/)?plugins\/[^\s`]+\/docs|plugin\s+docs)/i,
      `${file} still describes plugin documentation as a docs registry source`
    )
  }
})

test('core documentation does not recommend removed registry build commands', () => {
  for (const file of coreDocFiles()) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
    assert.doesNotMatch(
      content,
      /pnpm\s+registry:build(?:-watch)?\b/,
      `${file} recommends a nonexistent pnpm registry command`
    )
    assert.doesNotMatch(
      content,
      /node\s+packages\/core\/scripts\/build\/registry\.mjs\b/,
      `${file} invokes the monorepo registry script without cd apps/dev and ../../`
    )
  }
})

test('core docs do not recommend the uninvoked standalone docs generator', () => {
  for (const file of coreDocFiles()) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
    assert.doesNotMatch(
      content,
      /(?:core\/)?scripts\/build\/docs-registry\.mjs/,
      `${file} still presents the standalone docs registry script as a generator`
    )
  }
})

test('the AI plugin install doc does not recommend a registry:build:<type> script', () => {
  const content = fs.readFileSync(path.join(REPO_ROOT, AI_PLUGIN_INSTALL_DOC), 'utf8')
  assert.doesNotMatch(content, /registry:build:\w/, `${AI_PLUGIN_INSTALL_DOC} still recommends a namespaced registry:build script`)
})
