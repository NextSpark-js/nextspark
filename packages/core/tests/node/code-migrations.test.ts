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

import { CODE_MIGRATIONS, classifyMainLayout, findNextThemesImports, nextThemesLines, projectSourceFiles, rewriteNextThemesImports } from '../../scripts/maintenance/code-migrations.mjs'

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
    "// const m = await import('next-themes')\n",
    "/* require('next-themes') */\n",
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

test('a directory or a file the project cannot read is skipped: the walk, the report and the migration do not throw', { skip: process.getuid?.() === 0 ? 'root reads every file' : false }, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-migrations-unreadable-'))
  const locked = path.join(root, 'pgdata')
  const lockedFile = path.join(root, 'lib', 'locked.ts')
  fs.mkdirSync(locked)
  fs.writeFileSync(path.join(locked, 'inside.ts'), "import { useTheme } from 'next-themes'\n")
  fs.mkdirSync(path.join(root, 'lib'))
  fs.writeFileSync(lockedFile, "import { useTheme } from 'next-themes'\n")
  fs.writeFileSync(path.join(root, 'lib', 'open.ts'), "import { useTheme } from 'next-themes'\n")
  fs.chmodSync(locked, 0o000)
  fs.chmodSync(lockedFile, 0o000)
  t.after(() => {
    fs.chmodSync(locked, 0o755)
    fs.chmodSync(lockedFile, 0o644)
    fs.rmSync(root, { recursive: true, force: true })
  })
  assert.deepEqual(projectSourceFiles(root).sort(), ['lib/locked.ts', 'lib/open.ts'])
  assert.deepEqual(findNextThemesImports(root), ['lib/open.ts:1'])
  const migration = CODE_MIGRATIONS.find((entry: { version: string }) => entry.version === '0.1.0-beta.200')
  assert.deepEqual(migration.run(root, {}).changed, ['lib/open.ts'])
})

// #417: the dashboard layout of a crm or productivity project that does not fill the client entity registry
const MAIN_LAYOUT = 'templates/dashboard/(main)/layout.tsx'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES = path.resolve(HERE, '../../templates/projects')
const entityRegistryMigration = () => CODE_MIGRATIONS.find((entry: { version: string }) => entry.version === '0.1.0-beta.202')
const templateFile = (template: string, file: string) => fs.readFileSync(path.join(TEMPLATES, template, 'templates', file), 'utf8')
/** The layouts the templates published before the fix, as they were */
const oldLayout = (name: string) => fs.readFileSync(path.join(HERE, 'fixtures/old-dashboard-layouts', `${name}.txt`), 'utf8')

function project(t: { after: (fn: () => void) => void }, files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-migrations-layout-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), content)
  }
  return root
}

test('classifyMainLayout: only a client layout without the hydrator needs anything, and only the published texts are replaced', () => {
  assert.equal(classifyMainLayout(templateFile('crm', 'dashboard/(main)/layout.tsx')).kind, 'ok')
  assert.equal(classifyMainLayout(templateFile('productivity', 'dashboard/(main)/layout.tsx')).kind, 'ok')
  // A client layout that already uses the hydrator, or the shell that has it, needs nothing
  assert.equal(classifyMainLayout("'use client'\nimport { EntityRegistryHydrator } from 'x'\nexport default function L({ children }) { return <EntityRegistryHydrator entities={[]}>{children}</EntityRegistryHydrator> }\n").kind, 'ok')
  assert.equal(classifyMainLayout("import { DashboardShell } from 'x'\nexport default function L({ children }) { return <DashboardShell entities={[]}>{children}</DashboardShell> }\n").kind, 'ok')
  // A server layout without either, and a client one that only names the hydrator in a comment, do not fill the registry
  assert.equal(classifyMainLayout('export default function L({ children }) { return children }\n').kind, 'own')
  assert.equal(classifyMainLayout("'use client'\n// TODO: EntityRegistryHydrator\n/* DashboardShell */\nexport default function L() { return null }\n").kind, 'own')
  assert.equal(classifyMainLayout("'use client'\nexport default function L() { return null }\n").kind, 'own')
  // One changed space inside a line is the project's own text; line endings, a BOM, indentation and empty lines are not
  const published = oldLayout('crm-1')
  assert.equal(classifyMainLayout(`﻿${published.replace(/\n/g, '\r\n\r\n').replace(/^/gm, '    ')}`).kind, 'published')
  assert.equal(classifyMainLayout(published.replace("'react'", "' react'")).kind, 'own')
  assert.equal(classifyMainLayout('/** header */\n\n"use client"\nexport default function L() { return null }\n').kind, 'own')
  assert.deepEqual(classifyMainLayout(oldLayout('crm-1')), { kind: 'published', template: 'crm', shared: 'CRMDashboardLayout.tsx' })
  assert.deepEqual(classifyMainLayout(oldLayout('crm-2')), { kind: 'published', template: 'crm', shared: 'CRMDashboardLayout.tsx' })
  assert.deepEqual(classifyMainLayout(oldLayout('productivity-1')), { kind: 'published', template: 'productivity', shared: 'ProductivityDashboardLayout.tsx' })
})

test('the 0.1.0-beta.202 migration replaces each published old layout, adds the client component beside it, and a second run does nothing', (t) => {
  for (const [name, template, shared] of [
    ['crm-1', 'crm', 'CRMDashboardLayout.tsx'],
    ['crm-2', 'crm', 'CRMDashboardLayout.tsx'],
    ['productivity-1', 'productivity', 'ProductivityDashboardLayout.tsx'],
  ]) {
    // Line endings and indentation do not make a text the project's own
    const root = project(t, { [MAIN_LAYOUT]: oldLayout(name).replace(/\n/g, '\r\n') })
    const first = entityRegistryMigration().run(root, {})
    assert.deepEqual([...first.changed].sort(), [MAIN_LAYOUT, `templates/shared/${shared}`].sort(), name)
    assert.deepEqual(first.notes, [], name)
    assert.equal(fs.readFileSync(path.join(root, MAIN_LAYOUT), 'utf8'), templateFile(template, 'dashboard/(main)/layout.tsx'), name)
    assert.equal(fs.readFileSync(path.join(root, 'templates/shared', shared), 'utf8'), templateFile(template, `shared/${shared}`), name)
    assert.deepEqual(entityRegistryMigration().run(root, {}), { changed: [], notes: [] }, name)
  }
})

test('the 0.1.0-beta.202 migration leaves a layout the project changed as it is, and the note says what to do', (t) => {
  const own = `${oldLayout('crm-1')}\n// the project's own line\n`
  const root = project(t, { [MAIN_LAYOUT]: own })
  const result = entityRegistryMigration().run(root, {})
  assert.deepEqual(result.changed, [])
  assert.equal(fs.readFileSync(path.join(root, MAIN_LAYOUT), 'utf8'), own)
  assert.equal(fs.existsSync(path.join(root, 'templates/shared/CRMDashboardLayout.tsx')), false)
  assert.match(result.notes.join('\n'), /templates\/dashboard\/\(main\)\/layout\.tsx does not fill the client entity registry.*left as it is.*EntityRegistryHydrator/)
})

test('the 0.1.0-beta.202 migration does nothing to a project without that layout (the starter)', (t) => {
  const root = project(t, { 'app/page.tsx': 'export default function P() { return null }\n' })
  assert.deepEqual(entityRegistryMigration().run(root, {}), { changed: [], notes: [] })
  assert.deepEqual(fs.readdirSync(root), ['app'])
})

test('the 0.1.0-beta.202 migration goes on with the layout when the client file is already the template one', (t) => {
  const client = templateFile('crm', 'shared/CRMDashboardLayout.tsx')
  const root = project(t, { [MAIN_LAYOUT]: oldLayout('crm-1'), 'templates/shared/CRMDashboardLayout.tsx': client })
  const result = entityRegistryMigration().run(root, {})
  assert.deepEqual(result, { changed: [MAIN_LAYOUT], notes: [] })
  assert.equal(fs.readFileSync(path.join(root, MAIN_LAYOUT), 'utf8'), templateFile('crm', 'dashboard/(main)/layout.tsx'))
  assert.equal(fs.readFileSync(path.join(root, 'templates/shared/CRMDashboardLayout.tsx'), 'utf8'), client)
})

test('the 0.1.0-beta.202 migration leaves a client layout that uses the hydrator alone', (t) => {
  const mine = "'use client'\nimport { EntityRegistryHydrator } from 'x'\nexport default function L({ children }) { return <EntityRegistryHydrator entities={[]}>{children}</EntityRegistryHydrator> }\n"
  const root = project(t, { [MAIN_LAYOUT]: mine })
  assert.deepEqual(entityRegistryMigration().run(root, {}), { changed: [], notes: [] })
  assert.equal(fs.readFileSync(path.join(root, MAIN_LAYOUT), 'utf8'), mine)
})

test('the 0.1.0-beta.202 migration does not write over a client file the project already has', (t) => {
  const root = project(t, { [MAIN_LAYOUT]: oldLayout('crm-1'), 'templates/shared/CRMDashboardLayout.tsx': '// mine\n' })
  const result = entityRegistryMigration().run(root, {})
  assert.deepEqual(result.changed, [])
  assert.equal(fs.readFileSync(path.join(root, MAIN_LAYOUT), 'utf8'), oldLayout('crm-1'))
  assert.equal(fs.readFileSync(path.join(root, 'templates/shared/CRMDashboardLayout.tsx'), 'utf8'), '// mine\n')
  assert.match(result.notes.join('\n'), /already exists and differs from the template's, so nothing was written/)
})
