import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { verifyNoDevCredentials } from './verify-no-dev-credentials.mjs'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-dev-credentials-'))
  await mkdir(join(root, 'config'), { recursive: true })
  await mkdir(join(root, '.next', 'static', 'chunks'), { recursive: true })
  await writeFile(join(root, 'config', 'dev.config.ts'), `
    export const DEV_CONFIG_OVERRIDES = {
      devKeyring: { users: [{ email: 'fixture@example.test', password: 'fixture-password' }] },
      integration: { apiToken: 'fixture-token' },
    }
  `)
  return root
}

test('passes when fake production static assets omit development credentials', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, '.next', 'static', 'chunks', 'app.js'), 'console.log("safe asset")')

  assert.deepEqual(await verifyNoDevCredentials(root), { credentialsChecked: 3, staticFilesChecked: 1 })
})

test('fails when fake production static assets contain a development credential', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, '.next', 'static', 'chunks', 'app.js'), 'const leaked = "fixture-token"')

  await assert.rejects(
    verifyNoDevCredentials(root),
    (error) => error.message.includes('Dev credentials found in production static assets')
      && error.message.includes('.next/static/chunks/app.js')
      && !error.message.includes('fixture-token'),
  )
})
