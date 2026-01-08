/**
 * Middleware Discovery
 *
 * Discovers middleware configurations from themes
 *
 * @module core/scripts/build/registry/discovery/middlewares
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join } from 'path'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { verbose } from '../../../utils/index.mjs'

/**
 * Discover middlewares from the active theme
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<Array>} Array of discovered middlewares
 */
export async function discoverMiddlewares(config = DEFAULT_CONFIG) {
  const themesDir = config.themesDir
  const middlewares = []

  // Only check the active theme if specified
  if (!config.activeTheme) {
    verbose('Warning: NEXT_PUBLIC_ACTIVE_THEME not set, checking all themes for middleware')

    try {
      const entries = await readdir(themesDir, { withFileTypes: true })
      const themeDirs = entries.filter(entry => entry.isDirectory())

      for (const dir of themeDirs) {
        const themeName = dir.name
        const middlewarePath = join(themesDir, themeName, 'middleware.ts')

        try {
          await stat(middlewarePath)

          // Extract export information
          const middlewareContent = await readFile(middlewarePath, 'utf8')
          const middlewareExportMatch = middlewareContent.match(/export\s+(?:async\s+)?function\s+middleware\s*\(/)
          const defaultExportMatch = middlewareContent.match(/export\s+default\s+/)

          if (middlewareExportMatch || defaultExportMatch) {
            middlewares.push({
              themeName,
              middleware: null, // Will be imported at runtime
              middlewarePath: `@/contents/themes/${themeName}/middleware`,
              middlewareExportName: middlewareExportMatch ? 'middleware' : 'default',
              exists: true
            })

            verbose(`Found middleware override in theme: ${themeName}`)
          }
        } catch (error) {
          // No middleware.ts file in this theme, skip
          verbose(`No middleware.ts found in theme: ${themeName}`)
        }
      }
    } catch (error) {
      verbose('No themes directory found')
      return middlewares
    }
  } else {
    // Check only the active theme
    const middlewarePath = join(themesDir, config.activeTheme, 'middleware.ts')

    try {
      await stat(middlewarePath)

      // Extract export information
      const middlewareContent = await readFile(middlewarePath, 'utf8')
      const middlewareExportMatch = middlewareContent.match(/export\s+(?:async\s+)?function\s+middleware\s*\(/)
      const defaultExportMatch = middlewareContent.match(/export\s+default\s+/)

      if (middlewareExportMatch || defaultExportMatch) {
        middlewares.push({
          themeName: config.activeTheme,
          middleware: null, // Will be imported at runtime
          middlewarePath: `@/contents/themes/${config.activeTheme}/middleware`,
          middlewareExportName: middlewareExportMatch ? 'middleware' : 'default',
          exists: true
        })

        verbose(`Found middleware override in active theme: ${config.activeTheme}`)
      }
    } catch (error) {
      verbose(`No middleware.ts found in active theme: ${config.activeTheme}`)
    }
  }

  return middlewares
}
