/** Discover the single project contribution rooted beside nextspark.config.ts. */

import { readFile, readdir, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { projectImport } from '../project-mode.mjs'
import { verbose, extractExportName, extractHttpMethods } from '../../../utils/index.mjs'
import { discoverNestedEntities } from './entities.mjs'

export async function discoverThemes(config = DEFAULT_CONFIG) {
  const root = config.projectSourceDir
  const configPath = join(root, 'config', 'theme.config.ts')
  if (!existsSync(configPath)) return []

  const configContent = await readFile(configPath, 'utf8')
  const exportMatch = configContent.match(/export\s+const\s+([a-zA-Z_$][\w$]*ThemeConfig)\s*[:=]/)
  const nameMatch = configContent.match(/\bname:\s*['"]([^'"]+)['"]/)
  const themeName = nameMatch?.[1] || 'project'
  const pluginsMatch = configContent.match(/plugins:\s*\[([^\]]*)\]/)
  const plugins = pluginsMatch
    ? pluginsMatch[1].split(',').map(value => value.trim().replace(/['"]/g, '')).filter(Boolean)
    : config.plugins

  const themeEntitiesPath = join(root, 'entities')
  const entities = existsSync(themeEntitiesPath)
    ? await discoverNestedEntities(config, themeEntitiesPath, '', 0, null, { type: 'project', name: themeName })
    : []
  const apiPath = join(root, 'api')
  const routeFiles = existsSync(apiPath) ? await discoverThemeRouteFiles(apiPath, themeName) : []

  async function optionalConfig(name, patterns) {
    const path = join(root, 'config', name)
    try {
      await stat(path)
      return { exists: true, exportName: await extractExportName(path, patterns) }
    } catch {
      return { exists: false, exportName: null }
    }
  }

  const dashboard = await optionalConfig('dashboard.config.ts', [
    /export\s+const\s+([a-zA-Z_]+(?:DASHBOARD_CONFIG|DashboardConfig))\s*[:=]/,
    /export\s+default\s+([a-zA-Z_]+(?:DASHBOARD_CONFIG|DashboardConfig))/,
  ])
  const app = await optionalConfig('app.config.ts', [
    /export\s+const\s+([a-zA-Z_]+(?:APP_CONFIG|AppConfig))\s*[:=]/,
    /export\s+default\s+([a-zA-Z_]+(?:APP_CONFIG|AppConfig))/,
  ])
  const dev = await optionalConfig('dev.config.ts', [
    /export\s+const\s+([a-zA-Z_]+(?:DEV_CONFIG|DevConfig))\s*[:=]/,
    /export\s+default\s+([a-zA-Z_]+(?:DEV_CONFIG|DevConfig))/,
  ])

  const theme = {
    name: themeName,
    exportName: exportMatch?.[1] ?? null,
    configPath: projectImport('config/theme.config'),
    hasComponents: existsSync(join(root, 'components')),
    hasStyles: existsSync(join(root, 'styles')),
    hasAssets: existsSync(join(root, 'assets')),
    hasMessages: existsSync(join(root, 'messages')),
    hasDashboardConfig: dashboard.exists,
    dashboardConfigPath: dashboard.exists ? projectImport('config/dashboard.config') : null,
    dashboardConfigExportName: dashboard.exportName,
    hasAppConfig: app.exists,
    appConfigPath: app.exists ? projectImport('config/app.config') : null,
    appConfigExportName: app.exportName,
    hasDevConfig: dev.exists,
    devConfigPath: dev.exists ? projectImport('config/dev.config') : null,
    devConfigExportName: dev.exportName,
    hasScheduledActions: existsSync(join(root, 'lib', 'scheduled-actions', 'index.ts')),
    scheduledActionsPath: existsSync(join(root, 'lib', 'scheduled-actions', 'index.ts')) ? projectImport('lib/scheduled-actions') : null,
    componentsPath: existsSync(join(root, 'components')) ? projectImport('components') : null,
    stylesPath: existsSync(join(root, 'styles')) ? projectImport('styles') : null,
    assetsPath: existsSync(join(root, 'assets')) ? projectImport('assets') : null,
    messagesPath: existsSync(join(root, 'messages')) ? projectImport('messages') : null,
    entities,
    routeFiles,
    plugins,
  }
  verbose(`Project source found as ${themeName}: ${entities.length} entities, ${routeFiles.length} routes`)
  return [theme]
}

export async function discoverThemeRouteFiles(apiPath, themeName) {
  const routeFiles = []
  async function scanDirectory(dir, relativePath = '') {
    try {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name)
        const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name
        if (entry.isDirectory()) await scanDirectory(fullPath, currentRelativePath)
        else if (entry.name === 'route.ts') {
          const routePath = relativePath || '/'
          routeFiles.push({
            path: `/theme/${themeName}${routePath === '/' ? '' : `/${routePath}`}`,
            filePath: projectImport(`api${routePath === '/' ? '/route' : `/${routePath}/route`}`),
            relativePath: routePath,
            methods: await extractHttpMethods(fullPath),
            isRouteFile: true,
            theme: themeName,
          })
        }
      }
    } catch (error) {
      verbose(`Error scanning ${dir}: ${error.message}`)
    }
  }
  await scanDirectory(apiPath)
  return routeFiles
}
