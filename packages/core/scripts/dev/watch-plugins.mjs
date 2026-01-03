#!/usr/bin/env node
/**
 * Watch Active Plugins
 *
 * Dynamically watches only the plugins that are active in the current theme.
 * This significantly reduces memory consumption by not running TypeScript watchers
 * for inactive plugins.
 *
 * Memory Impact:
 * - Before: All plugins watched (~1.1GB for 4 plugins)
 * - After: Only active plugins watched (~150MB for 1 plugin)
 * - Reduction: ~87% memory savings
 *
 * Usage: node scripts/watch-active-plugins.mjs
 */

import { readFile, access } from 'fs/promises'
import { constants } from 'fs'
import { spawn } from 'child_process'
import { config } from 'dotenv'

// Load environment variables
config()

const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
const themeConfigPath = `./contents/themes/${activeTheme}/theme.config.ts`

async function getActivePlugins() {
  try {
    // Check if theme config exists
    await access(themeConfigPath, constants.R_OK)

    // Read theme config
    const themeConfig = await readFile(themeConfigPath, 'utf-8')

    // Extract plugins array using regex
    // Matches: plugins: ['ai', 'billing'] or plugins: ["ai"] or multiline
    const pluginsMatch = themeConfig.match(/plugins:\s*\[([\s\S]*?)\]/m)

    if (!pluginsMatch) {
      console.log('ℹ️  No plugins configured in theme, skipping plugin watchers')
      return []
    }

    // Parse plugin names (handle quotes, spaces, commas, comments)
    const pluginsString = pluginsMatch[1]
    const activePlugins = pluginsString
      .split(',')
      .map(p => p.trim().replace(/['"]/g, '').replace(/\/\/.*$/g, '')) // Remove quotes and comments
      .filter(Boolean)

    if (activePlugins.length === 0) {
      console.log('ℹ️  No active plugins in theme, skipping plugin watchers')
      return []
    }

    // Validate plugins exist in filesystem AND have package.json with dev script
    const validPlugins = []
    for (const plugin of activePlugins) {
      try {
        // Check if plugin directory exists
        await access(`./contents/plugins/${plugin}`, constants.R_OK)

        // Check if package.json exists
        const packageJsonPath = `./contents/plugins/${plugin}/package.json`
        try {
          await access(packageJsonPath, constants.R_OK)

          // Read package.json and check for dev script
          const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

          if (packageJson.scripts && packageJson.scripts.dev) {
            validPlugins.push(plugin)
          } else {
            console.log(`ℹ️  Plugin '${plugin}' has no dev script, skipping watcher`)
          }
        } catch {
          console.log(`ℹ️  Plugin '${plugin}' has no package.json, skipping watcher`)
        }
      } catch {
        console.warn(`⚠️  Plugin '${plugin}' is active in theme but not found in contents/plugins/`)
      }
    }

    return validPlugins

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Theme '${activeTheme}' not found at ${themeConfigPath}`)
      process.exit(1)
    }
    throw error
  }
}

async function watchActivePlugins() {
  const activePlugins = await getActivePlugins()

  if (activePlugins.length === 0) {
    // No plugins to watch, exit gracefully (concurrently will show this process as done)
    console.log('✅ No active plugins to watch')
    process.exit(0)
  }

  console.log(`🔍 Watching ${activePlugins.length} active plugin(s): ${activePlugins.join(', ')}`)

  // Generate Turbo filters
  const filters = activePlugins.map(plugin => `@nextspark/plugin-${plugin}`)

  // Build Turbo command with filters
  const turboArgs = ['dev']
  filters.forEach(filter => {
    turboArgs.push('--filter', filter)
  })

  // Spawn Turbo process
  const turbo = spawn('turbo', turboArgs, {
    stdio: 'inherit', // Inherit stdin, stdout, stderr for concurrently
    shell: false
  })

  // Handle process exit
  turbo.on('exit', (code) => {
    process.exit(code || 0)
  })

  // Handle termination signals
  process.on('SIGTERM', () => turbo.kill('SIGTERM'))
  process.on('SIGINT', () => turbo.kill('SIGINT'))
}

// Run
watchActivePlugins().catch(error => {
  console.error('❌ Error watching active plugins:', error)
  process.exit(1)
})
