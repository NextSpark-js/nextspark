/**
 * Core's own docs (packages/core/docs) are kept as internal monorepo
 * reference and never published, and a plugin's own docs/ is never scanned
 * into the docs registry either - so any claim elsewhere in the docs that
 * /docs/core/, /docs/theme/ or /docs/plugins/ is a real route (as a link, in
 * prose, or in a URL-structure code block) points nowhere real. Likewise,
 * there is a single `pnpm build:registries` command that rebuilds every
 * registry together - a namespaced `registry:build:<type>` script does not
 * exist.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

const DOCUMENTATION_SYSTEM_DIR = 'packages/core/docs/15-documentation-system'
const AI_PLUGIN_INSTALL_DOC = 'plugins/ai/docs/01-getting-started/02-installation.md'

function docFiles(relDir: string): string[] {
  return fs.readdirSync(path.join(REPO_ROOT, relDir))
    .filter(name => name.endsWith('.md'))
    .map(name => path.join(relDir, name))
}

test('the documentation-system docs do not claim /docs/core/, /docs/theme/ or /docs/plugins/ is a real route', () => {
  for (const file of docFiles(DOCUMENTATION_SYSTEM_DIR)) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
    for (const unpublishedPath of ['/docs/core/', '/docs/theme/', '/docs/plugins/']) {
      assert.doesNotMatch(content, new RegExp(unpublishedPath.replace(/\//g, '\\/')), `${file} still claims ${unpublishedPath} is a route`)
    }
  }
})

test('the AI plugin install doc does not recommend a registry:build:<type> script', () => {
  const content = fs.readFileSync(path.join(REPO_ROOT, AI_PLUGIN_INSTALL_DOC), 'utf8')
  assert.doesNotMatch(content, /registry:build:\w/, `${AI_PLUGIN_INSTALL_DOC} still recommends a namespaced registry:build script`)
})
