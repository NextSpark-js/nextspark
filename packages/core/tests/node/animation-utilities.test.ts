/**
 * The core components use animate-in, fade-in-0, zoom-in-95 and slide-in-from-* (#383). Those utilities are
 * defined by tw-animate-css, which styles/utilities.css imports, so core has to declare it: a generated
 * project imports utilities.css and resolves the package from core.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('utilities.css imports tw-animate-css and core declares it as a dependency', () => {
  const css = fs.readFileSync(path.join(CORE_DIR, 'styles/utilities.css'), 'utf8')
  assert.match(css, /@import "tw-animate-css";/)
  const pkg = JSON.parse(fs.readFileSync(path.join(CORE_DIR, 'package.json'), 'utf8'))
  assert.ok(pkg.dependencies['tw-animate-css'])
})
