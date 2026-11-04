import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildCli } from './built-cli.js'

let CLI_ENTRY = ''
before(() => { CLI_ENTRY = buildCli() })

// An empty project: several checks fail or warn, each with a fix line.
function doctorOutput(): string[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-out-'))
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{}')
    const run = spawnSync(process.execPath, [CLI_ENTRY, 'doctor'], { cwd: dir, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } })
    return run.stdout.split('\n')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('the built doctor prints its report once (#394)', () => {
  const lines = doctorOutput()
  assert.equal(lines.filter(line => line.includes('NextSpark Health Check')).length, 1)
  assert.equal(lines.filter(line => line.startsWith('Summary:')).length, 1)
})

test('a finding with a fix prints as two lines, not as a quoted string with a literal \\n (#394)', () => {
  const lines = doctorOutput()
  assert.ok(lines.some(line => line.startsWith('✗ Dependencies')), 'the finding is a plain line')
  assert.ok(lines.some(line => /^\s+→ Run: pnpm install/.test(line)), 'its fix is a line of its own')
  assert.equal(lines.filter(line => line.startsWith('"') || line.includes('\\n')).length, 0)
})
