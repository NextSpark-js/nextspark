/**
 * The generated plugin-registry.ts type-checks for a plugin that has entities (the emitted entity objects
 * carry every field discovery sets, so PluginEntity must declare them all).
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/plugin-registry-types.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { generatePluginRegistry } from '../generators/plugin-registry.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'

// What discovery/entities.mjs emits for a plugin's entity
const entity = {
  name: 'leadforms',
  exportName: 'leadformsEntityConfig',
  configPath: '@/plugins/lead-form/entities/leadforms/leadforms.config',
  actualConfigFile: 'leadforms.config.ts',
  relativePath: 'leadforms',
  depth: 0,
  parent: null,
  children: [],
  hasComponents: false,
  hasHooks: false,
  hasMigrations: false,
  hasMessages: false,
  hasAssets: false,
  messagesPath: '@/plugins/lead-form/entities/leadforms/messages',
  pluginContext: { pluginName: 'lead-form' },
  themeContext: null,
  source: 'plugin',
}

test('the generated plugin registry type-checks with a plugin that has entities', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'plugin-registry-types-'))
  try {
    const plugin = {
      name: 'lead-form',
      exportName: 'leadFormPlugin',
      configPath: './plugin.config',
      hasAPI: false,
      apiPath: null,
      routeFiles: [],
      entities: [entity],
      settings: [],
      hasMessages: false,
      hasAssets: false,
      hasPagesServer: false,
    }
    const content = generatePluginRegistry([plugin], { outputDir: dir, isNpmMode: false })
    writeFileSync(join(dir, 'plugin-registry.ts'), content)
    writeFileSync(join(dir, 'plugin.config.ts'), "export const leadFormPlugin = { name: 'lead-form' }\n")
    writeFileSync(
      join(dir, 'stubs.d.ts'),
      "declare module 'server-only' {}\ndeclare module '@/core/types/plugin' { export type PluginConfig = { name: string } }\n",
    )
    const ts = await loadTypeScriptFor(process.cwd())
    const options = { noEmit: true, strict: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, baseUrl: dir, paths: { '@/core/*': ['./*'] } }
    const program = ts.createProgram([join(dir, 'plugin-registry.ts'), join(dir, 'stubs.d.ts')], options)
    const errors = ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    assert.deepEqual(errors, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
