#!/usr/bin/env node
/** Watch only local plugins enabled by the current root-first project. */
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { loadNextSparkConfigSync } from '../build/config-loader.mjs'
import { resolveProjectPaths } from '../build/registry/project-mode.mjs'

const { projectRoot, pluginsDir } = resolveProjectPaths(process.cwd())
const config = loadNextSparkConfigSync(projectRoot)

async function watchablePlugins() {
  const result = []
  for (const plugin of config.plugins) {
    const dir = join(pluginsDir, plugin)
    try {
      await access(dir, constants.R_OK)
      const packagePath = join(dir, 'package.json')
      await access(packagePath, constants.R_OK)
      const manifest = JSON.parse(await readFile(packagePath, 'utf8'))
      if (manifest.scripts?.dev) result.push({ name: plugin, dir })
      else console.log(`ℹ️  Plugin '${plugin}' has no dev script, skipping watcher`)
    } catch {
      console.warn(`⚠️  Enabled local plugin '${plugin}' is missing or has no readable package.json under plugins/`)
    }
  }
  return result
}

const plugins = await watchablePlugins()
if (plugins.length === 0) {
  console.log('✅ No local plugin watchers to run')
  process.exit(0)
}
console.log(`🔍 Watching ${plugins.length} local plugin(s): ${plugins.map(({ name }) => name).join(', ')}`)
const children = plugins.map(({ dir }) => spawn('pnpm', ['dev'], { cwd: dir, stdio: 'inherit', shell: false }))
let exitCode = 0
for (const child of children) child.on('exit', code => { if (code) exitCode = code })
const stop = signal => {
  for (const child of children) child.kill(signal)
  process.exit(exitCode)
}
process.on('SIGTERM', () => stop('SIGTERM'))
process.on('SIGINT', () => stop('SIGINT'))
