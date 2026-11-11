import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { preparationEnvironment } from '../src/utils/preparation.js'

test('prepare reads .env.local over .env, as Next.js does, and an exported variable over both (#438)', () => {
  const root = mkdtempSync(join(tmpdir(), 'prepare-env-'))
  try {
    writeFileSync(join(root, '.env'), 'A=env\nB=env\n')
    writeFileSync(join(root, '.env.local'), 'A=local\n')
    const env = preparationEnvironment(root, {}, {})
    assert.equal(env.A, 'local')
    assert.equal(env.B, 'env')
    assert.equal(preparationEnvironment(root, {}, { A: 'exported' }).A, 'exported')
    assert.equal(preparationEnvironment(root, {}, { NODE_ENV: 'test' }).A, 'env')
    // production preparation still reads .env.local, as next build does
    assert.equal(preparationEnvironment(root, { production: true }, {}).A, 'local')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
