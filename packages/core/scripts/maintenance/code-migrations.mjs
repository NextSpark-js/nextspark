/**
 * Rewrites of project code that a release of core needs, run by update-core once the new core is installed.
 *
 * Each entry names the version that needs it: update-core runs it when the update goes from below that version to
 * it or above, taking this list from the core it just installed. An update run by an older updater, which has no
 * such step, can run one afterwards from the project:
 *
 *   node node_modules/@nextsparkjs/core/scripts/maintenance/code-migrations.mjs 0.1.0-beta.200
 *
 * Each one is idempotent and only touches the files `projectSourceFiles` lists, the same ones the CLI looks at to
 * report what is left (`nextspark doctor`, `nextspark prepare`).
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { SKIPPED_DIRS, SKIPPED_FILE, SOURCE_FILE } from './source-files.mjs'

export { SKIPPED_DIRS, SKIPPED_FILE, SOURCE_FILE }

/** The text of a file, or null when it cannot be read (permissions, a broken link) */
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/**
 * Code files of the project at `root`, relative to it. A directory that cannot be read (a database volume owned by
 * another user, say) is skipped: it is not the project's code.
 */
export function projectSourceFiles(root, dir = root, found = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name) || entry.name.startsWith('.') || path.relative(root, full) === path.join('src', 'app')) continue
      projectSourceFiles(root, full, found)
    } else if (entry.isFile() && SOURCE_FILE.test(entry.name) && !SKIPPED_FILE.test(entry.name)) {
      found.push(path.relative(root, full))
    }
  }
  return found
}

const THEME_PROVIDER = '@nextsparkjs/core/providers/theme-provider'
/** What next-themes 0.4.6 exports; core's theme provider exports each under the same name */
const THEME_PROVIDER_NAMES = new Set(['useTheme', 'ThemeProvider', 'ThemeProviderProps', 'UseThemeProps', 'Attribute', 'ScriptProps'])
/** `import { a, type b } from 'next-themes'`, `import type { … }`, `export { … } from`, as a statement of its own line */
const NAMED_DECLARATION = /^([ \t]*)(import|export)(\s+type)?(\s*\{([^}]*)\}\s*from\s*)(['"])next-themes\6/gm
/**
 * A line that loads next-themes: an import or re-export statement (its `from` line when it spans several), a
 * side-effect import, import() or require(). A comment or a string that only mentions it is not one.
 */
const LOADS_NEXT_THEMES = /^\s*(?:(?:import|export)\b[^'"]*?\bfrom\s*|\}\s*from\s*|import\s*)(['"])next-themes\1|\b(?:import|require)\s*\(\s*(['"])next-themes\2\s*\)/
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/

/** The 1-based numbers of the lines of `text` that load next-themes */
export function nextThemesLines(text) {
  if (!text.includes('next-themes')) return []
  const found = []
  text.split('\n').forEach((line, index) => {
    if (LOADS_NEXT_THEMES.test(line) && !COMMENT_LINE.test(line)) found.push(index + 1)
  })
  return found
}

/** `file:line` of each line of the project's code that loads next-themes; reads nothing but those files */
export function findNextThemesImports(root) {
  const found = []
  for (const file of projectSourceFiles(root)) {
    for (const line of nextThemesLines(readText(path.join(root, file)) ?? '')) found.push(`${file}:${line}`)
  }
  return found
}

/**
 * Points the named imports and re-exports of next-themes at core's theme provider when every name is one core
 * exports. `leftover` says the text still loads next-themes some other way.
 */
export function rewriteNextThemesImports(text) {
  const rewritten = text.replace(NAMED_DECLARATION, (match, indent, keyword, type, clause, list, quote) => {
    const names = list.split(',').map((item) => item.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()).filter(Boolean)
    if (names.length === 0 || !names.every((name) => THEME_PROVIDER_NAMES.has(name))) return match
    return `${indent}${keyword}${type ?? ''}${clause}${quote}${THEME_PROVIDER}${quote}`
  })
  return { text: rewritten, leftover: nextThemesLines(rewritten).length > 0 }
}

/** 0.1.0-beta.200: core renders its own theme provider, which the hook of next-themes does not see (#371) */
function nextThemesImports(root, manifest) {
  const changed = []
  const leftover = []
  for (const file of projectSourceFiles(root)) {
    const full = path.join(root, file)
    const text = readText(full)
    if (text === null) continue
    if (!text.includes('next-themes')) continue
    const result = rewriteNextThemesImports(text)
    if (result.text !== text) {
      fs.writeFileSync(full, result.text)
      changed.push(file)
    }
    if (result.leftover) leftover.push(file)
  }
  const notes = []
  if (leftover.length > 0) {
    notes.push(`Still loading next-themes, not rewritten (a default or namespace import, a name core does not export, import() or require()): ${leftover.join(', ')}. Read useTheme and ThemeProvider from ${THEME_PROVIDER}: the hook of next-themes does not see the provider core renders.`)
  }
  const declared = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].some((field) => manifest?.[field]?.['next-themes'])
  if (declared && leftover.length === 0) {
    notes.push('package.json declares next-themes, which core no longer needs: remove it (pnpm remove next-themes) unless the project uses it for something else.')
  }
  return { changed, notes }
}

const MAIN_LAYOUT = path.join('templates', 'dashboard', '(main)', 'layout.tsx')
const TEMPLATES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'projects')
/**
 * The dashboard layouts the crm and productivity templates published before #417 (hash of the normalized
 * text), and the client component each one's new layout renders. Any other text is the project's own code.
 */
const PUBLISHED_LAYOUTS = {
  '8dfc49de9e2838e2': { template: 'crm', shared: 'CRMDashboardLayout.tsx' },
  '97d49400e11cf60d': { template: 'crm', shared: 'CRMDashboardLayout.tsx' },
  b30d6deaa1b42900: { template: 'productivity', shared: 'ProductivityDashboardLayout.tsx' },
}

/** Every file the 0.1.0-beta.202 migration can create or replace; its upgrade note in the CHANGELOG names each one */
const ENTITY_REGISTRY_LAYOUT_WRITES = [MAIN_LAYOUT, ...new Set(Object.values(PUBLISHED_LAYOUTS).map((entry) => path.join('templates', 'shared', entry.shared)))]

/** Line endings, a BOM, indentation, runs of spaces between words and empty lines do not tell two texts apart; what is inside a line does */
const normalize = (text) => text.replace(/^﻿/, '').replace(/\r/g, '').split('\n').map((line) => line.trim().replace(/\s+/g, ' ')).filter(Boolean).join('\n')
const digest = (text) => crypto.createHash('sha256').update(normalize(text)).digest('hex').slice(0, 16)
const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

/**
 * What the dashboard layout of a project is for the entity registry: 'ok' (its code uses EntityRegistryHydrator or
 * DashboardShell, which fills it), 'published' (a text an old template published: says which) or 'own' (any other)
 */
export function classifyMainLayout(text) {
  if (/\b(?:EntityRegistryHydrator|DashboardShell)\b/.test(withoutComments(text))) return { kind: 'ok' }
  const published = PUBLISHED_LAYOUTS[digest(text)]
  return published ? { kind: 'published', ...published } : { kind: 'own' }
}

/**
 * 0.1.0-beta.202: a dashboard layout of the project replaces core's DashboardShell, which fills the client entity
 * registry; one that does not leaves the entity detail and edit pages answering "not found in the registry" (#417)
 */
function entityRegistryLayout(root) {
  const file = path.join(root, MAIN_LAYOUT)
  const text = readText(file)
  if (text === null) return { changed: [], notes: [] }
  const found = classifyMainLayout(text)
  if (found.kind === 'ok') return { changed: [], notes: [] }
  const how = `Make it a server component that renders its content inside <EntityRegistryHydrator entities={...}> (from @nextsparkjs/core/components/dashboard/layouts/EntityRegistryHydrator), moving its current body to a client component: node_modules/@nextsparkjs/core/templates/projects/crm/templates/dashboard/(main)/layout.tsx shows how to build the entities list.`
  const own = `${MAIN_LAYOUT} does not fill the client entity registry (it uses neither EntityRegistryHydrator nor DashboardShell), so /dashboard/<entity>/<id> answers "Entity not found in the registry". It was left as it is: it is not a layout a template published. ${how}`
  if (found.kind === 'own') return { changed: [], notes: [own] }
  const source = path.join(TEMPLATES, found.template, 'templates')
  const layout = readText(path.join(source, 'dashboard', '(main)', 'layout.tsx'))
  const client = readText(path.join(source, 'shared', found.shared))
  const clientFile = path.join('templates', 'shared', found.shared)
  if (layout === null || client === null) return { changed: [], notes: [own] }
  const existing = readText(path.join(root, clientFile))
  if (existing !== null && normalize(existing) !== normalize(client)) {
    return { changed: [], notes: [`${MAIN_LAYOUT} is the old ${found.template} template layout, but ${clientFile} already exists and differs from the template's, so nothing was written. ${how}`] }
  }
  if (existing === null) {
    fs.mkdirSync(path.dirname(path.join(root, clientFile)), { recursive: true })
    fs.writeFileSync(path.join(root, clientFile), client)
  }
  fs.writeFileSync(file, layout)
  return { changed: existing === null ? [clientFile, MAIN_LAYOUT] : [MAIN_LAYOUT], notes: [] }
}

export const CODE_MIGRATIONS = [
  {
    version: '0.1.0-beta.200',
    title: `useTheme and ThemeProvider from next-themes -> ${THEME_PROVIDER}`,
    run: nextThemesImports,
    writes: null,
  },
  {
    version: '0.1.0-beta.202',
    title: 'the dashboard layout of a crm or productivity project fills the client entity registry',
    run: entityRegistryLayout,
    /** The files it can create or replace (`null`: not fixed, as in the 0.1.0-beta.200 one, which rewrites any file that imports next-themes) */
    writes: ENTITY_REGISTRY_LAYOUT_WRITES,
  },
]

/** Runs the migrations of `version` (all of them without one) in `cwd`; returns the lines to print */
export function runCodeMigrations(cwd, version) {
  const lines = []
  let manifest = null
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'))
  } catch {
    // no package.json: only the declared-dependency note is lost
  }
  for (const migration of CODE_MIGRATIONS.filter((entry) => !version || entry.version === version)) {
    lines.push(`${migration.version}: ${migration.title}`)
    const { changed, notes } = migration.run(cwd, manifest)
    lines.push(...(changed.length === 0 ? ['  Nothing to rewrite'] : changed.map((file) => `  ${file}`)), ...notes.map((note) => `  ${note}`))
  }
  return lines
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const version = process.argv[2]
  if (version && !CODE_MIGRATIONS.some((entry) => entry.version === version)) {
    console.error(`No code migration for ${version}. Known: ${CODE_MIGRATIONS.map((entry) => entry.version).join(', ')}`)
    process.exitCode = 1
  } else {
    for (const line of runCodeMigrations(process.cwd(), version)) console.log(line)
  }
}
