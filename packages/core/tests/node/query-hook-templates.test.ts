/**
 * The project templates core ships must not trip NS_QUERY_HOOK_WITHOUT_PROVIDER with providers.scope 'groups' (#362):
 * a new project that opts in starts with no warning. And the walk really reaches the queries: with the dashboard
 * counted as a public area, the same templates are reported.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readProvidersScope } from '../../scripts/build/registry/generators/root-providers.mjs'
import { findQueryHooksWithoutProvider } from '../../scripts/maintenance/query-providers.mjs'

const TEMPLATES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates/projects')
const NAMES = ['starter', 'blog', 'crm', 'productivity']

function pages(root: string): Array<{ kind: string; target: string; file: string; layer: string }> {
  const found: Array<{ kind: string; target: string; file: string; layer: string }> = []
  const walk = (dir: string, prefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`)
      else if (/^page\./.test(entry.name)) found.push({ kind: 'page', target: `${prefix}${entry.name}`, file: path.join(dir, entry.name), layer: 'project' })
    }
  }
  walk(path.join(root, 'templates'), '')
  return found
}

test("the four project templates have no finding with providers.scope 'groups'", () => {
  for (const name of NAMES) {
    assert.deepEqual(findQueryHooksWithoutProvider({ projectRoot: path.join(TEMPLATES, name), scope: 'groups' }), [], name)
  }
})

test("the four project templates declare providers.scope 'groups' (#362)", () => {
  for (const name of NAMES) assert.equal(readProvidersScope(path.join(TEMPLATES, name)), 'groups', name)
})

test('the walk reaches the queries of the templates: counting the dashboard as a public area reports them', () => {
  const asPublic = (name: string) => pages(path.join(TEMPLATES, name)).map(route => ({ ...route, target: route.target.replace(/^dashboard\//, 'app/') }))
  for (const name of ['blog', 'crm', 'productivity']) {
    const found = findQueryHooksWithoutProvider({ projectRoot: path.join(TEMPLATES, name), scope: 'groups', routes: asPublic(name) })
    assert.ok(found.length > 0, name)
  }
})
