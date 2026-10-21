/**
 * #326: a preset's `payload` literal is parsed as a literal, not rewritten with regular expressions, so a
 * `:` inside a string survives, and a payload that cannot be parsed fails the build with file:line
 * instead of becoming `{}`.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/api-preset-payload.test.mjs
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import { discoverApiPresets } from '../discovery/api-presets.mjs'
import { silenceConsoleOutput } from './quiet-console.mjs'

silenceConsoleOutput()

const file = body =>
  `export default defineApiEndpoint({\n  endpoint: '/api/x',\n  summary: 'S',\n  presets: [\n    {\n      id: 'a',\n      title: 'A',\n      method: 'POST',\n${body}\n    }\n  ]\n})\n`

async function discover(presetsTs) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-preset-payload-'))
  try {
    await mkdir(dirname(join(root, 'api/x/presets.ts')), { recursive: true })
    await writeFile(join(root, 'api/x/presets.ts'), presetsTs)
    const { presets } = await discoverApiPresets({ projectRoot: root, projectSourceDir: root, projectName: 'p', coreDir: join(root, 'core') })
    return presets[0]?.presets[0]
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('a colon inside a string survives (URLs, times, model tags)', async () => {
  const preset = await discover(file(`      payload: { url: 'http://x.test:8080/a?b=c', at: "10:30", model: \`llama3.2:3b\` }`))
  assert.deepEqual(preset.payload, { url: 'http://x.test:8080/a?b=c', at: '10:30', model: 'llama3.2:3b' })
})

test('single, double and backtick quotes, quoted keys, escapes, comments and trailing commas', async () => {
  const preset = await discover(
    file(`      payload: {
        // a comment with a: colon
        'single': 'it\\'s',
        "double": "say \\"hi\\"",
        tick: \`no interpolation\`,
        /* block: comment */
        n: -1.5, ok: true, nothing: null,
      },`)
  )
  assert.deepEqual(preset.payload, { single: "it's", double: 'say "hi"', tick: 'no interpolation', n: -1.5, ok: true, nothing: null })
})

test('nested objects and arrays, with braces and brackets inside strings', async () => {
  const preset = await discover(file(`      payload: { a: { b: [1, { c: 'x}y' }, ['z]']], d: [] }, e: {} }`))
  assert.deepEqual(preset.payload, { a: { b: [1, { c: 'x}y' }, ['z]']], d: [] }, e: {} })
})

test('a preset without a payload still builds', async () => {
  const preset = await discover(file(`      tags: ['t']`))
  assert.equal(preset.id, 'a')
  assert.equal('payload' in preset, false)
})

test('a payload that cannot be parsed fails the build naming file and line', async () => {
  // line 11 of the file: the `bad` value
  await assert.rejects(
    discover(file(`      payload: {\n        ok: 1,\n        bad: someVariable\n      }`)),
    error => /api\/x\/presets\.ts:11: cannot parse the preset payload/.test(error.message)
  )
  await assert.rejects(discover(file('      payload: { t: `a ${b}` }')), /template literal with interpolation/)
  await assert.rejects(discover(file(`      payload: { s: 'unterminated }`)), /unterminated string/)
})
