import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import colors, { renderColorMarkers, stripColorMarkers } from '../src/utils/colors.js'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_ROOT = join(PACKAGE_ROOT, 'src')
const DIRECT_CHALK_ALLOWED = new Set(['utils/colors.ts', 'utils/shown-path.ts'])

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? typescriptFiles(path) : entry.isFile() && entry.name.endsWith('.ts') ? [path] : []
  })
}

test('only the color boundary imports chalk directly', () => {
  const directImports = typescriptFiles(SOURCE_ROOT)
    .filter((path) => /\bfrom\s+['"]chalk['"]|\bimport\s*['"]chalk['"]/.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SOURCE_ROOT, path))
    .filter((path) => !DIRECT_CHALK_ALLOWED.has(path))
    .sort()

  assert.deepEqual(directImports, [])
})

test('colors keep CLI styles as private markers until the output boundary', () => {
  const level = colors.level
  try {
    colors.level = 1

    const green = colors.green('✅ ok')
    assert.doesNotMatch(green, /\u001b/)
    assert.equal(stripColorMarkers(green), '✅ ok')
    assert.equal(renderColorMarkers(green), '\u001b[32m✅ ok\u001b[39m')
    assert.equal(
      renderColorMarkers(colors.bold.white('one\ntwo')),
      '\u001b[1m\u001b[37mone\u001b[39m\u001b[22m\n\u001b[1m\u001b[37mtwo\u001b[39m\u001b[22m'
    )

    const nested = colors.red(`before ${colors.red('inside')} after`)
    assert.equal(
      renderColorMarkers(nested),
      '\u001b[31mbefore \u001b[31minside\u001b[39m\u001b[31m after\u001b[39m'
    )
  } finally {
    colors.level = level
  }
})

test('colors are plain when the delegated chalk level is zero', () => {
  const level = colors.level
  try {
    colors.level = 0
    assert.equal(colors.cyan.bold('plain', 42), 'plain 42')
  } finally {
    colors.level = level
  }
})
