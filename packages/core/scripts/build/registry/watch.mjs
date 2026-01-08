/**
 * Watch Mode
 *
 * Watches for file changes and triggers rebuilds
 *
 * @module core/scripts/build/registry/watch
 */

import { existsSync, watch } from 'fs'
import { join } from 'path'

import { log, verbose } from '../../utils/index.mjs'
import { CONFIG } from './config.mjs'
import { cleanupDeletedTemplate } from './post-build/route-cleanup.mjs'

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
  const templateFileTracker = new Map() // Track existing template files

  // Initialize template file tracker
  for (const watchPath of watchPaths) {
    if (existsSync(watchPath) && watchPath.includes('themes')) {
      const { readdir } = await import('fs/promises')
      try {
        const trackTemplates = async (dir, basePath = '') => {
          const entries = await readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = join(dir, entry.name)
            const relativePath = join(basePath, entry.name)

            if (entry.isDirectory()) {
              await trackTemplates(fullPath, relativePath)
            } else if (entry.isFile() && relativePath.includes('/templates/') &&
                       (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
              templateFileTracker.set(relativePath, true)
            }
          }
        }

        await trackTemplates(watchPath)
        verbose(`Tracking ${templateFileTracker.size} template files for deletion detection`)
      } catch (error) {
        verbose(`Failed to initialize template tracker: ${error.message}`)
      }
    }
  }

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

        // ENHANCED: Handle template deletions before rebuilding
        const shouldRebuild = !filename || // Always rebuild if filename is null (deletions)
          filename.endsWith('.config.ts') ||
          filename.endsWith('route.ts') ||
          filename.endsWith('.tsx') ||
          filename.endsWith('.ts') ||
          filename.includes('/templates/') || // Any change in templates directory
          eventType === 'rename' // Catch rename events (often deletions)

        // Handle template file deletions
        if (filename && filename.includes('/templates/') &&
            (filename.endsWith('.tsx') || filename.endsWith('.ts'))) {

          const fullTemplatePath = join(watchPath, filename)
          const wasTracked = templateFileTracker.has(filename)
          const currentlyExists = existsSync(fullTemplatePath)

          // File was deleted (was tracked but no longer exists)
          if (wasTracked && !currentlyExists) {
            log(`Template deleted: ${filename}`, 'info')
            await cleanupDeletedTemplate(fullTemplatePath, CONFIG)
            templateFileTracker.delete(filename)
          }
          // File was added (exists but wasn't tracked)
          else if (!wasTracked && currentlyExists) {
            templateFileTracker.set(filename, true)
            verbose(`Template added to tracker: ${filename}`)
          }
        }

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
