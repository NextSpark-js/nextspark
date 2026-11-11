import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCli } from './built-cli.js'

/**
 * #429: --expect-database, --expect-host, --dry-run and --strict reach the runner from the built CLI, in the four
 * ways to spell db:migrate and db:seed. Port 1 refuses connections: an expectation that does not hold stops the
 * runner before it connects, which is all these tests need (the runs against a database are core's).
 */

const CORE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../core')
let CLI_ENTRY = ''
before(() => { CLI_ENTRY = buildCli() })

const URL_1 = 'postgres://appuser:s3cretpass@127.0.0.1:1/app'

async function run(args: string[]) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-expect-target-'))
  try {
    await mkdir(join(root, 'node_modules/@nextsparkjs'), { recursive: true })
    await symlink(CORE_ROOT, join(root, 'node_modules/@nextsparkjs/core'))
    await writeFile(join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '16.4.2' } }))
    const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
      cwd: root, timeout: 60_000, killSignal: 'SIGKILL', encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', DATABASE_URL: URL_1 },
    })
    return { status: result.status, out: `${result.stdout}${result.stderr}` }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

for (const command of [['db:migrate'], ['db:seed'], ['db', 'migrate'], ['db', 'seed']]) {
  test(`${command.join(' ')} --expect-database and --expect-host reach the runner, which stops before it connects (#429)`, async () => {
    const database = await run([...command, '--no-env-file', '--expect-database', 'other'])
    assert.notEqual(database.status, 0)
    assert.match(database.out, /--expect-database other: the connection points at database app \(expected other\)/)
    assert.doesNotMatch(database.out, /Migration error|ECONNREFUSED|s3cretpass/)

    const host = await run([...command, '--no-env-file', '--expect-host=db.example.com', '--dry-run'])
    assert.notEqual(host.status, 0)
    assert.match(host.out, /--expect-host db\.example\.com: the connection points at host 127\.0\.0\.1 \(expected db\.example\.com\)/)
  })

  test(`${command.join(' ')} --dry-run and --strict are options of the command (#429, #428)`, async () => {
    const help = await run([...command, '--help'])
    for (const option of ['--dry-run', '--expect-database <name>', '--expect-host <host>', '--strict']) assert.ok(help.out.includes(option), `${command.join(' ')} --help lists ${option}`)
    const dry = await run([...command, '--no-env-file', '--dry-run'])
    assert.match(dry.out, /Dry run against host 127\.0\.0\.1, database app: nothing will be written/)
    assert.doesNotMatch(dry.out, /Migrating host/)
  })
}
