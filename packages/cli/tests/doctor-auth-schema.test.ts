import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkAuthSchema } from '../src/doctor/checks/auth-schema.js'

/** A project whose .env has DATABASE_URL, and a core whose check script prints the URL's tail and exits with `code`. */
async function doctor(code: number | null, env = 'DATABASE_URL=postgresql://u@127.0.0.1:5432/db\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-auth-'))
  const core = path.join(dir, 'core')
  if (code !== null) {
    fs.mkdirSync(path.join(core, 'scripts/db'), { recursive: true })
    fs.writeFileSync(path.join(core, 'scripts/db/check-auth-schema.mjs'),
      `console.log('report for ' + process.env.DATABASE_URL.split('/').pop()); process.exit(${code})\n`)
  }
  fs.writeFileSync(path.join(dir, '.env'), env)
  const previous = process.cwd()
  const previousUrl = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  process.chdir(dir)
  try {
    return await checkAuthSchema(core)
  } finally {
    process.chdir(previous)
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('doctor passes, fails or warns on the exit code of core\'s auth schema check, with its report', async () => {
  assert.deepEqual(await doctor(0), { name: 'Auth schema', status: 'pass', message: 'report for db' })
  const failed = await doctor(1)
  assert.equal(failed.status, 'fail')
  assert.equal(failed.message, 'report for db')
  assert.match(failed.fix ?? '', /db:migrate/)
  const unreachable = await doctor(2)
  assert.equal(unreachable.status, 'warn')
  assert.equal(unreachable.message, 'Not checked: report for db')
})

test('doctor warns when core has no auth schema check or DATABASE_URL is not set', async () => {
  assert.equal((await doctor(null)).status, 'warn')
  assert.match((await doctor(null)).message, /does not check the auth tables/)
  assert.equal((await doctor(0, '# nothing\n')).message, 'Not checked: DATABASE_URL not configured')
})
