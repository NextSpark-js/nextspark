/**
 * Theme Discovery
 *
 * Discovers themes and their configurations.
 * In monorepo mode: themes/ at repo root
 * In user project mode: contents/themes/
 *
 * @module core/scripts/build/registry/discovery/themes
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { verbose, extractExportName, extractHttpMethods } from '../../../utils/index.mjs'
import { discoverNestedEntities } from './entities.mjs'

/**
 * Discover all themes
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<Array>} Array of discovered themes
 */
export async function discoverThemes(config = DEFAULT_CONFIG) {
  const themesDir = config.themesDir
  const themes = []

  // Only process the active theme if specified
  if (!config.activeTheme) {
    verbose(`Warning: NEXT_PUBLIC_ACTIVE_THEME not set, processing all themes`)

    try {
      const entries = await readdir(themesDir, { withFileTypes: true })
      const themeDirs = entries.filter(entry => entry.isDirectory())

      for (const dir of themeDirs) {
        const themeName = dir.name
        const configPath = join(themesDir, themeName, 'config', 'theme.config.ts')

        try {
          await stat(configPath)

          // Extract theme config export name and plugin dependencies
          const configContent = await readFile(configPath, 'utf8')
          const exportMatch = configContent.match(/export\s+const\s+([a-zA-Z]+ThemeConfig)\s*[:=]/)
          const exportName = exportMatch ? exportMatch[1] : null

          // Extract plugin dependencies from theme config
          const pluginsMatch = configContent.match(/plugins:\s*\[([^\]]+)\]/)
          const plugins = pluginsMatch
            ? pluginsMatch[1].split(',').map(p => p.trim().replace(/['"]/g, '')).filter(Boolean)
            : []

          // Check for theme directories
          const componentsPath = join(themesDir, themeName, 'components')
          const stylesPath = join(themesDir, themeName, 'styles')
          const assetsPath = join(themesDir, themeName, 'assets')
          const messagesPath = join(themesDir, themeName, 'messages')

          const hasComponents = existsSync(componentsPath)
          const hasStyles = existsSync(stylesPath)
          const hasAssets = existsSync(assetsPath)
          const hasMessages = existsSync(messagesPath)

          // Check for entities within theme
          const themeEntitiesPath = join(themesDir, themeName, 'entities')
          let themeEntities = []

          try {
            await stat(themeEntitiesPath)
            themeEntities = await discoverNestedEntities(
              config,
              themeEntitiesPath,
              '',
              0,
              null,
              { type: 'theme', name: themeName }
            )
            verbose(`Theme ${themeName} has ${themeEntities.length} entities`)
          } catch {
            // No entities directory in theme
          }

          // Check for API routes within theme
          const themeApiPath = join(themesDir, themeName, 'api')
          let themeRouteFiles = []

          try {
            await stat(themeApiPath)
            themeRouteFiles = await discoverThemeRouteFiles(themeApiPath, themeName)
          } catch {
            // No API directory in theme
          }

          // Check for dashboard config
          const dashboardConfigPath = join(themesDir, themeName, 'config', 'dashboard.config.ts')
          let hasDashboardConfig = false
          let dashboardConfigExportName = null

          try {
            await stat(dashboardConfigPath)
            hasDashboardConfig = true

            // Extract dashboard config export name
            dashboardConfigExportName = await extractExportName(dashboardConfigPath, [
              /export\s+const\s+([a-zA-Z_]+(?:DASHBOARD_CONFIG|DashboardConfig))\s*[:=]/,
              /export\s+default\s+([a-zA-Z_]+(?:DASHBOARD_CONFIG|DashboardConfig))/
            ])
          } catch {
            // No dashboard.config.ts in theme
          }

          // Check for app config
          const appConfigPath = join(themesDir, themeName, 'config', 'app.config.ts')
          let hasAppConfig = false
          let appConfigExportName = null

          try {
            await stat(appConfigPath)
            hasAppConfig = true

            // Extract app config export name
            appConfigExportName = await extractExportName(appConfigPath, [
              /export\s+const\s+([a-zA-Z_]+(?:APP_CONFIG|AppConfig))\s*[:=]/,
              /export\s+default\s+([a-zA-Z_]+(?:APP_CONFIG|AppConfig))/
            ])
          } catch {
            // No app.config.ts in theme
          }

          // Check for dev config (development-only settings)
          const devConfigPath = join(themesDir, themeName, 'config', 'dev.config.ts')
          let hasDevConfig = false
          let devConfigExportName = null

          try {
            await stat(devConfigPath)
            hasDevConfig = true

            // Extract dev config export name
            devConfigExportName = await extractExportName(devConfigPath, [
              /export\s+const\s+([a-zA-Z_]+(?:DEV_CONFIG|DevConfig))\s*[:=]/,
              /export\s+default\s+([a-zA-Z_]+(?:DEV_CONFIG|DevConfig))/
            ])
          } catch {
            // No dev.config.ts in theme
          }

          // Check for scheduled actions initializer
          const scheduledActionsPath = join(themesDir, themeName, 'lib', 'scheduled-actions', 'index.ts')
          const hasScheduledActions = existsSync(scheduledActionsPath)

          themes.push({
            name: themeName,
            exportName,
            configPath: `@/contents/themes/${themeName}/config/theme.config`,
            hasComponents,
            hasStyles,
            hasAssets,
            hasMessages,
            hasDashboardConfig,
            dashboardConfigPath: hasDashboardConfig ? `@/contents/themes/${themeName}/config/dashboard.config` : null,
            dashboardConfigExportName,
            hasAppConfig,
            appConfigPath: hasAppConfig ? `@/contents/themes/${themeName}/config/app.config` : null,
            appConfigExportName,
            hasDevConfig,
            devConfigPath: hasDevConfig ? `@/contents/themes/${themeName}/config/dev.config` : null,
            devConfigExportName,
            hasScheduledActions,
            scheduledActionsPath: hasScheduledActions ? `@/contents/themes/${themeName}/lib/scheduled-actions` : null,
            componentsPath: hasComponents ? `@/contents/themes/${themeName}/components` : null,
            stylesPath: hasStyles ? `@/contents/themes/${themeName}/styles` : null,
            assetsPath: hasAssets ? `@/contents/themes/${themeName}/assets` : null,
            messagesPath: hasMessages ? `@/contents/themes/${themeName}/messages` : null,
            entities: themeEntities,
            routeFiles: themeRouteFiles,
            plugins // Plugin dependencies
          })

          const features = [
            hasComponents && 'components',
            hasStyles && 'styles',
            hasAssets && 'assets',
            hasMessages && 'messages',
            hasDashboardConfig && 'dashboard-config',
            hasAppConfig && 'app-config',
            hasDevConfig && 'dev-config',
            hasScheduledActions && 'scheduled-actions',
            themeEntities.length > 0 && `${themeEntities.length} entities`,
            themeRouteFiles.length > 0 && `${themeRouteFiles.length} routes`,
            plugins.length > 0 && `uses: [${plugins.join(', ')}]`
          ].filter(Boolean).join(', ') || 'config only'

          verbose(`Theme found: ${themeName} (${features})`)

        } catch {
          verbose(`${themeName} (no theme.config.ts)`)
        }
      }

    } catch (error) {
      verbose(`Error scanning themes directory: ${error.message}`)
      return []
    }
  } else {
    // Process only the active theme
    verbose(`Processing only active theme: ${config.activeTheme}`)

    const themeName = config.activeTheme
    const configPath = join(themesDir, themeName, 'config', 'theme.config.ts')

    try {
      await stat(configPath)

      // Extract theme config export name and plugin dependencies
      const configContent = await readFile(configPath, 'utf8')
      const exportMatch = configContent.match(/export\s+const\s+([a-zA-Z]+ThemeConfig)\s*[:=]/)
      const exportName = exportMatch ? exportMatch[1] : null

      // Extract plugin dependencies from theme config
      const pluginsMatch = configContent.match(/plugins:\s*\[([^\]]+)\]/)
      const plugins = pluginsMatch
        ? pluginsMatch[1].split(',').map(p => p.trim().replace(/['"]/g, '')).filter(Boolean)
        : []

      // Check for theme directories
      const componentsPath = join(themesDir, themeName, 'components')
      const stylesPath = join(themesDir, themeName, 'styles')
      const assetsPath = join(themesDir, themeName, 'assets')
      const messagesPath = join(themesDir, themeName, 'messages')

      const hasComponents = existsSync(componentsPath)
      const hasStyles = existsSync(stylesPath)
      const hasAssets = existsSync(assetsPath)
      const hasMessages = existsSync(messagesPath)

      // Check for entities within theme
      const themeEntitiesPath = join(themesDir, themeName, 'entities')
      let themeEntities = []

      try {
        await stat(themeEntitiesPath)
        themeEntities = await discoverNestedEntities(
          config,
          themeEntitiesPath,
          '',
          0,
          null,
          { type: 'theme', name: themeName }
        )
        verbose(`Theme ${themeName} has ${themeEntities.length} entities`)
      } catch {
        // No entities directory in theme
      }

      // Check for API routes within theme
      const themeApiPath = join(themesDir, themeName, 'api')
      let themeRouteFiles = []

      try {
        await stat(themeApiPath)
        themeRouteFiles = await discoverThemeRouteFiles(themeApiPath, themeName)
      } catch {
        // No API directory in theme
      }

      // Check for dashboard config
      const dashboardConfigPath = join(themesDir, themeName, 'config', 'dashboard.config.ts')
      let hasDashboardConfig = false
      let dashboardConfigExportName = null

      try {
        await stat(dashboardConfigPath)
        hasDashboardConfig = true

        // Extract dashboard config export name
        dashboardConfigExportName = await extractExportName(dashboardConfigPath, [
          /export\s+const\s+([a-zA-Z_]+(?:DASHBOARD_CONFIG|DashboardConfig))\s*[:=]/,
          /export\s+default\s+([a-zA-Z_]+(?:DASHBOARD_CONFIG|DashboardConfig))/
        ])
      } catch {
        // No dashboard.config.ts in theme
      }

      // Check for app config
      const appConfigPath = join(themesDir, themeName, 'config', 'app.config.ts')
      let hasAppConfig = false
      let appConfigExportName = null

      try {
        await stat(appConfigPath)
        hasAppConfig = true

        // Extract app config export name
        appConfigExportName = await extractExportName(appConfigPath, [
          /export\s+const\s+([a-zA-Z_]+(?:APP_CONFIG|AppConfig))\s*[:=]/,
          /export\s+default\s+([a-zA-Z_]+(?:APP_CONFIG|AppConfig))/
        ])
      } catch {
        // No app.config.ts in theme
      }

      // Check for dev config (development-only settings)
      const devConfigPath = join(themesDir, themeName, 'config', 'dev.config.ts')
      let hasDevConfig = false
      let devConfigExportName = null

      try {
        await stat(devConfigPath)
        hasDevConfig = true

        // Extract dev config export name
        devConfigExportName = await extractExportName(devConfigPath, [
          /export\s+const\s+([a-zA-Z_]+(?:DEV_CONFIG|DevConfig))\s*[:=]/,
          /export\s+default\s+([a-zA-Z_]+(?:DEV_CONFIG|DevConfig))/
        ])
      } catch {
        // No dev.config.ts in theme
      }

      // Check for scheduled actions initializer
      const scheduledActionsPath = join(themesDir, themeName, 'lib', 'scheduled-actions', 'index.ts')
      const hasScheduledActions = existsSync(scheduledActionsPath)

      themes.push({
        name: themeName,
        exportName,
        configPath: `@/contents/themes/${themeName}/config/theme.config`,
        hasComponents,
        hasStyles,
        hasAssets,
        hasMessages,
        hasDashboardConfig,
        dashboardConfigPath: hasDashboardConfig ? `@/contents/themes/${themeName}/config/dashboard.config` : null,
        dashboardConfigExportName,
        hasAppConfig,
        appConfigPath: hasAppConfig ? `@/contents/themes/${themeName}/config/app.config` : null,
        appConfigExportName,
        hasDevConfig,
        devConfigPath: hasDevConfig ? `@/contents/themes/${themeName}/config/dev.config` : null,
        devConfigExportName,
        hasScheduledActions,
        scheduledActionsPath: hasScheduledActions ? `@/contents/themes/${themeName}/lib/scheduled-actions` : null,
        componentsPath: hasComponents ? `@/contents/themes/${themeName}/components` : null,
        stylesPath: hasStyles ? `@/contents/themes/${themeName}/styles` : null,
        assetsPath: hasAssets ? `@/contents/themes/${themeName}/assets` : null,
        messagesPath: hasMessages ? `@/contents/themes/${themeName}/messages` : null,
        entities: themeEntities,
        routeFiles: themeRouteFiles,
        plugins // Plugin dependencies
      })

      const features = [
        hasComponents && 'components',
        hasStyles && 'styles',
        hasAssets && 'assets',
        hasMessages && 'messages',
        hasDashboardConfig && 'dashboard-config',
        hasAppConfig && 'app-config',
        hasDevConfig && 'dev-config',
        hasScheduledActions && 'scheduled-actions',
        themeEntities.length > 0 && `${themeEntities.length} entities`,
        themeRouteFiles.length > 0 && `${themeRouteFiles.length} routes`,
        plugins.length > 0 && `uses: [${plugins.join(', ')}]`
      ].filter(Boolean).join(', ') || 'config only'

      verbose(`Active theme found: ${themeName} (${features})`)

    } catch (error) {
      verbose(`Active theme ${themeName} error: ${error.message}`)
    }
  }

  return themes
}

/**
 * Discover route files within a theme's API directory
 * @param {string} apiPath - Path to the API directory
 * @param {string} themeName - Name of the theme
 * @returns {Promise<Array>} Array of route file info
 */
export async function discoverThemeRouteFiles(apiPath, themeName) {
  const routeFiles = []

  async function scanDirectory(dir, relativePath = '') {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name

        if (entry.isDirectory()) {
          await scanDirectory(fullPath, currentRelativePath)
        } else if (entry.name === 'route.ts') {
          const routePath = relativePath || '/'
          const endpoint = {
            path: `/theme/${themeName}${routePath === '/' ? '' : '/' + routePath}`,
            filePath: `../../../contents/themes/${themeName}/api${routePath === '/' ? '/route' : '/' + routePath + '/route'}`,
            relativePath: routePath,
            methods: await extractHttpMethods(fullPath),
            isRouteFile: true,
            theme: themeName
          }

          routeFiles.push(endpoint)
          verbose(`Theme route: ${endpoint.path}`)
        }
      }
    } catch (error) {
      verbose(`Error scanning ${dir}: ${error.message}`)
    }
  }

  await scanDirectory(apiPath)
  return routeFiles
}
