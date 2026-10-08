/**
 * apps/dev is the integration app the root scripts build and run, and it
 * runs the proxy and startup a generated project gets: its src/proxy.ts and
 * instrumentation.ts are the files the scaffold writes
 * (packages/core/templates/), facades over @nextsparkjs/core/proxy and
 * @nextsparkjs/core/instrumentation, which apps/dev's tsconfig paths resolve
 * to packages/core/src.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const APPS_DEV_PROXY = path.join(REPO_ROOT, 'apps/dev/src/proxy.ts')

test('apps/dev has its proxy beside src/app, where Next discovers it', () => {
  assert.ok(fs.existsSync(APPS_DEV_PROXY), 'apps/dev/src/proxy.ts is missing, so apps/dev serves requests no generated project would')
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'apps/dev/proxy.ts')), false, 'a root proxy is ignored when the app lives under src/app')
})

test("apps/dev's proxy.ts and instrumentation.ts are the scaffold's files", () => {
  for (const [appsDev, template] of [
    ['apps/dev/src/proxy.ts', 'packages/core/templates/proxy.ts'],
    ['apps/dev/instrumentation.ts', 'packages/core/templates/instrumentation.ts'],
  ]) {
    assert.equal(
      fs.readFileSync(path.join(REPO_ROOT, appsDev), 'utf8'),
      fs.readFileSync(path.join(REPO_ROOT, template), 'utf8'),
      `${appsDev} differs from ${template}: copy the template over it`
    )
  }
})
