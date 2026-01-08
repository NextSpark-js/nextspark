/**
 * Entity Discovery
 *
 * Discovers entities from themes, plugins, and standalone entities directory
 *
 * @module core/scripts/build/registry/discovery/entities
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { verbose } from '../../../utils/index.mjs'
import { extractExportName } from '../../../utils/index.mjs'

/**
 * Recursively discover nested entities within a base directory
 * Supports both plugin and theme contexts
 * @param {object} config - Configuration object
 * @param {string} basePath - Base path to scan
 * @param {string} relativePath - Relative path from base
 * @param {number} depth - Current recursion depth
 * @param {string|null} parentName - Parent entity name
 * @param {object|null} ownerContext - Owner context { type: 'plugin'|'theme', name: string }
 * @returns {Promise<Array>} Array of discovered entities
 */
export async function discoverNestedEntities(config, basePath, relativePath = '', depth = 0, parentName = null, ownerContext = null) {
  const entities = []

  try {
    const entries = await readdir(basePath, { withFileTypes: true })

    // Check if this is a child directory with config files directly inside
    const configFiles = entries.filter(entry => entry.isFile() && entry.name.endsWith('.config.ts') && entry.name !== 'index.ts')

    if (configFiles.length > 0) {
      // This is a child directory with config files directly inside
      for (const configFile of configFiles) {
        let entityName = configFile.name.replace('.config.ts', '')
        const configPath = join(basePath, configFile.name)

        try {
          const exportName = await extractExportName(configPath, [
            /export\s+const\s+([a-zA-Z]+EntityConfig)\s*[:=]/,
            /export\s+const\s+([a-zA-Z]+ChildConfig)\s*[:=]/
          ])

          if (!exportName) {
            verbose(`${entityName} (no valid EntityConfig or ChildConfig export found in ${configFile.name})`)
            continue
          }

          // For child entities, extract table name from config to use as entity name
          if (exportName.includes('ChildConfig')) {
            const configContent = await readFile(configPath, 'utf-8')
            const tableMatch = configContent.match(/table:\s*['"]([^'"]+)['"]/)
            if (tableMatch) {
              entityName = tableMatch[1]
            }
          }

          const currentRelativePath = relativePath ? `${relativePath}/${entityName}` : entityName

          // Determine base import path based on owner context
          let baseImportPath
          if (ownerContext?.type === 'plugin') {
            baseImportPath = `@/contents/plugins/${ownerContext.name}/entities/${currentRelativePath}`
          } else if (ownerContext?.type === 'theme') {
            baseImportPath = `@/contents/themes/${ownerContext.name}/entities/${currentRelativePath}`
          } else {
            baseImportPath = `@/contents/entities/${currentRelativePath}`
          }

          entities.push({
            name: entityName,
            exportName,
            configPath: join(basePath, configFile.name).replace(config.contentsDir + '/', '@/contents/'),
            actualConfigFile: configFile.name,
            relativePath: currentRelativePath,
            depth,
            parent: parentName,
            children: [],
            hasComponents: false,
            hasHooks: false,
            hasMigrations: false,
            hasMessages: false,
            hasAssets: false,
            messagesPath: `${baseImportPath}/messages`,
            pluginContext: ownerContext?.type === 'plugin' ? { pluginName: ownerContext.name } : null,
            themeContext: ownerContext?.type === 'theme' ? { themeName: ownerContext.name } : null,
            source: ownerContext?.type || 'theme'
          })

          const contextLabel = ownerContext ? `[${ownerContext.name}] ` : ''
          verbose(`${contextLabel}Entity: ${currentRelativePath} (config only)`)
        } catch (error) {
          verbose(`${entityName} (error processing ${configFile.name}: ${error.message})`)
        }
      }
    }

    // Process subdirectories for entities with their own directories
    const entityDirs = entries.filter(entry => entry.isDirectory())

    for (const dir of entityDirs) {
      const entityName = dir.name
      const currentPath = join(basePath, entityName)
      const currentRelativePath = relativePath ? `${relativePath}/${entityName}` : entityName

      // Try multiple naming patterns for config files
      const configPatterns = [
        `${entityName}.config.ts`,
        `${entityName.slice(0, -1)}.config.ts`,
        `${entityName.replace(/s$/, '')}.config.ts`
      ]

      let configPath = null
      let actualConfigFile = null

      for (const pattern of configPatterns) {
        const testPath = join(currentPath, pattern)
        try {
          await stat(testPath)
          configPath = testPath
          actualConfigFile = pattern
          break
        } catch {
          continue
        }
      }

      // If no pattern matched, try to find any .config.ts file in the directory
      if (!configPath) {
        try {
          const dirContents = await readdir(currentPath, { withFileTypes: true })
          const configFile = dirContents.find(entry =>
            entry.isFile() && entry.name.endsWith('.config.ts') && entry.name !== 'index.ts'
          )

          if (configFile) {
            configPath = join(currentPath, configFile.name)
            actualConfigFile = configFile.name
            verbose(`Found config via fallback search: ${configFile.name} in ${entityName}/`)
          }
        } catch {
          // Directory read failed
        }
      }

      if (!configPath) {
        // Check for nested entities even without config (could be just a container)
        const childPath = join(currentPath, 'children')
        try {
          await stat(childPath)
          const nestedEntities = await discoverNestedEntities(config, childPath, `${currentRelativePath}/children`, depth + 1, entityName, ownerContext)
          entities.push(...nestedEntities)
        } catch {
          // No children directory
        }
        continue
      }

      try {
        const exportName = await extractExportName(configPath, [
          /export\s+const\s+([a-zA-Z]+EntityConfig)\s*[:=]/,
          /export\s+const\s+([a-zA-Z]+ChildConfig)\s*[:=]/
        ])

        if (!exportName) {
          verbose(`${currentRelativePath} (no valid EntityConfig or ChildConfig export found in ${actualConfigFile})`)
          continue
        }

        // For child entities, extract table name from config to use as entity name
        let actualEntityName = entityName
        if (exportName.includes('ChildConfig')) {
          const configContent = await readFile(configPath, 'utf-8')
          const tableMatch = configContent.match(/table:\s*['"]([^'"]+)['"]/)
          if (tableMatch) {
            actualEntityName = tableMatch[1]
          }
        }

        // Check for components, hooks, migrations, messages, assets
        const componentsPath = join(currentPath, 'components')
        const hooksPath = join(currentPath, 'hooks')
        const migrationsPath = join(currentPath, 'migrations')
        const messagesPath = join(currentPath, 'messages')
        const assetsPath = join(currentPath, 'assets')

        const hasComponents = existsSync(componentsPath)
        const hasHooks = existsSync(hooksPath)
        const hasMigrations = existsSync(migrationsPath)
        const hasMessages = existsSync(messagesPath)
        const hasAssets = existsSync(assetsPath)

        // Discover nested child entities
        const children = []
        const childPath = join(currentPath, 'children')
        try {
          await stat(childPath)
          const nestedEntities = await discoverNestedEntities(config, childPath, `${currentRelativePath}/children`, depth + 1, actualEntityName, ownerContext)
          entities.push(...nestedEntities)
          nestedEntities.forEach(ne => children.push(ne.name))
        } catch {
          // No children directory
        }

        const configFileName = actualConfigFile.replace('.ts', '')

        // Determine base import path based on owner context
        let baseImportPath
        if (ownerContext?.type === 'plugin') {
          baseImportPath = `@/contents/plugins/${ownerContext.name}/entities/${currentRelativePath}`
        } else if (ownerContext?.type === 'theme') {
          baseImportPath = `@/contents/themes/${ownerContext.name}/entities/${currentRelativePath}`
        } else {
          baseImportPath = `@/contents/entities/${currentRelativePath}`
        }

        entities.push({
          name: actualEntityName,
          exportName,
          configPath: `${baseImportPath}/${configFileName}`,
          actualConfigFile,
          relativePath: currentRelativePath,
          depth,
          parent: parentName,
          children,
          hasComponents,
          hasHooks,
          hasMigrations,
          hasMessages,
          hasAssets,
          messagesPath: `${baseImportPath}/messages`,
          pluginContext: ownerContext?.type === 'plugin' ? { pluginName: ownerContext.name } : null,
          themeContext: ownerContext?.type === 'theme' ? { themeName: ownerContext.name } : null,
          source: ownerContext?.type || 'theme'
        })

        const features = [
          hasComponents && 'components',
          hasHooks && 'hooks',
          hasMigrations && 'migrations',
          hasMessages && 'messages',
          hasAssets && 'assets'
        ].filter(Boolean).join(', ') || 'config only'

        const childInfo = children.length > 0 ? ` [${children.length} children]` : ''
        const contextLabel = ownerContext ? `[${ownerContext.name}] ` : ''
        verbose(`${contextLabel}Entity: ${currentRelativePath} (${features})${childInfo}`)

      } catch (error) {
        verbose(`${currentRelativePath} (error processing ${actualConfigFile}: ${error.message})`)
      }
    }

  } catch (error) {
    verbose(`Error scanning ${basePath}: ${error.message}`)
  }

  return entities
}

/**
 * Discover all entities (standalone entities in contents/entities)
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<Array>} Array of discovered entities
 */
export async function discoverEntities(config = DEFAULT_CONFIG) {
  const entitiesDir = join(config.contentsDir, 'entities')

  try {
    const entities = await discoverNestedEntities(config, entitiesDir)
    return entities
  } catch (error) {
    verbose(`Error scanning entities directory: ${error.message}`)
    return []
  }
}
