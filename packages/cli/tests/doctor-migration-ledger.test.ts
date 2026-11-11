import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkMigrationLedger } from '../src/doctor/checks/migration-ledger.js'

/** A project whose .env has DATABASE_URL, and a core whose check script prints `stdout` and exits with `code` (null: core has no script). */
async function doctor(code: number | null, stdout: unknown = '', env = 'DATABASE_URL=postgresql://u@127.0.0.1:5432/db\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-ledger-'))
  const core = path.join(dir, 'core')
  if (code !== null) {
    fs.mkdirSync(path.join(core, 'scripts/db'), { recursive: true })
    const text = typeof stdout === 'string' ? stdout : JSON.stringify(stdout)
    fs.writeFileSync(path.join(core, 'scripts/db/check-migration-ledger.mjs'), `console.log(${JSON.stringify(text)}); process.exit(${code})\n`)
  }
  fs.writeFileSync(path.join(dir, '.env'), env)
  const previous = process.cwd()
  const previousUrl = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  process.chdir(dir)
  try {
    return await checkMigrationLedger(core)
  } finally {
    process.chdir(previous)
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('doctor passes when the recorded migrations match the files (#428)', async () => {
  assert.deepEqual(await doctor(0, { edited: [], accept: [], renamed: [] }),
    { name: 'Migrations', status: 'pass', message: 'The recorded migrations match the files' })
})

test('doctor warns NS_MIGRATION_EDITED naming each edited file, with the statement that accepts them (#428)', async () => {
  const accept = `UPDATE "_migrations" SET content_hash = NULL WHERE filename IN ('017_x.sql');`
  const result = await doctor(0, { edited: [{ file: '017_x.sql', source: 'core' }, { file: '003_y.sql', source: 'project app' }], accept: [accept], renamed: [] })
  assert.equal(result.status, 'warn')
  assert.equal(result.code, 'NS_MIGRATION_EDITED')
  assert.match(result.message, /^NS_MIGRATION_EDITED: 017_x\.sql \(core\), 003_y\.sql \(project app\) changed after they were applied/)
  assert.match(result.fix ?? '', /new migration/)
  assert.ok((result.fix ?? '').includes(accept))
})

test('doctor fails NS_MIGRATION_RENAMED with the UPDATE that records the new name, ahead of an edit (#428)', async () => {
  const update = `UPDATE "_migrations" SET filename = '000_x.sql' WHERE filename = '001_x.sql';`
  const result = await doctor(0, {
    edited: [{ file: '017_x.sql', source: 'core' }], accept: ['x'],
    renamed: [{ from: '001_x.sql', to: '000_x.sql', source: 'core', update }],
  })
  assert.equal(result.status, 'fail')
  assert.equal(result.code, 'NS_MIGRATION_RENAMED')
  assert.match(result.message, /001_x\.sql is now 000_x\.sql \(core\); db:migrate would apply it again/)
  assert.equal(result.fix, `Record the new name: ${update}`)
})

test('doctor says nothing false when there is no database, the database cannot be read, or core has no check (#428)', async () => {
  assert.equal((await doctor(0, {}, '# nothing\n')).message, 'Not checked: DATABASE_URL not configured')
  const unreadable = await doctor(2, 'Could not read the recorded migrations: connection refused')
  assert.equal(unreadable.status, 'pass')
  assert.equal(unreadable.message, 'Not checked: Could not read the recorded migrations: connection refused')
  assert.match((await doctor(null)).message, /^Not checked/)
  // an exit 0 that is not the verdict (a crash prints something else) is not a finding
  assert.match((await doctor(0, 'something else')).message, /^Not checked/)
})
