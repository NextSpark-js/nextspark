/**
 * The boundary of the plugin capability check for third-party packages (#203, stage 7a).
 *
 * The compiler follows workspace files and @nextsparkjs/* packages. For a `web` entry it does NOT open third-party
 * packages in node_modules: the bundlers already fail a client build that imports a Node built-in or `server-only` (a web
 * component importing a third-party package whose entry imports `node:fs` or `server-only` makes `next build` fail, and
 * the same component over a clean package builds). For a `mobile` entry Metro fails a third-party `node:fs` the same way,
 * but it bundles a third-party `server-only` import (the package only throws when it runs), so the compiler reads
 * third-party entries for mobile targets, for `server-only` only. The Metro cases below prove both halves.
 *
 * Gated (a real `next build` per bundler, ~30-60 s each): NEXTSPARK_BUNDLER_BOUNDARY=1 pnpm exec tsx --test packages/core/tests/node/third-party-boundary.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const requireFromCore = createRequire(path.join(REPO, 'packages/core/package.json'))
const enabled = process.env.NEXTSPARK_BUNDLER_BOUNDARY === '1'

function packageDir(name: string): string {
  return realpathSync(path.dirname(requireFromCore.resolve(`${name}/package.json`)))
}

function write(root: string, file: string, content: string) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  writeFileSync(path.join(root, file), content)
}

function app(entry: string, { serverOnly = false } = {}) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'nextspark-boundary-')))
  write(root, 'package.json', JSON.stringify({ name: 'boundary-app', private: true }))
  write(root, 'next.config.mjs', `export default { turbopack: { root: ${JSON.stringify(path.parse(root).root)} } }\n`)
  write(root, 'app/layout.js', 'export default function Layout({ children }) { return <html><body>{children}</body></html> }\n')
  write(root, 'app/page.js', "import Client from '../components/Client'\nexport default function Page() { return <Client /> }\n")
  write(root, 'components/Client.js', "'use client'\nimport value from 'thirdparty'\nexport default function Client() { return <p>{String(value)}</p> }\n")
  write(root, 'node_modules/thirdparty/package.json', JSON.stringify({ name: 'thirdparty', version: '1.0.0', type: 'module', main: 'index.js' }))
  write(root, 'node_modules/thirdparty/index.js', entry)
  for (const name of ['next', 'react', 'react-dom']) symlinkSync(packageDir(name), path.join(root, 'node_modules', name))
  if (serverOnly) symlinkSync(realpathSync(path.join(REPO, 'packages/core/node_modules/server-only')), path.join(root, 'node_modules/server-only'))
  return root
}

function build(root: string, bundler: 'webpack' | 'turbopack') {
  return spawnSync(process.execPath, [requireFromCore.resolve('next/dist/bin/next'), 'build', `--${bundler}`], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', CI: '1' },
    timeout: 240_000,
  })
}

for (const bundler of ['webpack', 'turbopack'] as const) {
  test(`${bundler}: a client component importing a third-party package that imports node:fs fails next build`, { skip: !enabled && 'set NEXTSPARK_BUNDLER_BOUNDARY=1' }, () => {
    const root = app("import fs from 'node:fs'\nexport default fs.readFileSync\n")
    try {
      const result = build(root, bundler)
      const output = `${result.stdout}\n${result.stderr}`
      assert.notEqual(result.status, 0, output)
      assert.match(output, /node:fs|UnhandledSchemeError|Module not found|Can't resolve 'fs'/, output)
      assert.doesNotMatch(output, /distDirRoot|Could not find the Next.js package/, output)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test(`${bundler}: the same component over a clean third-party package builds`, { skip: !enabled && 'set NEXTSPARK_BUNDLER_BOUNDARY=1' }, () => {
    const root = app('export default 42\n')
    try {
      const result = build(root, bundler)
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}

// `server-only` is the other marker a client build must reject. Next fails it itself, at build time.
for (const bundler of ['webpack', 'turbopack'] as const) {
  test(`${bundler}: a client component importing a third-party package that imports server-only fails next build`, { skip: !enabled && 'set NEXTSPARK_BUNDLER_BOUNDARY=1' }, () => {
    const root = app("import 'server-only'\nexport default 42\n", { serverOnly: true })
    try {
      const result = build(root, bundler)
      const output = `${result.stdout}\n${result.stderr}`
      assert.notEqual(result.status, 0, output)
      assert.match(output, /server-only|Client Component|react-server/i, output)
      assert.doesNotMatch(output, /distDirRoot|Could not find the Next.js package/, output)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}

// Metro (the mobile bundler, via the metro installed for apps/mobile's toolchain): it fails a Node built-in in a
// third-party package, and it does NOT fail `server-only` (the package only throws when it runs), which is why the
// compiler's mobile check reads third-party entries for `server-only` itself.
function metroDir(): string | null {
  const store = path.join(REPO, 'node_modules/.pnpm')
  if (!existsSync(store)) return null
  const versions = readdirSync(store).filter(name => /^metro@\d/.test(name)).sort()
  const latest = versions.at(-1)
  return latest ? path.join(store, latest, 'node_modules') : null
}

function metroApp(entry: string) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'nextspark-metro-')))
  write(root, 'package.json', JSON.stringify({ name: 'metro-app', private: true }))
  write(root, 'index.js', "import value from 'thirdparty'\nconsole.log(value)\n")
  write(root, 'node_modules/thirdparty/package.json', JSON.stringify({ name: 'thirdparty', version: '1.0.0', main: 'index.js' }))
  write(root, 'node_modules/thirdparty/index.js', entry)
  const modules = metroDir()!
  write(root, 'run.cjs', `
const Metro = require(${JSON.stringify(path.join(modules, 'metro'))})
const { getDefaultConfig, mergeConfig } = require(${JSON.stringify(path.join(modules, 'metro-config'))})
;(async () => {
  const base = await getDefaultConfig(__dirname)
  const config = mergeConfig(base, { projectRoot: __dirname, watchFolders: [__dirname, ${JSON.stringify(realpathSync(path.join(modules, 'metro-runtime')))}], resolver: { nodeModulesPaths: [__dirname + '/node_modules'], extraNodeModules: { 'metro-runtime': ${JSON.stringify(realpathSync(path.join(modules, 'metro-runtime')))} } }, watcher: { watchman: false, healthCheck: { enabled: false } }, reporter: { update() {} } })
  try {
    await Metro.runBuild(config, { entry: 'index.js', platform: 'android', dev: false, minify: false, out: __dirname + '/out.js' })
    console.log('METRO BUILD OK')
  } catch (error) {
    console.log('METRO BUILD FAILED: ' + String(error.message).split('\\n')[0])
    process.exitCode = 1
  }
  process.exit()
})()
`)
  return root
}

function metroBuild(root: string) {
  return spawnSync(process.execPath, [path.join(root, 'run.cjs')], { cwd: root, encoding: 'utf8', timeout: 240_000 })
}

const metroSkip = !enabled ? 'set NEXTSPARK_BUNDLER_BOUNDARY=1' : metroDir() === null ? 'no metro in the workspace store' : false

test('metro: a mobile entry importing a third-party package that imports node:fs fails the bundle', { skip: metroSkip }, () => {
  const root = metroApp("const fs = require('node:fs')\nmodule.exports = fs.readFileSync\n")
  try {
    const result = metroBuild(root)
    const output = `${result.stdout}\n${result.stderr}`
    assert.notEqual(result.status, 0, output)
    assert.match(output, /Unable to resolve module node:fs/, output)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('metro: the same entry over a clean third-party package bundles', { skip: metroSkip }, () => {
  const root = metroApp('module.exports = 42\n')
  try {
    const result = metroBuild(root)
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout, /METRO BUILD OK/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('metro does not fail server-only in a third-party package (so the compiler must)', { skip: metroSkip }, () => {
  const root = metroApp("require('server-only')\nmodule.exports = 42\n")
  try {
    write(root, 'node_modules/server-only/package.json', JSON.stringify({ name: 'server-only', version: '0.0.1', main: 'index.js' }))
    write(root, 'node_modules/server-only/index.js', "throw new Error('This module cannot be imported from a Client Component module.')\n")
    const result = metroBuild(root)
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
