import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import net from 'node:net'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { blocking, countByImpact, rowsFromAxe } from './axe-scan.mjs'

const results = {
  violations: [
    { id: 'button-name', impact: 'critical', help: 'Buttons must have discernible text', tags: ['wcag2a'], nodes: [{ target: ['#a'], html: '<button>', failureSummary: 's' }] },
    { id: 'color-contrast', impact: 'serious', help: 'contrast', tags: ['wcag2aa'], nodes: [{ target: ['#b'], html: '<div>', failureSummary: 's' }, { target: ['#c'], html: '<div>', failureSummary: 's' }] },
    { id: 'region', impact: 'moderate', help: 'region', tags: ['best-practice'], nodes: [{ target: ['#d'], html: '<p>', failureSummary: 's' }] },
    { id: 'heading-order', impact: 'serious', help: 'headings', tags: ['best-practice'], nodes: [{ target: ['#e'], html: '<h3>', failureSummary: 's' }] },
  ],
}

test('one row per failing node, tagged WCAG or best-practice', () => {
  const rows = rowsFromAxe('/p', results)
  assert.equal(rows.length, 5)
  assert.deepEqual(rows.map((r) => r.wcag), [true, true, true, false, false])
})

test('only WCAG rows with a failing impact block', () => {
  const rows = rowsFromAxe('/p', results)
  assert.deepEqual(blocking(rows, ['serious', 'critical']).map((r) => r.target), ['#a', '#b', '#c'])
  assert.deepEqual(blocking(rows, ['critical']).map((r) => r.target), ['#a'])
  assert.equal(blocking(rows, []).length, 0)
})

test('counts by impact include every impact', () => {
  assert.deepEqual(countByImpact(rowsFromAxe('/p', results)), { critical: 1, serious: 3, moderate: 1, minor: 0 })
})

// Exit codes: 0 clean, 1 violations, 2 anything that stops the scan from running. CI reads 1 as "serious findings".
const script = fileURLToPath(new URL('./axe-scan.mjs', import.meta.url))
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })

test('a missing --app exits 2', () => {
  assert.equal(run().status, 2)
})

test('an --app that is not a built project exits 2, not 1', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'axe-scan-'))
  assert.equal(run('--app', dir, '--port', '39420').status, 2)
})

test('a busy port for the Resend stand-in exits 2, not 1', async () => {
  const busy = net.createServer()
  await new Promise((resolve) => busy.listen(39431, '127.0.0.1', resolve))
  try {
    const dir = mkdtempSync(path.join(tmpdir(), 'axe-scan-'))
    const result = run('--app', dir, '--port', '39430')
    assert.equal(result.status, 2)
    assert.match(result.stderr, /EADDRINUSE/)
  } finally {
    busy.close()
  }
})
