import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildCli } from './built-cli.js'

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
let CLI_ENTRY = ''
before(() => { CLI_ENTRY = buildCli() })

function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-add-plugin-'))
  for (const [file, content] of Object.entries(files)) writeFileSync(join(root, file), content)
  return root
}

function cli(cwd: string, args: string[]) {
  // Port 9 refuses connections: npm pack fails at once, after add:plugin named what it downloads
  const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], { cwd, encoding: 'utf8', timeout: 60_000, env: { ...process.env, FORCE_COLOR: '0', npm_config_registry: 'http://127.0.0.1:9', npm_config_fetch_retries: '0' } })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

// #474: the root program took --version after the subcommand, printed the CLI version and exited 0 without adding anything
test('add:plugin --version <x> asks for that version of the plugin instead of printing the CLI version and exiting 0 (#474)', (t) => {
  const root = project({ 'nextspark.config.ts': 'export default { plugins: [] }\n', 'package.json': '{}\n' })
  t.after(() => rmSync(root, { recursive: true, force: true }))

  for (const flag of ['--version', '-v']) {
    const result = cli(root, ['add:plugin', '@nextsparkjs/plugin-example', flag, '9.9.9', '--force'])
    assert.notEqual(result.status, 0, result.output)
    assert.match(result.output, /Downloading @nextsparkjs\/plugin-example@9\.9\.9/)
    assert.notEqual(result.output.trim(), VERSION)
  }
})

test('a subcommand without a --version option rejects it, and nextspark --version still prints the CLI version (#474)', (t) => {
  const root = project({})
  t.after(() => rmSync(root, { recursive: true, force: true }))

  const rejected = cli(root, ['doctor', '--version'])
  assert.equal(rejected.status, 1, rejected.output)
  assert.match(rejected.output, /unknown option '--version'/)

  for (const flag of ['--version', '-V']) {
    const printed = cli(root, [flag])
    assert.equal(printed.status, 0, printed.output)
    assert.equal(printed.output.trim(), VERSION)
  }
})
