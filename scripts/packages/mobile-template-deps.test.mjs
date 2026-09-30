import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), '../../packages/mobile/templates')
const read = (f) => readFileSync(join(TEMPLATE, f), 'utf8')

const pkg = JSON.parse(read('package.json.template'))
const declared = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }))

const packageName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2) : spec.split('/').slice(0, 1)).join('/')
const isExternal = (spec) => !/^[./]/.test(spec) && !builtinModules.includes(spec.replace(/^node:/, ''))

// `require('x')`, `require.resolve('x')` and `from 'x'` in a config file.
const imported = (file) =>
  [...read(file).matchAll(/(?:require(?:\.resolve)?\(|\bfrom\s+)['"]([^'"]+)['"]/g)].map((m) => m[1])
// Strings listed under `presets`/`plugins`/`jsxImportSource` are loaded by name at build time.
const babelNames = () => {
  const src = read('babel.config.js')
  const arrays = [...src.matchAll(/(?:presets|plugins)\s*:\s*\[([\s\S]*?)\n\s*\]/g)].map((m) => m[1])
  const strings = arrays.flatMap((a) => [...a.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]))
  return [...strings, ...[...src.matchAll(/jsxImportSource:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])]
}
const expoPlugins = () => {
  const m = read('app.config.ts').match(/plugins:\s*\[([^\]]*)\]/)
  return m ? [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]) : []
}

// Packages that a declared one loads by bare name at build time from the PROJECT (pnpm does not
// expose transitive dependencies): nativewind's jsx runtime, reanimated's babel plugin.
const IMPLIED = { nativewind: ['react-native-css-interop', 'tailwindcss'], 'react-native-reanimated': ['react-native-worklets'] }

test('every package the template configs load is a declared dependency of mobile', () => {
  const specs = [
    ...imported('babel.config.js'),
    ...imported('metro.config.js'),
    ...imported('tailwind.config.js'),
    ...imported('app.config.ts'),
    ...babelNames(),
    ...expoPlugins(),
  ]
  const needed = new Set(specs.filter(isExternal).map(packageName))
  assert.ok(needed.has('nativewind') && needed.has('babel-preset-expo') && needed.has('expo-router'), `parser found too little: ${[...needed]}`)
  for (const [pkgName, extra] of Object.entries(IMPLIED)) if (declared.has(pkgName)) extra.forEach((e) => needed.add(e))
  const missing = [...needed].filter((n) => !declared.has(n))
  assert.deepEqual(missing, [], `undeclared in package.json.template: ${missing.join(', ')}`)
})

test('template dependency ranges agree with apps/mobile for the shared build packages', () => {
  const dev = JSON.parse(readFileSync(join(TEMPLATE, '../../../apps/mobile/package.json'), 'utf8'))
  for (const n of ['react-native-css-interop', 'react-native-worklets', 'nativewind', 'expo', 'react-native-reanimated']) {
    assert.equal(pkg.dependencies[n], dev.dependencies[n], n)
  }
})
