/**
 * Finds where a source file can change the file system without going through
 * core's safe-fs: an fs module imported whole, a named import of anything
 * other than a call that only reads, an fs module re-exported, and an fs module
 * named as the argument of a call - require, import(), createRequire(...)(),
 * process.binding - whose result can't be followed. Reads are listed by name,
 * so a call fs adds that changes things is found without being listed.
 *
 * And which files are the generator's: the ones under the directories given,
 * less tests, and every file they import from under the same package, however
 * deep, so a module added to what those files load is looked at too.
 *
 * @module core/scripts/build/registry/__tests__/direct-fs-writes
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { dirname, join, relative, resolve, sep } from 'path'
import ts from 'typescript'

/** The modules that reach the file system. */
export const FS_MODULES = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises', 'fs-extra', 'graceful-fs'])

/** What may be imported by name from them: calls and values that read, and nothing that writes, creates, renames or removes. */
export const READ_ONLY = new Set([
  'access',
  'accessSync',
  'constants',
  'createReadStream',
  'Dirent',
  'existsSync',
  'lstat',
  'lstatSync',
  'opendir',
  'opendirSync',
  'pathExists',
  'pathExistsSync',
  'readdir',
  'readdirSync',
  'readFile',
  'readFileSync',
  'readJson',
  'readJsonSync',
  'readlink',
  'readlinkSync',
  'realpath',
  'realpathSync',
  'stat',
  'Stats',
  'statSync',
  'unwatchFile',
  'watch',
  'watchFile',
])

const SOURCE_EXTENSIONS = ['.mjs', '.js', '.cjs', '.ts', '.mts', '.cts']

function scriptKind(fileName) {
  return fileName.endsWith('ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS
}

function parse(source, fileName) {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName))
}

function moduleName(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null
}

/**
 * Each place in `source` that can change the file system without safe-fs, by
 * line, with what it is.
 *
 * @param {string} source - The file's text
 * @param {string} fileName - Its name, for its language
 * @returns {{ line: number, what: string }[]}
 */
export function directFsWrites(source, fileName) {
  const file = parse(source, fileName)
  const found = []
  const add = (node, what) => {
    found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, what })
  }

  const visit = node => {
    if (ts.isImportDeclaration(node) && FS_MODULES.has(moduleName(node.moduleSpecifier))) {
      const clause = node.importClause
      const from = moduleName(node.moduleSpecifier)
      if (clause && !clause.isTypeOnly) {
        if (clause.name) add(node, `imports ${from} whole, as ${clause.name.text}`)
        const bindings = clause.namedBindings
        if (bindings && ts.isNamespaceImport(bindings)) add(node, `imports ${from} whole, as ${bindings.name.text}`)
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            const name = (element.propertyName ?? element.name).text
            if (!element.isTypeOnly && !READ_ONLY.has(name)) add(element, `imports ${name} from ${from}`)
          }
        }
      }
    } else if (ts.isExportDeclaration(node) && FS_MODULES.has(moduleName(node.moduleSpecifier))) {
      add(node, `re-exports ${moduleName(node.moduleSpecifier)}`)
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      FS_MODULES.has(moduleName(node.moduleReference.expression))
    ) {
      add(node, `imports ${moduleName(node.moduleReference.expression)} whole, as ${node.name.text}`)
    } else if (ts.isCallExpression(node)) {
      for (const argument of node.arguments) {
        const name = moduleName(argument)
        if (FS_MODULES.has(name)) add(node, `loads ${name} with a call`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

/** The relative module specifiers `source` imports, re-exports or loads with import(). */
function localSpecifiers(source, fileName) {
  const file = parse(source, fileName)
  const specifiers = []
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && moduleName(node.moduleSpecifier)?.startsWith('.')) {
      specifiers.push(moduleName(node.moduleSpecifier))
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const name = moduleName(node.arguments[0])
      if (name?.startsWith('.')) specifiers.push(name)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return specifiers
}

/** The file a relative specifier names: as written, a TypeScript source for a .js name, or with an extension added. */
function resolveSpecifier(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [
    base,
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.mjs$/, '.mts'),
    ...SOURCE_EXTENSIONS.map(extension => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map(extension => join(base, `index${extension}`)),
  ]
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile()) ?? null
}

function isTest(path) {
  return path.split(sep).includes('__tests__') || /\.test\.[cm]?[jt]s$/.test(path)
}

function sourcesUnder(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__tests__') files.push(...sourcesUnder(path))
    } else if (entry.isFile() && SOURCE_EXTENSIONS.some(extension => entry.name.endsWith(extension)) && !isTest(path)) {
      files.push(path)
    }
  }
  return files
}

/**
 * The generator's files: every source under `directories` that is not a test,
 * `entries`, and whatever those import from under `within`, followed to the end.
 *
 * @param {{ directories?: string[], entries?: string[], within: string }} options
 * @returns {string[]} Absolute paths, sorted
 */
export function generatorFiles({ directories = [], entries = [], within }) {
  const seen = new Set()
  const pending = [...directories.flatMap(sourcesUnder), ...entries.map(entry => resolve(entry))]
  while (pending.length > 0) {
    const file = pending.pop()
    if (seen.has(file)) continue
    seen.add(file)
    for (const specifier of localSpecifiers(readFileSync(file, 'utf8'), file)) {
      const target = resolveSpecifier(file, specifier)
      if (target && !relative(within, target).startsWith('..') && !isTest(target)) pending.push(target)
    }
  }
  return [...seen].sort()
}

/**
 * Each place, in each of `files` other than `allowed`, that can change the file
 * system without safe-fs, as `path:line what` from `base`.
 *
 * @param {string[]} files - Absolute paths
 * @param {{ base: string, allowed?: string[] }} options
 * @returns {string[]}
 */
export function directFsWritesIn(files, { base, allowed = [] }) {
  const exempt = new Set(allowed.map(path => resolve(path)))
  return files
    .filter(file => !exempt.has(file))
    .flatMap(file =>
      directFsWrites(readFileSync(file, 'utf8'), file).map(({ line, what }) => `${relative(base, file)}:${line} ${what}`)
    )
}
