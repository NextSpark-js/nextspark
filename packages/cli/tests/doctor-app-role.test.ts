import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkAppRole } from '../src/doctor/checks/app-role.js'

/** A project whose .env has DATABASE_URL, and a core whose check script prints `lines` and exits with `code` (null: core has no script). */
async function doctor(code: number | null, lines: string[] = [], env = 'DATABASE_URL=postgresql://u@127.0.0.1:5432/db\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-role-'))
  const core = path.join(dir, 'core')
  if (code !== null) {
    fs.mkdirSync(path.join(core, 'scripts/db'), { recursive: true })
    fs.writeFileSync(path.join(core, 'scripts/db/check-app-role.mjs'),
      `console.log(${JSON.stringify(lines.join('\n'))}); process.exit(${code})\n`)
  }
  fs.writeFileSync(path.join(dir, '.env'), env)
  const previous = process.cwd()
  const previousUrl = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  process.chdir(dir)
  try {
    return await checkAppRole(core)
  } finally {
    process.chdir(previous)
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('doctor warns NS_APP_ROLE_NOT_AUTHENTICATED with the GRANT for a superuser, and passes once it is granted (#393)', async () => {
  const grant = 'GRANT authenticated TO nextspark_app WITH INHERIT TRUE;'
  const missing = await doctor(1, ['nextspark_app is not a member of authenticated', grant])
  assert.equal(missing.status, 'warn')
  assert.equal(missing.code, 'NS_APP_ROLE_NOT_AUTHENTICATED')
  assert.equal(missing.message, 'NS_APP_ROLE_NOT_AUTHENTICATED: nextspark_app is not a member of authenticated')
  assert.equal(missing.fix, `As a superuser, run: ${grant}`)
  assert.deepEqual(await doctor(0, ['nextspark_app inherits the policies of authenticated']),
    { name: 'App role', status: 'pass', message: 'nextspark_app inherits the policies of authenticated' })
})

test('doctor says nothing false when there is no database, no role to check, or the database cannot be read (#393)', async () => {
  assert.equal((await doctor(0, ['x'], '# nothing\n')).status, 'pass')
  assert.equal((await doctor(0, ['No nextspark_app role: nothing to check'])).status, 'pass')
  const unreadable = await doctor(2, ['Could not read the roles: connection refused'])
  assert.equal(unreadable.status, 'pass')
  assert.equal(unreadable.message, 'Not checked: Could not read the roles: connection refused')
  const old = await doctor(null)
  assert.equal(old.status, 'pass')
  assert.match(old.message, /^Not checked/)
})
