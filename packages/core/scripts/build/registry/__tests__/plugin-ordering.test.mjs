import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import { discoverPlugins } from '../discovery/plugins.mjs'
import { generatePluginCatalog } from '../generators/plugin-catalog.mjs'
import { generatePluginRegistry } from '../generators/plugin-registry.mjs'
import { resolveProjectPluginSources } from '../project-mode.mjs'

async function project(files) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-plugin-order-'))
  for (const [name, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, name)), { recursive: true })
    await writeFile(join(root, name), contents)
  }
  return root
}

const pluginConfig = (name, dependencies = []) =>
  `export const ${name}PluginConfig = { name: '${name}', dependencies: ${JSON.stringify(dependencies)} }\n`

const packageJson = (name) => JSON.stringify({ name: `@example/plugin-${name}`, nextspark: { type: 'plugin', name } })

test('plugins load in the order `plugins` lists them, local and packaged alike', async () => {
  const root = await project({
    'package.json': JSON.stringify({ dependencies: { next: '16.3.8', '@example/plugin-zeta': '1.0.0' } }),
    'plugins/alpha/plugin.config.ts': pluginConfig('alpha'),
    'plugins/mid/plugin.config.ts': pluginConfig('mid'),
    'node_modules/@example/plugin-zeta/package.json': packageJson('zeta'),
    'node_modules/@example/plugin-zeta/plugin.config.ts': pluginConfig('zeta'),
  })
  try {
    const names = (list) => resolveProjectPluginSources(root, list).map(source => source.name)
    assert.deepEqual(names(['alpha', '@example/plugin-zeta', 'mid']), ['alpha', 'zeta', 'mid'])
    assert.deepEqual(names(['mid', '@example/plugin-zeta', 'alpha']), ['mid', 'zeta', 'alpha'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the catalog is sorted by name whatever the order; the registry keeps the order it was given', async () => {
  const root = await project({
    'package.json': '{}',
    'plugins/alpha/plugin.config.ts': pluginConfig('alpha'),
    'plugins/beta/plugin.config.ts': pluginConfig('beta'),
  })
  try {
    const config = (order) => ({
      projectRoot: root,
      outputDir: join(root, '.nextspark', 'registries'),
      isNpmMode: false,
      pluginSources: order.map(name => ({ name, request: name, packageName: null, sourceDir: join(root, 'plugins', name), importBase: `@/plugins/${name}`, kind: 'local' })),
    })
    const forward = await discoverPlugins(config(['alpha', 'beta']))
    const backward = await discoverPlugins(config(['beta', 'alpha']))
    assert.deepEqual(forward.map(plugin => plugin.name), ['alpha', 'beta'])
    assert.deepEqual(backward.map(plugin => plugin.name), ['beta', 'alpha'])
    assert.equal(generatePluginCatalog(forward), generatePluginCatalog(backward))
    const registry = (plugins) => generatePluginRegistry(plugins, config([])).split('\n').filter(line => /^import .*plugins\/(alpha|beta)/.test(line))
    assert.match(registry(forward)[0], /alpha/)
    assert.match(registry(backward)[0], /beta/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// `dependencies` of a plugin config is checked for its shape by the runtime loader and read by nothing that orders plugins,
// so a cycle between them (or a plugin that lists itself) is not an error and cannot hang discovery.
test('plugins whose `dependencies` form a cycle are all discovered, without a diagnostic', async () => {
  const root = await project({
    'package.json': '{}',
    'plugins/ping/plugin.config.ts': pluginConfig('ping', ['pong']),
    'plugins/pong/plugin.config.ts': pluginConfig('pong', ['ping']),
    'plugins/self/plugin.config.ts': pluginConfig('self', ['self']),
  })
  try {
    const sources = ['ping', 'pong', 'self'].map(name => ({ name, request: name, packageName: null, sourceDir: join(root, 'plugins', name), importBase: `@/plugins/${name}`, kind: 'local' }))
    const plugins = await discoverPlugins({ projectRoot: root, outputDir: join(root, '.nextspark', 'registries'), isNpmMode: false, pluginSources: sources })
    assert.deepEqual(plugins.map(plugin => plugin.name), ['ping', 'pong', 'self'])
    assert.match(generatePluginCatalog(plugins), /"ping"[\s\S]*"pong"[\s\S]*"self"/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
