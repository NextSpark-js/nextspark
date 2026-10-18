/**
 * Core's own modules import each other through `@nextsparkjs/core/...` (the generated src/app of a project re-exports
 * core's routes, so a route module is compiled from node_modules). Every such specifier must resolve through the
 * exports map to a module that exists: `./lib/*` maps to `./dist/lib/*.js`, so a directory (lib/media/storage, with
 * an index) is not reachable without `/index` or an entry of its own. apps/dev compiles core from source and does not
 * see it; a generated project's build fails with "Module not found".
 *
 * Checked against src (the dist path `./dist/x.js` stands for `src/x.ts` or `.tsx`), so core need not be built.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const exportsMap = JSON.parse(fs.readFileSync(path.join(CORE, 'package.json'), 'utf8')).exports as Record<string, string | { import?: string; default?: string }>
const IMPORT = /(?:from\s+|import\s*\(\s*)['"]@nextsparkjs\/core(\/[^'"]+)['"]/g

const targetOf = (value: string | { import?: string; default?: string }) => (typeof value === 'string' ? value : value.import ?? value.default)

/** The file a subpath points to, with Node's rule for patterns: the longest matching prefix wins. */
export function resolveSubpath(subpath: string): string | undefined {
  if (exportsMap[subpath]) return targetOf(exportsMap[subpath])
  let best: { key: string; prefix: string; suffix: string } | undefined
  for (const key of Object.keys(exportsMap)) {
    const star = key.indexOf('*')
    if (star < 0) continue
    const prefix = key.slice(0, star)
    const suffix = key.slice(star + 1)
    if (subpath.startsWith(prefix) && subpath.endsWith(suffix) && subpath.length >= prefix.length + suffix.length && (!best || prefix.length > best.prefix.length)) {
      best = { key, prefix, suffix }
    }
  }
  if (!best) return undefined
  return targetOf(exportsMap[best.key])?.replace('*', subpath.slice(best.prefix.length, subpath.length - best.suffix.length))
}

const sourceExists = (target: string) => {
  const dist = /^\.\/dist\/(.+)\.js$/.exec(target)
  const candidates = dist ? ['.ts', '.tsx', '.js'].map((ext) => `src/${dist[1]}${ext}`) : [target]
  return candidates.some((file) => fs.existsSync(path.join(CORE, file)))
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(tsx?|mjs|js)$/.test(entry.name) ? [full] : []
  })
}

/** `@nextsparkjs/core/...` specifiers in code (comment lines skipped: JSDoc examples are not imports). */
function specifiersIn(text: string): string[] {
  const code = text.split('\n').filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line)).join('\n')
  return [...code.matchAll(IMPORT)].map((match) => `.${match[1]}`)
}

test('every @nextsparkjs/core subpath that core imports resolves through its exports map', () => {
  const offenders = sourceFiles(path.join(CORE, 'src')).flatMap((file) =>
    specifiersIn(fs.readFileSync(file, 'utf8'))
      .filter((subpath) => {
        const target = resolveSubpath(subpath)
        return !target || !sourceExists(target)
      })
      .map((subpath) => `${path.relative(CORE, file)}: ${subpath} -> ${resolveSubpath(subpath) ?? 'no export'}`)
  )
  assert.deepEqual(offenders, [], 'import the module file (for a directory, .../index) or add an exports entry')
})

test('the check catches a directory reached through ./lib/*, and accepts its /index', () => {
  assert.equal(resolveSubpath('./lib/media/storage'), './dist/lib/media/storage.js')
  assert.equal(sourceExists('./dist/lib/media/storage.js'), false)
  assert.equal(sourceExists(resolveSubpath('./lib/media/storage/index')!), true)
  assert.deepEqual(specifiersIn(" * import { x } from '@nextsparkjs/core/entities'\nimport { y } from '@nextsparkjs/core/lib/media/storage'"), ['./lib/media/storage'])
})
