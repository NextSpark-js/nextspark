import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { discoverPlugins } from '../discovery/plugins.mjs'
import { generatePluginRegistry } from '../generators/plugin-registry.mjs'
import { generateRouteHandlersRegistry } from '../generators/route-handlers.mjs'

test('packaged plugin discovery and registries use package imports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-packaged-plugin-'))
  const sourceDir = join(root, 'node_modules', '@example', 'plugin-search')
  await mkdir(join(sourceDir, 'api', 'lookup'), { recursive: true })
  await writeFile(join(sourceDir, 'plugin.config.ts'), 'export const searchPluginConfig = {}\n')
  await writeFile(join(sourceDir, 'api', 'lookup', 'route.ts'), 'export async function GET() {}\n')

  try {
    const config = {
      projectRoot: root,
      outputDir: join(root, '.nextspark', 'registries'),
      isNpmMode: false,
      pluginSources: [{
        name: 'search',
        request: '@example/plugin-search',
        packageName: '@example/plugin-search',
        sourceDir,
        importBase: '@example/plugin-search',
        kind: 'packaged',
      }],
    }
    const plugins = await discoverPlugins(config)

    assert.equal(plugins.length, 1)
    assert.equal(plugins[0].configPath, '@example/plugin-search')
    assert.equal(plugins[0].routeFiles[0].filePath, '@example/plugin-search/api/lookup/route')
    assert.match(generatePluginRegistry(plugins, config), /from '@example\/plugin-search'/)
    assert.match(generateRouteHandlersRegistry(plugins, [], [], [], config), /from '@example\/plugin-search\/api\/lookup\/route'/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
