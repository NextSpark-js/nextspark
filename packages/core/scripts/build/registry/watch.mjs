/**
 * Watch Mode
 *
 * Watches for file changes and triggers rebuilds
 *
 * @module core/scripts/build/registry/watch
 */

import { existsSync, watch } from 'fs'
import { join } from 'path'

import { log } from '../../utils/index.mjs'
import { CONFIG } from './config.mjs'

/**
 * Start watching contents directory for changes
 * @param {Function} buildRegistries - The build function to call on changes
 * @returns {Promise<void>}
 */
export async function watchContents(buildRegistries) {
  log('Starting watch mode...', 'info')

  const watchPaths = [
    CONFIG.pluginsDir,
    join(CONFIG.contentsDir, 'entities'),
    CONFIG.themesDir,
    join(CONFIG.contentsDir, 'config')
  ]

  let debounceTimer = null

  for (const watchPath of watchPaths) {
    if (existsSync(watchPath)) {
      log(`Watching: ${watchPath}`, 'info')
      const watcher = watch(watchPath, { recursive: true })

      watcher.on('change', async (eventType, filename) => {
        // Ignore test-related files (allure reports, screenshots, videos, cypress artifacts)
        const isTestArtifact = filename && (
          filename.includes('/tests/') ||
          filename.includes('/allure-') ||
          filename.includes('/screenshots/') ||
          filename.includes('/videos/') ||
          filename.includes('/downloads/') ||
          filename.endsWith('.mp4') ||
          filename.endsWith('.png') ||
          filename.endsWith('.jpg')
        )

        if (isTestArtifact) {
          return // Skip rebuild for test artifacts
        }

        // A deleted template needs nothing of its own here: the rebuild leaves its
        // route out of app/(templates) and backs the old file up.
        const shouldRebuild = !filename || // Always rebuild if filename is null (deletions)
          filename.endsWith('.config.ts') ||
          filename.endsWith('route.ts') ||
          filename.endsWith('.tsx') ||
          filename.endsWith('.ts') ||
          filename.includes('/templates/') || // Any change in templates directory
          eventType === 'rename' // Catch rename events (often deletions)

        if (shouldRebuild) {
          // Debounce rebuilds
          clearTimeout(debounceTimer)
          debounceTimer = setTimeout(async () => {
            console.log()
            log(`File changed: ${filename || 'unknown (deletion)'} [${eventType || 'change'}]`, 'info')
            await buildRegistries()
          }, 300) // Reduced debounce for faster response
        }
      })

      watcher.on('error', (error) => {
        log(`Watcher error on ${watchPath}: ${error.message}`, 'error')
      })
    }
  }
}
