import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { resolveDbEnv } from '../src/commands/db.js'

function withEnvFile(content: string, run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'db-env-'))
  try {
    writeFileSync(join(root, '.env'), content)
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('an exported variable beats the project .env', () => {
  withEnvFile('DATABASE_URL=env-url\nMIGRATE_DATABASE_URL=env-owner\nNEXT_PUBLIC_ACTIVE_THEME=env-theme\n', root => {
    const env = resolveDbEnv(root, { DATABASE_URL: 'exported-url', MIGRATE_DATABASE_URL: 'exported-owner', NEXT_PUBLIC_ACTIVE_THEME: 'exported-theme' })
    assert.equal(env.DATABASE_URL, 'exported-url')
    assert.equal(env.MIGRATE_DATABASE_URL, 'exported-owner')
    assert.equal(env.NEXT_PUBLIC_ACTIVE_THEME, 'exported-theme')
  })
})

test('with only the .env set, the .env values are used', () => {
  withEnvFile('DATABASE_URL=env-url\nMIGRATE_DATABASE_URL=env-owner\n', root => {
    const env = resolveDbEnv(root, {})
    assert.equal(env.DATABASE_URL, 'env-url')
    assert.equal(env.MIGRATE_DATABASE_URL, 'env-owner')
  })
})

test('the .env fills what the environment leaves unset', () => {
  withEnvFile('DATABASE_URL=env-url\nMIGRATE_DATABASE_URL=env-owner\n', root => {
    const env = resolveDbEnv(root, { DATABASE_URL: 'exported-url' })
    assert.equal(env.DATABASE_URL, 'exported-url')
    assert.equal(env.MIGRATE_DATABASE_URL, 'env-owner')
  })
})

test('--no-env-file does not read the .env', () => {
  withEnvFile('DATABASE_URL=env-url\nMIGRATE_DATABASE_URL=env-owner\n', root => {
    const env = resolveDbEnv(root, { DATABASE_URL: 'exported-url' }, { envFile: false })
    assert.equal(env.DATABASE_URL, 'exported-url')
    assert.equal(env.MIGRATE_DATABASE_URL, undefined)
    assert.equal(resolveDbEnv(root, {}, { envFile: false }).DATABASE_URL, undefined)
  })
})
