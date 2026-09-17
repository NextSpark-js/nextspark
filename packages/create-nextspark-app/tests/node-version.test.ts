import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BINS = [
  path.join(PACKAGE_ROOT, 'bin/index.js'),
  path.join(PACKAGE_ROOT, 'create-nextspark/bin/create-nextspark-app.js'),
]

function runWithNodeVersion(bin: string, version: string) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'create-nextspark-node-version-'))
  const preload = path.join(directory, 'node-version.cjs')
  fs.writeFileSync(preload, `Object.defineProperty(process.versions, 'node', { value: ${JSON.stringify(version)} })`)
  try {
    return spawnSync(process.execPath, ['--require', preload, bin], { encoding: 'utf8' })
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

test('create-nextspark executables reject Node versions below 22.14.0 before loading their entries', () => {
  for (const bin of BINS) {
    for (const version of ['20.19.5', '22.12.0', '22.13.0']) {
      const result = runWithNodeVersion(bin, version)
      assert.equal(result.status, 1, `${path.basename(bin)} on ${version}: ${result.stderr}`)
      assert.match(result.stderr, /requires Node\.js 22\.14\.0 or later/)
      assert.match(result.stderr, new RegExp(`Current version: ${version.replaceAll('.', '\\.')}`))
    }
  }
})

test('create-nextspark executables let Node 22.14.0 reach their entries', () => {
  for (const bin of BINS) {
    const result = runWithNodeVersion(bin, '22.14.0')
    assert.doesNotMatch(result.stderr, /requires Node\.js 22\.14\.0 or later/, path.basename(bin))
  }
})
