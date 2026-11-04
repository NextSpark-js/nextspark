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
import { fileURLToPath } from 'node:url'

/** Code files: what a project imports from */
export const SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/
/** Tests, which mock modules by name, and type declarations are left alone */
export const SKIPPED_FILE = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/
/** Installed, built or test code; also every directory starting with a dot and the generated src/app */
export const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'public', 'storybook-static', 'ios', 'android', '__tests__', 'tests', 'cypress'])

/** Code files of the project at `root`, relative to it */
export function projectSourceFiles(root, dir = root, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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
    for (const line of nextThemesLines(fs.readFileSync(path.join(root, file), 'utf8'))) found.push(`${file}:${line}`)
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
    const text = fs.readFileSync(full, 'utf8')
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

export const CODE_MIGRATIONS = [
  {
    version: '0.1.0-beta.200',
    title: `useTheme and ThemeProvider from next-themes -> ${THEME_PROVIDER}`,
    run: nextThemesImports,
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
