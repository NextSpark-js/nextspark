/**
 * @nextsparkjs/testing ships Cypress helpers (selectors, POMs, ApiInterceptor)
 * for generated projects and the monorepo themes -- core itself never imports
 * it (only the comments in src/index.ts and src/lib/test/index.ts point
 * consumers at it). Before beta.192, packages/core/package.json still listed
 * it under "dependencies" anyway, which made every `pnpm pack` of core
 * resolve its workspace:* range to the exact local version -- unpublished
 * until that release -- and broke local-tarball installs
 * (create-nextspark-app's src/create.ts) until a pnpm.overrides workaround
 * was added there. Generated projects (and the monorepo themes' own
 * peerDependencies) declare @nextsparkjs/testing directly instead; core
 * doesn't need to carry it. This test fails if it's ever re-added to
 * "dependencies" (or "peerDependencies", the same trap), so the workaround
 * doesn't have to come back.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('@nextsparkjs/testing is not a runtime dependency of @nextsparkjs/core', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(CORE_DIR, 'package.json'), 'utf8'))

  for (const field of ['dependencies', 'peerDependencies']) {
    assert.equal(
      manifest[field]?.['@nextsparkjs/testing'],
      undefined,
      `packages/core/package.json's "${field}" lists @nextsparkjs/testing; ` +
        '`pnpm pack` will resolve it to an unpublished exact version and break local-tarball installs again. ' +
        'Generated projects and the monorepo themes declare it themselves (see create-nextspark-app/src/create.ts ' +
        "and packages/cli/src/wizard/generators/index.ts) -- core doesn't need it."
    )
  }
})
