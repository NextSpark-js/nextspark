import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BIN = path.join(PACKAGE_ROOT, 'bin/nextspark.js')

function runWithNodeVersion(version: string) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-node-version-'))
  const preload = path.join(directory, 'node-version.cjs')
  fs.writeFileSync(preload, `Object.defineProperty(process.versions, 'node', { value: ${JSON.stringify(version)} })`)
  try {
    return spawnSync(process.execPath, ['--require', preload, BIN], { encoding: 'utf8' })
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

test('the CLI rejects Node versions below 22.14.0 before loading its entry point', () => {
  for (const version of ['20.19.5', '22.12.0', '22.13.0']) {
    const result = runWithNodeVersion(version)
    assert.equal(result.status, 1, `${version}: ${result.stderr}`)
    assert.match(result.stderr, /requires Node\.js 22\.14\.0 or later/)
    assert.match(result.stderr, new RegExp(`Current version: ${version.replaceAll('.', '\\.')}`))
  }
})

test('the CLI lets Node 22.14.0 reach its entry point', () => {
  const result = runWithNodeVersion('22.14.0')
  assert.doesNotMatch(result.stderr, /requires Node\.js 22\.14\.0 or later/)
})
