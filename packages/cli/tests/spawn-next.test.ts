import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { nextCommand, spawnNext } from '../src/utils/spawn-next.js'

// The arguments are the user's own, forwarded to Next verbatim. A shell would
// split this one at the ampersand and background the rest.
const AWKWARD = 'https://trace.invalid/upload?run=1&team=alpha'

/** A project whose `next` entry prints the arguments it got, one JSON line. */
function projectWithFakeNext(): string {
  const root = mkdtempSync(join(tmpdir(), 'spawn-next-'))
  const bin = join(root, 'node_modules', 'next', 'dist', 'bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"name":"p"}')
  writeFileSync(join(root, 'node_modules', 'next', 'package.json'), '{"name":"next","version":"0.0.0"}')
  writeFileSync(join(bin, 'next'), 'console.log(JSON.stringify({ argv: process.argv.slice(2) }))')
  return root
}

test('runs the project\'s own next with the arguments untouched, no shell', async () => {
  const root = projectWithFakeNext()
  try {
    const child = spawnNext(root, ['build', '--experimental-upload-trace', AWKWARD], { stdio: ['ignore', 'pipe', 'inherit'] })
    let out = ''
    child.stdout?.on('data', (chunk) => { out += chunk })
    await new Promise((resolve) => child.on('close', resolve))

    const seen = JSON.parse(out)
    assert.deepEqual(seen.argv, ['build', '--experimental-upload-trace', AWKWARD])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a project without next fails with an error that says so', () => {
  const root = mkdtempSync(join(tmpdir(), 'spawn-next-'))
  try {
    writeFileSync(join(root, 'package.json'), '{"name":"p"}')
    assert.throws(() => nextCommand(root), /Next\.js is not installed in .*pnpm install/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('off Windows the project\'s linked node_modules/.bin/next wins over the JS entry', { skip: process.platform === 'win32' }, () => {
  const root = projectWithFakeNext()
  try {
    mkdirSync(join(root, 'node_modules', '.bin'))
    writeFileSync(join(root, 'node_modules', '.bin', 'next'), '#!/bin/sh\n', { mode: 0o755 })

    assert.deepEqual(nextCommand(root), { command: join(root, 'node_modules', '.bin', 'next'), args: [] })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
