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

async function run(args: string[], exported: Record<string, string>, local?: string) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-no-env-file-'))
  try {
    await mkdir(join(root, 'node_modules/@nextsparkjs'), { recursive: true })
    await symlink(CORE_ROOT, join(root, 'node_modules/@nextsparkjs/core'))
    await writeFile(join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '16.4.2' } }))
    await writeFile(join(root, '.env'), `DATABASE_URL=${ENV_URL}\n`)
    if (local !== undefined) await writeFile(join(root, '.env.local'), local)
    const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', ...exported }
    if (!exported.DATABASE_URL) delete env.DATABASE_URL
    if (!exported.NODE_ENV) delete env.NODE_ENV
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

  test(`${command.join(' ')} --legacy-theme reaches the runner (#424)`, async () => {
    // a name the runner refuses proves the flag got there
    const output = await run([...command, '--no-env-file', '--legacy-theme=-bad'], { DATABASE_URL: EXPORTED_URL })
    assert.match(output, /--legacy-theme needs the name of the theme the project was migrated from/)
  })

  test(`${command.join(' ')} --no-env-file: the exported database is used`, async () => {
    const output = await run([...command, '--no-env-file'], { DATABASE_URL: EXPORTED_URL })
    assert.match(output, /from_exported/)
    assert.doesNotMatch(output, /from_env_file/)
  })
}

// #438: the CLI loads .env.local before .env, as Next.js does, and no .env.local with NODE_ENV=test
const LOCAL_URL = 'postgres://localuser:localpass@127.0.0.1:1/from_env_local'

test('db:migrate takes the database from .env.local over .env, and an exported one still wins', async () => {
  const output = await run(['db:migrate'], {}, `DATABASE_URL=${LOCAL_URL}\n`)
  assert.match(output, /from_env_local/)
  assert.doesNotMatch(output, /from_env_file/)
  const exported = await run(['db:migrate'], { DATABASE_URL: EXPORTED_URL }, `DATABASE_URL=${LOCAL_URL}\n`)
  assert.match(exported, /from_exported/)
  assert.doesNotMatch(exported, /from_env_local/)
})

test('with NODE_ENV=test, db:migrate ignores .env.local, as Next.js does', async () => {
  const output = await run(['db:migrate'], { NODE_ENV: 'test' }, `DATABASE_URL=${LOCAL_URL}\n`)
  assert.match(output, /from_env_file/)
  assert.doesNotMatch(output, /from_env_local/)
})

test('--no-env-file keeps .env.local out too', async () => {
  const output = await run(['db:migrate', '--no-env-file'], {}, `DATABASE_URL=${LOCAL_URL}\n`)
  assert.match(output, /DATABASE_URL not found/)
  assert.doesNotMatch(output, /from_env_local/)
})

test('without --no-env-file the .env still supplies the database, and an exported one still wins', async () => {
  assert.match(await run(['db:migrate'], {}), /from_env_file/)
  const output = await run(['db:seed'], { DATABASE_URL: EXPORTED_URL })
  assert.match(output, /from_exported/)
  assert.doesNotMatch(output, /from_env_file/)
})
