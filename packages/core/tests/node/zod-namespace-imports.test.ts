/**
 * Turbopack does not tree-shake zod's named `z` export: `import { z } from 'zod'` puts all of zod, its locales
 * included, in every client bundle that reaches the module (the 0.1.0-beta.192 candidate shipped ~260 kB more raw zod on entity pages for three
 * such imports in lib/entities/portable). Core's sources, and the portable modules `prepare` copies into a project's
 * contracts package, import the namespace. The repository's ESLint rule says the same; this runs where lint does not.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const NAMED_Z = /(?:import|export)\s*(?:type\s*)?\{[^}]*\bz\b[^}]*\}\s*from\s*['"]zod['"]/

function* sources(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* sources(file)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) yield file
  }
}

test('core and the contracts schema modules import zod as a namespace', () => {
  const offenders = [path.join(REPO, 'packages/core/src'), path.join(REPO, 'packages/contracts/src/schema')]
    .flatMap(dir => [...sources(dir)])
    .filter(file => NAMED_Z.test(fs.readFileSync(file, 'utf8')))
    .map(file => path.relative(REPO, file))
  assert.deepEqual(offenders, [], "use `import * as z from 'zod'`")
})

test('the check recognises the named import forms', () => {
  for (const text of ["import { z } from 'zod'", 'import { z, ZodError } from "zod"', "export { z } from 'zod'", "import { ZodType, z as zod } from 'zod'"]) {
    assert.match(text, NAMED_Z, text)
  }
  for (const text of ["import * as z from 'zod'", "import { ZodError } from 'zod'", "import { z } from 'zod/v4/core'"]) {
    assert.doesNotMatch(text, NAMED_Z, text)
  }
})
