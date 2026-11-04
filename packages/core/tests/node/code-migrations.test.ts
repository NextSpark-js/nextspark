/**
 * The project-code rewrites update-core runs for a release (scripts/maintenance/code-migrations.mjs).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { CODE_MIGRATIONS, findNextThemesImports, nextThemesLines, projectSourceFiles, rewriteNextThemesImports } from '../../scripts/maintenance/code-migrations.mjs'

const CORE = '@nextsparkjs/core/providers/theme-provider'

test('the named imports and re-exports of next-themes that core exports point at core, in every quoting and form', () => {
  const cases: Array<[string, string]> = [
    ["import { useTheme } from 'next-themes'", `import { useTheme } from '${CORE}'`],
    ['import { useTheme } from "next-themes"', `import { useTheme } from "${CORE}"`],
    ["import { ThemeProvider as Provider, useTheme } from 'next-themes'", `import { ThemeProvider as Provider, useTheme } from '${CORE}'`],
    ["import type { ThemeProviderProps } from 'next-themes'", `import type { ThemeProviderProps } from '${CORE}'`],
    ["import { type UseThemeProps, useTheme } from 'next-themes'", `import { type UseThemeProps, useTheme } from '${CORE}'`],
    ["export { useTheme } from 'next-themes'", `export { useTheme } from '${CORE}'`],
    ["import {\n  useTheme,\n  ThemeProvider,\n} from 'next-themes'", `import {\n  useTheme,\n  ThemeProvider,\n} from '${CORE}'`],
  ]
  for (const [before, after] of cases) {
    const result = rewriteNextThemesImports(before)
    assert.equal(result.text, after, before)
    assert.equal(result.leftover, false, before)
  }
})

test('a name core does not export, a default or namespace import, import() and require() stay, and are reported', () => {
  for (const text of [
    "import { useTheme, somethingElse } from 'next-themes'",
    "import NextThemes from 'next-themes'",
    "import * as themes from 'next-themes'",
    "const m = await import('next-themes')",
    "const { useTheme } = require('next-themes')",
    "import 'next-themes'",
  ]) {
    const result = rewriteNextThemesImports(text)
    assert.equal(result.text, text, text)
    assert.equal(result.leftover, true, text)
  }
  assert.deepEqual(rewriteNextThemesImports("import { useTheme } from 'next-themes-plus'"), { text: "import { useTheme } from 'next-themes-plus'", leftover: false })
})

test('a comment, a JSDoc, a string or a template literal that mentions an import of next-themes is not code: not rewritten, not reported', () => {
  for (const text of [
    "// import { useTheme } from 'next-themes'\n",
    "/**\n * import { useTheme } from 'next-themes'\n */\n",
    "const example = \"import { useTheme } from 'next-themes'\"\n",
    "const doc = `import { useTheme } from 'next-themes'`\n",
  ]) {
    const result = rewriteNextThemesImports(text)
    assert.equal(result.text, text, text)
    assert.equal(result.leftover, false, text)
    assert.deepEqual(nextThemesLines(text), [], text)
  }
  // An indented statement is still one
  assert.equal(rewriteNextThemesImports("  import { useTheme } from 'next-themes'").text, `  import { useTheme } from '${CORE}'`)
})

test('the codemod and the CLI look at the same files: every code extension, not tests, declarations, generated or installed code', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-migrations-files-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const load = "import { useTheme } from 'next-themes'\n"
  const looked = ['a.ts', 'b.tsx', 'c.js', 'd.jsx', 'e.mjs', 'f.cjs', 'g.mts', 'h.cts'].map((file) => `lib/${file}`)
  const skipped = ['lib/a.test.ts', 'lib/b.spec.tsx', 'lib/c.stories.tsx', 'lib/d.d.ts', 'tests/e.ts', 'cypress/f.ts', 'public/g.js', 'src/app/h.tsx', 'node_modules/x/i.js', '.next/j.js', 'lib/readme.md']
  for (const file of [...looked, ...skipped]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), load)
  }
  assert.deepEqual(projectSourceFiles(root).sort(), looked.sort())
  assert.deepEqual(findNextThemesImports(root).sort(), looked.map((file) => `${file}:1`).sort())
})

test('the 0.1.0-beta.200 migration rewrites project code only, is idempotent, and says what it left', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-migrations-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const files: Record<string, string> = {
    'components/Navbar.tsx': "'use client'\nimport { useTheme } from 'next-themes'\n",
    'lib/theme.ts': 'export { useTheme, type UseThemeProps } from "next-themes"\n',
    'lib/other.ts': "import { useTheme, somethingElse } from 'next-themes'\n",
    'node_modules/pkg/index.js': "import { useTheme } from 'next-themes'\n",
    'src/app/generated.tsx': "import { useTheme } from 'next-themes'\n",
    '.next/server/page.js': "import { useTheme } from 'next-themes'\n",
    'components/plain.tsx': 'export const x = 1\n',
  }
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), content)
  }
  const migration = CODE_MIGRATIONS.find((entry: { version: string }) => entry.version === '0.1.0-beta.200')
  const first = migration.run(root, { dependencies: { 'next-themes': '^0.4.6' } })
  assert.deepEqual([...first.changed].sort(), ['components/Navbar.tsx', 'lib/theme.ts'])
  assert.equal(fs.readFileSync(path.join(root, 'components/Navbar.tsx'), 'utf8'), `'use client'\nimport { useTheme } from '${CORE}'\n`)
  for (const untouched of ['lib/other.ts', 'node_modules/pkg/index.js', 'src/app/generated.tsx', '.next/server/page.js']) {
    assert.equal(fs.readFileSync(path.join(root, untouched), 'utf8'), files[untouched], untouched)
  }
  assert.match(first.notes.join('\n'), /not rewritten.*lib\/other\.ts/)

  const second = migration.run(root, {})
  assert.deepEqual(second.changed, [])

  // With nothing left, a declared next-themes is pointed out, not removed
  fs.writeFileSync(path.join(root, 'lib/other.ts'), 'export {}\n')
  const third = migration.run(root, { dependencies: { 'next-themes': '^0.4.6' } })
  assert.deepEqual(third.changed, [])
  assert.match(third.notes.join('\n'), /package\.json declares next-themes.*pnpm remove next-themes/)
})

test('run from the project, the module applies the migrations of the version it is given', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-migrations-cli-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'components'))
  fs.writeFileSync(path.join(root, 'components/Navbar.tsx'), "import { useTheme } from 'next-themes'\n")
  fs.writeFileSync(path.join(root, 'package.json'), '{}\n')
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/maintenance/code-migrations.mjs')
  const ran = spawnSync(process.execPath, [script, '0.1.0-beta.200'], { cwd: root, encoding: 'utf8' })
  assert.equal(ran.status, 0, ran.stderr)
  assert.match(ran.stdout, /^0\.1\.0-beta\.200: .*\n {2}components\/Navbar\.tsx\n/)
  assert.equal(fs.readFileSync(path.join(root, 'components/Navbar.tsx'), 'utf8'), `import { useTheme } from '${CORE}'\n`)
  const unknown = spawnSync(process.execPath, [script, '0.1.0-beta.1'], { cwd: root, encoding: 'utf8' })
  assert.equal(unknown.status, 1)
  assert.match(unknown.stderr, /No code migration for 0\.1\.0-beta\.1/)
})
