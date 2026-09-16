/**
 * `docs.publicAccess` is the one setting that decides whether /docs needs a
 * session: the generated proxy reads it through isDocsPublic() in
 * lib/docs/access, and the docs have to describe that same setting. A doc that
 * still gates /docs on `docs.public === false`, or tells a project to write
 * `docs: { public: false }` to require a session, describes the older shape as
 * if it were the contract.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const CORE_DOCS_DIR = path.join(REPO_ROOT, 'packages/core/docs')
const PROXY_TEMPLATE = path.join(REPO_ROOT, 'packages/core/templates/proxy.ts')
const ARCHITECTURE_DOC = path.join(CORE_DOCS_DIR, '15-documentation-system/02-architecture.md')

function markdownFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return markdownFiles(entryPath)
    return entry.name.endsWith('.md') ? [entryPath] : []
  })
}

test('the proxy template decides docs access through isDocsPublic, not by reading docs.public itself', () => {
  const source = fs.readFileSync(PROXY_TEMPLATE, 'utf8')
  assert.match(source, /isDocsPublic\(/)
  assert.doesNotMatch(source, /\.docs\?*\.public\b/)
})

test('no core doc gates /docs on docs.public or tells a project to write docs: { public: false }', () => {
  for (const file of markdownFiles(CORE_DOCS_DIR)) {
    const content = fs.readFileSync(file, 'utf8')
    const relative = path.relative(REPO_ROOT, file)
    assert.doesNotMatch(content, /docs\?*\.public\s*===\s*false/, `${relative} still gates /docs on docs.public === false`)
    assert.doesNotMatch(content, /docs:\s*\{\s*public:\s*false/, `${relative} still tells a project to write docs: { public: false }`)
  }
})

test('no core doc presents docs.enabled or superadmin.enabled as switches that hide docs', () => {
  for (const file of markdownFiles(CORE_DOCS_DIR)) {
    const content = fs.readFileSync(file, 'utf8')
    const relative = path.relative(REPO_ROOT, file)
    assert.doesNotMatch(content, /Turn the whole documentation system on\/off/, `${relative} still says docs.enabled turns the docs off`)
    assert.doesNotMatch(content, /Admin docs hidden entirely/, `${relative} still says superadmin.enabled hides /superadmin/docs`)
  }
})

test('the architecture doc names publicAccess as the access setting and keeps the older boolean documented', () => {
  const content = fs.readFileSync(ARCHITECTURE_DOC, 'utf8')
  assert.match(content, /#### Who can read \/docs/)
  assert.match(content, /`docs\.publicAccess` is the only access setting/)
  assert.match(content, /`public: false`[\s\S]{0,40}still means\s+`publicAccess: false`/)
})
