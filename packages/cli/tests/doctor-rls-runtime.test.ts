import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkRlsRuntime } from '../src/doctor/checks/rls-runtime.js'

/** A project whose .env has DATABASE_URL, and a core whose check script prints the URL's tail and exits with `code`. */
async function doctor(code: number | null, env = 'DATABASE_URL=postgresql://u@127.0.0.1:5432/db\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-rls-'))
  const core = path.join(dir, 'core')
  if (code !== null) {
    fs.mkdirSync(path.join(core, 'scripts/db'), { recursive: true })
    fs.writeFileSync(path.join(core, 'scripts/db/check-rls-runtime.mjs'),
      `console.log('report for\\n  ' + process.env.DATABASE_URL.split('/').pop()); process.exit(${code})\n`)
  }
  fs.writeFileSync(path.join(dir, '.env'), env)
  const previous = process.cwd()
  const previousUrl = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  process.chdir(dir)
  try {
    return await checkRlsRuntime(core)
  } finally {
    process.chdir(previous)
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('doctor passes when RLS applies, warns with the cutover fix when the role skips it, and warns when not checked', async () => {
  assert.deepEqual(await doctor(0), { name: 'Row-level security', status: 'pass', message: 'report for db' })
  const bypassed = await doctor(1)
  assert.equal(bypassed.status, 'warn')
  assert.equal(bypassed.message, 'report for db')
  assert.match(bypassed.fix ?? '', /nextspark_app/)
  const unreadable = await doctor(2)
  assert.equal(unreadable.status, 'warn')
  assert.equal(unreadable.message, 'Not checked: report for db')
})

test('doctor warns when core has no RLS check or DATABASE_URL is not set', async () => {
  assert.match((await doctor(null)).message, /does not check the database role/)
  assert.equal((await doctor(0, '# nothing\n')).message, 'Not checked: DATABASE_URL not configured')
})
