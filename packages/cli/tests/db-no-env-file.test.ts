import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCli } from './built-cli.js'

/**
 * #420: `--no-env-file` keeps the project .env out of db:migrate and db:seed, as the built CLI. The entry point
 * used to load the .env into process.env before the option was read, so the file still reached the runner.
 * Port 1 refuses connections: the runner names its destination before it connects, which is all these tests read.
 */

const CORE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../core')
let CLI_ENTRY = ''
before(() => { CLI_ENTRY = buildCli() })

const ENV_URL = 'postgres://envuser:envpass@127.0.0.1:1/from_env_file'
const EXPORTED_URL = 'postgres://expuser:exppass@127.0.0.1:1/from_exported'

async function run(args: string[], exported: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-no-env-file-'))
  try {
    await mkdir(join(root, 'node_modules/@nextsparkjs'), { recursive: true })
    await symlink(CORE_ROOT, join(root, 'node_modules/@nextsparkjs/core'))
    await writeFile(join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '16.4.2' } }))
    await writeFile(join(root, '.env'), `DATABASE_URL=${ENV_URL}\n`)
    const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', ...exported }
    if (!exported.DATABASE_URL) delete env.DATABASE_URL
    const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], { cwd: root, timeout: 60_000, killSignal: 'SIGKILL', encoding: 'utf-8', env })
    return `${result.stdout}${result.stderr}`
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

for (const command of [['db:migrate'], ['db:seed'], ['db', 'migrate'], ['db', 'seed']]) {
  test(`${command.join(' ')} --no-env-file: a database only in the .env is not used`, async () => {
    const output = await run([...command, '--no-env-file'], {})
    assert.match(output, /DATABASE_URL not found/)
    assert.doesNotMatch(output, /from_env_file/)
  })

  test(`${command.join(' ')} --no-env-file: the exported database is used`, async () => {
    const output = await run([...command, '--no-env-file'], { DATABASE_URL: EXPORTED_URL })
    assert.match(output, /from_exported/)
    assert.doesNotMatch(output, /from_env_file/)
  })
}

test('without --no-env-file the .env still supplies the database, and an exported one still wins', async () => {
  assert.match(await run(['db:migrate'], {}), /from_env_file/)
  const output = await run(['db:seed'], { DATABASE_URL: EXPORTED_URL })
  assert.match(output, /from_exported/)
  assert.doesNotMatch(output, /from_env_file/)
})
