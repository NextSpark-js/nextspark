import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { checkDatabase, resolveDatabaseUrl } from '../src/doctor/checks/database.js'

function inProject(env: string, run: (dir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-db-'))
  fs.writeFileSync(path.join(dir, '.env'), env)
  return run(dir).finally(() => fs.rmSync(dir, { recursive: true, force: true }))
}

test('doctor reads the DATABASE_URL db:migrate would use: the exported one beats the .env', () =>
  inProject('DATABASE_URL=postgres://localhost/from_env\n', async dir => {
    assert.equal(await resolveDatabaseUrl(dir, { DATABASE_URL: 'postgres://localhost/exported' }), 'postgres://localhost/exported')
    assert.equal(await resolveDatabaseUrl(dir, {}), 'postgres://localhost/from_env')
  }))

test('doctor judges the exported DATABASE_URL, not the .env one', () =>
  inProject('DATABASE_URL=https://example.test/placeholder\n', async dir => {
    const previousCwd = process.cwd()
    const previous = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgres://localhost/real'
    process.chdir(dir)
    try {
      assert.equal((await checkDatabase()).status, 'pass')
    } finally {
      process.chdir(previousCwd)
      if (previous === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = previous
    }
  }))

test('doctor does not ask for a .env file when DATABASE_URL is exported', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-db-'))
  const previousCwd = process.cwd()
  const previous = process.env.DATABASE_URL
  process.chdir(dir)
  try {
    delete process.env.DATABASE_URL
    const without = await checkDatabase()
    assert.equal(without.status, 'warn')
    assert.equal(without.message, 'No .env file found')

    process.env.DATABASE_URL = 'postgres://localhost/real'
    const exported = await checkDatabase()
    assert.equal(exported.status, 'pass', exported.message)
  } finally {
    process.chdir(previousCwd)
    if (previous === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previous
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
