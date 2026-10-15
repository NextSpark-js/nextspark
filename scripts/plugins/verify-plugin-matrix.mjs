#!/usr/bin/env node
/**
 * Plugin matrix on a created starter (G0 decision 6). Run it in a project made from the packed tarballs
 * (.github/actions/create-project); every step changes the project and puts it back, in this order:
 *
 *   baseline    `nextspark prepare` on the untouched starter; the generated files (.nextspark, src) are hashed
 *   load        a local plugin (plugins/local-demo, with an API route) and a packaged one (@nextsparkjs/plugin-walkme from
 *               the tarballs) are enabled: `nextspark prepare` refuses the packaged one until its package is in
 *               transpilePackages (the script adds it), then `nextspark build` passes, both are in the catalog and the registries, and
 *               with --serve the local plugin's route answers from `next start`
 *   collision   a second packaged plugin that declares the same `nextspark.name` makes `nextspark prepare` fail, naming
 *               both packages and the plugin name
 *   peer        a packaged plugin whose @nextsparkjs/core peer range cannot be met is reported by the package manager's
 *               install (the CLI has no check of its own: `add:plugin` only reports missing peers)
 *   remove      both plugins and the two fixtures are removed again: `nextspark prepare` and a build leave exactly the
 *               generated files of the baseline
 *
 *   node scripts/plugins/verify-plugin-matrix.mjs --app <project>/app --packages <tarball dir> [--logs DIR] [--serve]
 *        [--port 4950] [--skip-build]
 *
 * The fixtures are written under <app>/../plugin-matrix-fixtures. pnpm and node come from PATH. Logs: one file per step
 * in --logs (default <app>/../plugin-matrix-logs). Exit 0 every step passed, 1 a step failed, 2 usage or environment error.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    app: { type: 'string' },
    packages: { type: 'string' },
    logs: { type: 'string' },
    port: { type: 'string', default: '4950' },
    serve: { type: 'boolean', default: false },
    'skip-build': { type: 'boolean', default: false },
  },
})
if (!values.app || !values.packages) {
  console.error('usage: verify-plugin-matrix.mjs --app <project dir> --packages <tarball dir> [--logs DIR] [--serve] [--port N] [--skip-build]')
  process.exit(2)
}
const app = path.resolve(values.app)
const packages = path.resolve(values.packages)
const logs = path.resolve(values.logs ?? path.join(app, '..', 'plugin-matrix-logs'))
const fixtures = path.join(app, '..', 'plugin-matrix-fixtures')
const walkmeTarball = existsSync(packages) ? readdirSync(packages).find(f => /^nextsparkjs-plugin-walkme-.*\.tgz$/.test(f)) : null
if (!existsSync(path.join(app, 'nextspark.config.ts')) || !walkmeTarball) {
  console.error(`${app} is not a NextSpark project, or ${packages} holds no nextsparkjs-plugin-walkme tarball`)
  process.exit(2)
}
mkdirSync(logs, { recursive: true })

const env = { ...process.env, CYPRESS_INSTALL_BINARY: '0', NEXTSPARK_AUTH_RUNTIME_ONLY: 'email,google', FORCE_COLOR: '0', NO_COLOR: '1' }
let stepNumber = 0
/** Runs a command in the project; its output goes to the step's log and is returned. */
function run(label, command, args, extra = {}) {
  const result = spawnSync(command, args, { cwd: app, env: { ...env, ...extra.env }, encoding: 'utf8', maxBuffer: 1 << 28 })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  stepNumber += 1
  writeFileSync(path.join(logs, `${String(stepNumber).padStart(2, '0')}-${label}.log`), `$ ${command} ${args.join(' ')}\n${output}\nexit ${result.status}\n`)
  return { ok: result.status === 0, output }
}
const must = (label, command, args, extra) => {
  const result = run(label, command, args, extra)
  if (!result.ok) throw new Error(`${label} failed:\n${result.output.split('\n').slice(-25).join('\n')}`)
  return result.output
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

/**
 * A file's content for hashing. generation.json records a hash of its inputs, and package.json is one: `pnpm add` and
 * `pnpm remove` sort its keys, so after a removal that hash differs without a generated file being left over. The record
 * is compared without that hash, without package.json's entry and without its mode; every other input and output still counts.
 */
function content(relative) {
  const buffer = readFileSync(path.join(app, relative))
  if (relative !== '.nextspark/generation.json') return buffer
  const record = JSON.parse(buffer.toString('utf8'))
  delete record.mode // prepare records `development`, build `production`
  delete record.inputs?.hash
  delete record.inputs?.files?.['package.json']
  return JSON.stringify(record)
}

/** Every generated file (.nextspark and src) by path and content hash. */
function generated() {
  const files = {}
  const walk = (dir) => {
    for (const entry of readdirSync(path.join(app, dir), { withFileTypes: true })) {
      const relative = path.posix.join(dir, entry.name)
      if (entry.isDirectory()) walk(relative)
      else files[relative] = createHash('sha256').update(content(relative)).digest('hex')
    }
  }
  for (const dir of ['.nextspark', 'src']) if (existsSync(path.join(app, dir))) walk(dir)
  return files
}
/** What differs between two `generated()` results, as lines. */
function difference(before, after) {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  return names.flatMap(name => (before[name] === after[name] ? [] : [`${before[name] === undefined ? '+' : after[name] === undefined ? '-' : '~'} ${name}`]))
}

const read = file => readFileSync(path.join(app, file), 'utf8')
const setPlugins = (list) => {
  const text = read('nextspark.config.ts')
  assert(/plugins:\s*\[[^\]]*\]/.test(text), 'nextspark.config.ts has no `plugins: [...]` to edit')
  writeFileSync(path.join(app, 'nextspark.config.ts'), text.replace(/plugins:\s*\[[^\]]*\]/, `plugins: [${list.map(name => `'${name}'`).join(', ')}]`))
}

/** A packaged plugin as a tarball: package.json with the given name, plugin name and core peer, and a plugin.config.ts. */
function fixturePackage(directory, { packageName, pluginName, corePeer }) {
  const root = path.join(fixtures, directory)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(path.join(root, 'package'), { recursive: true })
  writeFileSync(path.join(root, 'package', 'package.json'), JSON.stringify({
    name: packageName,
    version: '1.0.0',
    main: './plugin.config.ts',
    peerDependencies: { '@nextsparkjs/core': corePeer },
    nextspark: { type: 'plugin', name: pluginName },
  }))
  writeFileSync(path.join(root, 'package', 'plugin.config.ts'), `import { definePlugin } from '@nextsparkjs/core/types/plugin'
export const fixturePluginConfig = definePlugin({ name: '${pluginName}', capabilities: ['server'] })
export default fixturePluginConfig
`)
  const tarball = path.join(root, 'plugin.tgz')
  const packed = spawnSync('tar', ['-czf', tarball, '-C', root, 'package'])
  assert(packed.status === 0, `tar failed for ${directory}`)
  return `file:${path.relative(app, tarball)}`
}

// -w: the project has a pnpm-workspace.yaml, and pnpm 9 refuses to add to the workspace root without it (ERR_PNPM_ADDING_TO_ROOT)
const WALKME = '@nextsparkjs/plugin-walkme'
const DUP = '@fixture/plugin-walkme-dup'
const PEER = '@fixture/plugin-peer'

async function serveAndRequestLocalPlugin() {
  const port = Number(values.port)
  const server = spawn('pnpm', ['start'], { cwd: app, env: { ...env, PORT: String(port) }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let serverLog = ''
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverLog += chunk })
  try {
    const url = `http://localhost:${port}/api/plugins/local-demo/ping`
    for (let attempt = 0; attempt < 60; attempt++) {
      const answer = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null)
      if (answer) {
        const body = await answer.text()
        assert(answer.status === 200 && JSON.parse(body).plugin === 'local-demo', `GET ${url} answered ${answer.status}: ${body.slice(0, 200)}`)
        return
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    throw new Error(`the server never answered ${url}`)
  } catch (error) {
    writeFileSync(path.join(logs, 'serve.log'), serverLog)
    throw error
  } finally {
    // the server and the shell pnpm started share the process group; stop it by its id
    try { process.kill(-server.pid, 'SIGTERM') } catch { /* already gone */ }
  }
}

const steps = [
  ['baseline', async (state) => {
    must('baseline-prepare', 'pnpm', ['build:registries'])
    state.baseline = generated()
    assert(Object.keys(state.baseline).length > 0, 'prepare generated nothing')
  }],
  ['load: a local and a packaged plugin', async (state) => {
    mkdirSync(path.join(app, 'plugins', 'local-demo', 'api', 'ping'), { recursive: true })
    writeFileSync(path.join(app, 'plugins', 'local-demo', 'plugin.config.ts'), `import { definePlugin } from '@nextsparkjs/core/types/plugin'
export const localDemoPluginConfig = definePlugin({ name: 'local-demo', capabilities: ['server'] })
export default localDemoPluginConfig
`)
    writeFileSync(path.join(app, 'plugins', 'local-demo', 'api', 'ping', 'route.ts'), `export async function GET() {
  return Response.json({ ok: true, plugin: 'local-demo' })
}
`)
    must('load-add-packaged', 'pnpm', ['add', '-w', `file:${path.relative(app, path.join(packages, walkmeTarball))}`])
    setPlugins(['local-demo', WALKME])
    // A packaged plugin ships its TypeScript source, which Next compiles only for the packages in transpilePackages:
    // without this line the build stops with "Unknown module type" on the plugin's plugin.config.ts. Prepare refuses first.
    state.nextConfig = read('next.config.mjs')
    const transpile = "transpilePackages: ['@nextsparkjs/core']"
    assert(state.nextConfig.includes(transpile), `next.config.mjs has no ${transpile} to extend`)
    const refused = run('load-prepare-refused', 'pnpm', ['build:registries'])
    assert(!refused.ok, 'prepare passed with a packaged plugin missing from transpilePackages')
    assert(refused.output.includes('NS_PLUGIN_TRANSPILE_MISSING') && refused.output.includes(WALKME), `prepare refused without naming NS_PLUGIN_TRANSPILE_MISSING and ${WALKME}:\n${refused.output.split('\n').slice(-12).join('\n')}`)
    writeFileSync(path.join(app, 'next.config.mjs'), state.nextConfig.replace(transpile, `transpilePackages: ['@nextsparkjs/core', '${WALKME}']`))
    must('load-prepare', 'pnpm', ['build:registries'])
    const catalog = read('.nextspark/registries/plugin-catalog.ts')
    for (const name of ['local-demo', 'walkme']) assert(catalog.includes(`"${name}": {`), `plugin-catalog.ts does not list ${name}`)
    assert(read('.nextspark/registries/plugin-registry.ts').includes('local-demo'), 'the server plugin registry does not hold local-demo')
    assert(read('.nextspark/registries/plugin-registry.client.ts').includes(WALKME), `the client plugin registry does not import ${WALKME}`)
    assert(read('.nextspark/registries/route-handlers.ts').includes('/api/plugins/local-demo/ping'), 'route-handlers.ts does not register /api/plugins/local-demo/ping')
    if (!values['skip-build']) must('load-build', 'pnpm', ['build'])
    if (values.serve && !values['skip-build']) await serveAndRequestLocalPlugin()
  }],
  ['collision: two packaged plugins with one name', async () => {
    must('collision-add', 'pnpm', ['add', '-w', fixturePackage('dup', { packageName: DUP, pluginName: 'walkme', corePeer: '>=0.1.0-beta.192' })])
    setPlugins(['local-demo', WALKME, DUP])
    const result = run('collision-prepare', 'pnpm', ['build:registries'])
    assert(!result.ok, 'prepare passed with two plugins named walkme')
    const message = `Packaged plugins "${WALKME}" and "${DUP}" both declare the NextSpark plugin name "walkme"`
    assert(result.output.includes(message), `prepare failed without the collision message (${message}):\n${result.output.split('\n').slice(-12).join('\n')}`)
    setPlugins(['local-demo', WALKME])
    must('collision-remove', 'pnpm', ['remove', '-w', DUP])
  }],
  ['peer: a core range that cannot be met', async () => {
    const installed = must('peer-add', 'pnpm', ['add', '-w', fixturePackage('peer', { packageName: PEER, pluginName: 'peerdemo', corePeer: '>=99.0.0' })])
    // pnpm 10 and later print a pointer to `pnpm peers check`; earlier versions print the tree in the install output
    const report = `${installed}\n${run('peer-check', 'pnpm', ['peers', 'check']).output}`
    assert(/Issues with peer dependencies found/.test(report), 'the install did not report an issue with peer dependencies')
    assert(/unmet peer @nextsparkjs\/core[\s\S]{0,120}>=99\.0\.0/.test(report), 'the peer report does not tie @nextsparkjs/core to the range >=99.0.0')
    must('peer-remove', 'pnpm', ['remove', '-w', PEER])
  }],
  ['remove: no generated leftovers', async (state) => {
    must('remove-packaged', 'pnpm', ['remove', '-w', WALKME])
    writeFileSync(path.join(app, 'next.config.mjs'), state.nextConfig)
    rmSync(path.join(app, 'plugins', 'local-demo'), { recursive: true, force: true })
    setPlugins([])
    must('remove-prepare', 'pnpm', ['build:registries'])
    let changes = difference(state.baseline, generated())
    assert(changes.length === 0, `prepare after the removal differs from the baseline:\n${changes.join('\n')}`)
    if (!values['skip-build']) {
      must('remove-build', 'pnpm', ['build'])
      changes = difference(state.baseline, generated())
      assert(changes.length === 0, `build after the removal differs from the baseline:\n${changes.join('\n')}`)
    }
    for (const name of ['plugins/local-demo', 'node_modules/@nextsparkjs/plugin-walkme']) assert(!existsSync(path.join(app, name)), `${name} is still there`)
    assert(!/walkme|local-demo/.test(read('.nextspark/registries/plugin-catalog.ts')), 'the catalog still lists a removed plugin')
  }],
]

const state = {}
let failed = 0
for (const [name, step] of steps) {
  const started = Date.now()
  try {
    await step(state)
    console.log(`PASS  ${name} (${Math.round((Date.now() - started) / 1000)}s)`)
  } catch (error) {
    failed += 1
    console.log(`FAIL  ${name}\n${error.message}`)
    // a failed step leaves the project half changed; later steps would only repeat its error
    break
  }
}
console.log(failed === 0 ? 'plugin matrix: all steps passed' : 'plugin matrix: failed')
process.exit(failed === 0 ? 0 : 1)
