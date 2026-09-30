/**
 * A loading.tsx at the root of a (public) template group wraps every public route, the catch-all that ends in
 * notFound() included: Next then answers 200 for a URL that does not exist (ISR and dev alike; under Cache Components a
 * streamed not-found keeps the status it had when the shell was sent). A project scopes its skeleton to the page that
 * needs it, with a <Suspense> in the page or a loading.tsx in that page's own folder.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projects = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates/projects')

test('no project template has a loading.tsx at the root of its (public) group', () => {
  for (const project of fs.readdirSync(projects)) {
    const file = path.join(projects, project, 'templates/(public)/loading.tsx')
    assert.equal(fs.existsSync(file), false, `${project}: templates/(public)/loading.tsx makes every unknown public URL answer 200`)
  }
})

test('the starter home page scopes its skeleton with a Suspense', () => {
  const page = fs.readFileSync(path.join(projects, 'starter/templates/(public)/page.tsx'), 'utf8')
  assert.match(page, /<Suspense fallback=\{<SkeletonLandingPage \/>\}>/)
})
