/**
 * The API explorer's editor crashes when two copies of @codemirror/state load (#384). Core declares
 * @codemirror/state and @codemirror/commands with the ranges @uiw/react-codemirror expects, so the
 * package manager resolves one copy of each.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))
const core = read(path.join(CORE_DIR, 'package.json'))
const uiw = read(path.join(CORE_DIR, 'node_modules/@uiw/react-codemirror/package.json'))

for (const pkg of ['@codemirror/state', '@codemirror/commands']) {
  test(`core declares ${pkg} with the range @uiw/react-codemirror expects`, () => {
    const expected = uiw.dependencies?.[pkg] ?? uiw.peerDependencies?.[pkg]
    assert.ok(expected, `@uiw/react-codemirror no longer lists ${pkg}`)
    assert.equal(core.dependencies[pkg], expected)
  })
}
