/**
 * The repository's root-first development project and every plugin package
 * must declare what their code and styles load. A module they load without
 * declaring it resolves only when another package happens to provide it,
 * which a clean pnpm install does not guarantee: the page or stylesheet fails
 * to build.
 * And an @nextsparkjs range that does not admit the release's own prereleases
 * produces a lockfile that fails `pnpm install --frozen-lockfile`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { builtinModules } from 'node:module'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { globSync } from 'glob'
import ts from 'typescript'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

/** Resolved by the build (a tsconfig path and a bundler alias), never installed. */
const BUILD_ALIASES = new Set(['@nextsparkjs/registries'])
/**
 * Every generated project depends on these directly, so a theme or plugin
 * resolves them from the project root whether or not it declares them.
 */
const PROJECT_DEPENDENCIES = new Set(['@nextsparkjs/core', 'tailwindcss'])
const SKIPPED_DIRS = new Set(['node_modules', '.next', '.nextspark', 'dist', 'tests', 'test', '__tests__', 'cypress'])
const TOOLING_FILE = /(^jest\.(config|setup)\.|\.(test|spec|cy)\.[cm]?[jt]sx?$)/
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/
const STYLE_FILE = /\.css$/
/**
 * `@import`, `@plugin` and `@reference` opening a statement, quoted or inside
 * `url()`. CSS needs no space between the at-keyword and a string, so none is
 * required, only that the keyword ends there.
 */
const CSS_LOAD = /^@(?:import|plugin|reference)(?![\w-])\s*(?:url\(\s*)?["']?([^"')\s;]+)/i
/** `@source "…"` opening a statement; it names a directory to scan rather than a module. */
const CSS_SOURCE = /^@source(?![\w-])\s*(?:not(?![\w-])\s*)?["']([^"']+)["']/i
/** A CSS escape: hex digits with an optional whitespace after them, or any other escaped character. */
const CSS_ESCAPE = /\\(?:([0-9a-f]{1,6})[ \t\n\r\f]?|([^\n0-9a-f]))/gi
const PACKAGE_NAME = /^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i

interface Manifest {
  dir: string
  skippedDirs?: Set<string>
  projectDependencies?: Set<string>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function packages(): Manifest[] {
  const pluginDirs = globSync('plugins/*', { cwd: REPO, absolute: true, onlyDirectories: true })
    .filter(dir => fs.existsSync(path.join(dir, 'package.json')))
  const projectDir = path.join(REPO, 'apps/dev')
  return [
    {
      dir: projectDir,
      skippedDirs: new Set([...SKIPPED_DIRS, 'plugins', 'src']),
      projectDependencies: new Set(),
      ...JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8')),
    },
    ...pluginDirs.map(dir => ({ dir, projectDependencies: PROJECT_DEPENDENCIES, ...JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) })),
  ]
}

function sourceFiles(dir: string, skippedDirs = SKIPPED_DIRS): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return skippedDirs.has(entry.name) ? [] : sourceFiles(full, skippedDirs)
    if (TOOLING_FILE.test(entry.name)) return []
    return SCRIPT_FILE.test(entry.name) || STYLE_FILE.test(entry.name) ? [full] : []
  })
}

function projectRoots(): string[] {
  const templateRoot = path.join(REPO, 'packages/core/templates/projects')
  return [
    path.join(REPO, 'apps/dev'),
    ...fs.readdirSync(templateRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(templateRoot, entry.name)),
  ]
}

/**
 * The package a `@source` path reaches into. Only a path through node_modules
 * names one; any other path is a directory relative to the stylesheet.
 */
function sourcePackage(source: string): string | null {
  if (!source.includes('node_modules/')) return null
  const inside = source.split('node_modules/').at(-1) ?? ''
  return (inside.startsWith('@') ? inside.split('/').slice(0, 2).join('/') : inside.split('/')[0]) || null
}

/**
 * A stylesheet's statements: the text between `;`, `{` and `}`, with comments
 * dropped and strings kept whole, so neither a comment nor a string such as
 * `content: '; @plugin "x"'` can open a statement.
 */
function cssStatements(css: string): string[] {
  const statements: string[] = []
  let current = ''
  for (let i = 0; i < css.length; i++) {
    const char = css[i]
    if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 1
      // A comment separates tokens like whitespace does: `@import/**/"x"` is an import.
      current += ' '
    } else if (char === '"' || char === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== char) j += css[j] === '\\' ? 2 : 1
      current += css.slice(i, j + 1)
      i = j
    } else if (char === ';' || char === '{' || char === '}') {
      statements.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  statements.push(current.trim())
  return statements.filter(Boolean)
}

/** What a stylesheet or a script loads. Comments and strings in code do not count. */
export function specifiersOf(text: string, style: boolean): string[] {
  if (style) {
    // At-keywords are case-insensitive and may be escaped (`@IMPORT`, `@\\69mport`), as may strings and url().
    const unescape = (statement: string) =>
      statement.replace(CSS_ESCAPE, (_, hex: string | undefined, char: string | undefined) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : char ?? ''))
    return cssStatements(text).map(unescape).flatMap(statement => {
      const load = statement.match(CSS_LOAD)
      if (load) return [load[1]]
      const source = statement.match(CSS_SOURCE)
      const name = source ? sourcePackage(source[1]) : null
      return name ? [name] : []
    })
  }
  const found = ts.preProcessFile(text, true, true).importedFiles.map(imported => imported.fileName)
  // require.resolve() names a module without loading it; preProcessFile skips it.
  const source = ts.createSourceFile('file.ts', text, ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      /^(require\.resolve|module\.require)$/.test(node.expression.getText(source)) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      found.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** The package a bare specifier names, or null for a path, a URL, an alias or a Node builtin. */
function packageName(specifier: string, projectDependencies = PROJECT_DEPENDENCIES): string | null {
  if (/^[./~]|^@\/|^[a-z]+:/i.test(specifier)) return null
  const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
  if (!PACKAGE_NAME.test(name)) return null
  return builtinModules.includes(name) || BUILD_ALIASES.has(name) || projectDependencies.has(name) ? null : name
}

test('the scanner sees every way a file loads a package, and nothing a comment or a string says', () => {
  const css = [
    '/* @plugin "pkg-commented"; */',
    '@plugin "pkg-plugin";',
    '@reference "pkg-reference";',
    '@import url(pkg-url-unquoted);',
    '@import "./local.css";',
    '@source "../node_modules/@scope/pkg-source/dist";',
    '@source "../components";',
    '@source "src/app";',
    '.probe::before { content: \'@plugin "pkg-in-a-string"\'; }',
    '.probe::after { content: \'; @plugin "pkg-after-a-semicolon-in-a-string"\'; }',
    '/* a "quote and ; in a comment */ @plugin "pkg-after-a-comment";',
    '.min{color:red}@plugin "pkg-minified";',
    '@import"pkg-tight";',
    '@plugin/**/"pkg-comment-gap";',
    '@importer "not-a-directive";',
    '@IMPORT "pkg-upper";',
    '@import URL("pkg-upper-url");',
    '@\\69mport "pkg-escaped";',
    '@import "pkg\\2d with-escape";',
    '.rule { color: red } @plugin "pkg-after-a-rule";',
  ].join('\n')
  assert.deepEqual(specifiersOf(css, true).sort(), ['./local.css', '@scope/pkg-source', 'pkg-after-a-comment', 'pkg-after-a-rule', 'pkg-comment-gap', 'pkg-escaped', 'pkg-minified', 'pkg-plugin', 'pkg-reference', 'pkg-tight', 'pkg-upper', 'pkg-upper-url', 'pkg-url-unquoted', 'pkg-with-escape'])
  const code = [
    "import type { A } from 'pkg-type'",
    "const b = require.resolve('pkg-resolve')",
    "const c = await import('pkg-dynamic')",
    "// import d from 'pkg-comment'",
    "const e = \"import f from 'pkg-string'\"",
  ].join('\n')
  assert.deepEqual(specifiersOf(code, false).sort(), ['pkg-dynamic', 'pkg-resolve', 'pkg-type'])
})

test('the project and plugins declare every package their code and styles load', () => {
  const undeclared: string[] = []
  for (const pkg of packages()) {
    const declared = new Set(Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies }))
    const seen = new Set<string>()
    for (const file of sourceFiles(pkg.dir, pkg.skippedDirs)) {
      for (const specifier of specifiersOf(fs.readFileSync(file, 'utf8'), STYLE_FILE.test(file))) {
        const name = packageName(specifier, pkg.projectDependencies)
        if (!name || declared.has(name) || seen.has(name)) continue
        seen.add(name)
        undeclared.push(`${path.relative(REPO, pkg.dir)} loads ${name} (${path.relative(pkg.dir, file)})`)
      }
    }
  }
  assert.deepEqual(undeclared, [])
})

test('root-first project styles keep every Tailwind source inside the project root', () => {
  const escaping: string[] = []
  for (const root of projectRoots()) {
    const stylesheet = path.join(root, 'styles/globals.css')
    const css = fs.readFileSync(stylesheet, 'utf8')
    const sources = cssStatements(css)
      .map(statement => statement.match(CSS_SOURCE)?.[1])
      .filter((source): source is string => source !== undefined)

    assert.ok(sources.includes('../**/*.{js,ts,jsx,tsx}'), `${path.relative(REPO, stylesheet)} scans its root-first project`)
    assert.ok(sources.includes('../node_modules/@nextsparkjs/core/dist/**/*.js'), `${path.relative(REPO, stylesheet)} scans installed core`)

    for (const source of sources) {
      const wildcard = source.search(/[*!?{\[]/)
      const staticPrefix = wildcard === -1 ? source : source.slice(0, wildcard)
      const resolved = path.resolve(path.dirname(stylesheet), staticPrefix)
      const relative = path.relative(root, resolved)
      if (relative === '..' || relative.startsWith(`..${path.sep}`)) {
        escaping.push(`${path.relative(REPO, stylesheet)}: ${source}`)
      }
    }
  }

  assert.deepEqual(escaping, [])
})

test('@nextsparkjs ranges in the project and plugins admit the release they ship in', () => {
  const { version } = JSON.parse(fs.readFileSync(path.join(REPO, 'packages/core/package.json'), 'utf8'))
  // A range admits prereleases only for its own X.Y.Z, so it follows the
  // release's; scripts/packages/version.sh rewrites it when the version moves.
  const expected = `>=${String(version).split('-')[0]}-0`
  const mismatched: string[] = []
  for (const pkg of packages()) {
    for (const section of ['dependencies', 'peerDependencies', 'devDependencies'] as const) {
      for (const [name, range] of Object.entries(pkg[section] ?? {})) {
        if (!name.startsWith('@nextsparkjs/') || range.startsWith('workspace:') || range === expected) continue
        mismatched.push(`${path.relative(REPO, pkg.dir)} ${section} ${name}: "${range}" (expected "${expected}")`)
      }
    }
  }
  assert.deepEqual(mismatched, [])
})

test('the lockfile records the @nextsparkjs ranges the manifests declare', () => {
  const lockfile = fs.readFileSync(path.join(REPO, 'pnpm-lock.yaml'), 'utf8')
  const stale: string[] = []
  for (const pkg of packages()) {
    const importer = path.relative(REPO, pkg.dir)
    const block = lockfile.match(new RegExp(`^  ${importer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\n((?:(?:    |\\n).*\\n?)*)`, 'm'))?.[1] ?? ''
    const declared = { ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.dependencies }
    for (const [name, range] of Object.entries(declared)) {
      if (!name.startsWith('@nextsparkjs/')) continue
      const recorded = block.match(new RegExp(`'${name.replace('/', '\\/')}':\\n\\s+specifier: '?([^'\\n]+)'?`))?.[1]
      if (recorded !== range) stale.push(`${importer} ${name}: manifest "${range}", lockfile "${recorded ?? 'missing'}"`)
    }
  }
  assert.deepEqual(stale, [])
})

function misplacedPublishablePlugins(root: string): string[] {
  return globSync('**/package.json', {
    cwd: root,
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
  }).filter(manifestPath => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'))
    return manifest.private !== true && manifest.nextspark?.type === 'plugin' && !/^plugins\/[^/]+\/package\.json$/.test(manifestPath)
  }).sort()
}

test('every publishable plugin lives under root plugins/ where pack.sh and version.sh discover it', () => {
  assert.deepEqual(misplacedPublishablePlugins(REPO), [])
})

test('the publishable-plugin location guard rejects a package outside the packed locations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-misplaced-plugin-'))
  try {
    const manifest = path.join(root, 'apps/dev/plugins/acme/package.json')
    fs.mkdirSync(path.dirname(manifest), { recursive: true })
    fs.writeFileSync(manifest, JSON.stringify({
      name: '@example/plugin-acme',
      private: false,
      nextspark: { type: 'plugin', name: 'acme' },
    }))
    assert.deepEqual(misplacedPublishablePlugins(root), ['apps/dev/plugins/acme/package.json'])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
