/**
 * Core Entity Discovery
 *
 * Discovers entities from packages/core/src/entities/
 * These are framework-level entities that are always available.
 *
 * @module core/scripts/build/registry/discovery/core-entities
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'

import { verbose } from '../../../utils/index.mjs'
import { extractExportName } from '../../../utils/index.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Path from discovery/ to packages/core/src/entities/ (6 levels up + packages/core/src/entities)
const corePackageRoot = join(__dirname, '../../../../../..')

/**
 * Discover all entities from packages/core/src/entities/
 * @param {object} config - Configuration object
 * @returns {Promise<Array>} Array of discovered core entities
 */
export async function discoverCoreEntities(config) {
  const coreEntities = []

  // Determine the core entities directory
  // In NPM mode: node_modules/@nextsparkjs/core/src/entities
  // In monorepo mode: use monorepoRoot/packages/core/src/entities
  let coreEntitiesDir

  if (config.isNpmMode) {
    // NPM mode: core is in node_modules
    coreEntitiesDir = join(config.projectRoot, 'node_modules/@nextsparkjs/core/src/entities')
  } else if (config.isMonorepoMode && config.monorepoRoot) {
    // Monorepo mode: core is at monorepoRoot/packages/core
    coreEntitiesDir = join(config.monorepoRoot, 'packages/core/src/entities')
  } else {
    // Fallback: core is relative to projectRoot
    coreEntitiesDir = join(config.projectRoot, 'packages/core/src/entities')
  }

  verbose(`[core-entities] Scanning ${coreEntitiesDir}`)

  try {
    // Check if directory exists
    if (!existsSync(coreEntitiesDir)) {
      verbose(`[core-entities] No core entities directory found at ${coreEntitiesDir}`)
      return coreEntities
    }

    const entries = await readdir(coreEntitiesDir, { withFileTypes: true })

    // Process only directories (each entity has its own directory)
    const entityDirs = entries.filter(entry => entry.isDirectory())

    for (const dir of entityDirs) {
      const entityName = dir.name
      const entityPath = join(coreEntitiesDir, entityName)

      // Look for config file with entity name pattern
      const configPatterns = [
        `${entityName}.config.ts`,
        `${entityName.slice(0, -1)}.config.ts`,
        `${entityName.replace(/s$/, '')}.config.ts`
      ]

      let configPath = null
      let actualConfigFile = null

      for (const pattern of configPatterns) {
        const testPath = join(entityPath, pattern)
        try {
          await stat(testPath)
          configPath = testPath
          actualConfigFile = pattern
          break
        } catch {
          continue
        }
      }

      if (!configPath) {
        verbose(`[core-entities] Skipping ${entityName} - no config file found`)
        continue
      }

      try {
        // Extract export name from config file
        const exportName = await extractExportName(configPath, [
          /export\s+const\s+([a-zA-Z]+EntityConfig)\s*[:=]/,
          /export\s+const\s+([a-zA-Z]+ChildConfig)\s*[:=]/
        ])

        if (!exportName) {
          verbose(`[core-entities] Skipping ${entityName} - no valid export found in ${actualConfigFile}`)
          continue
        }

        // Check for optional directories
        const componentsPath = join(entityPath, 'components')
        const hooksPath = join(entityPath, 'hooks')
        const migrationsPath = join(entityPath, 'migrations')
        const messagesPath = join(entityPath, 'messages')
        const assetsPath = join(entityPath, 'assets')

        const hasComponents = existsSync(componentsPath)
        const hasHooks = existsSync(hooksPath)
        const hasMigrations = existsSync(migrationsPath)
        const hasMessages = existsSync(messagesPath)
        const hasAssets = existsSync(assetsPath)

        // Core entities use @nextsparkjs/core/entities/... import path
        const configFileName = actualConfigFile.replace('.ts', '')
        const importPath = `@nextsparkjs/core/entities/${entityName}/${configFileName}`
        const messagesImportPath = `@nextsparkjs/core/entities/${entityName}/messages`

        const entity = {
          name: entityName,
          exportName,
          configPath: importPath,
          actualConfigFile,
          relativePath: entityName,
          depth: 0,
          parent: null,
          children: [],
          hasComponents,
          hasHooks,
          hasMigrations,
          hasMessages,
          hasAssets,
          messagesPath: messagesImportPath,
          pluginContext: null,
          themeContext: null,
          isCore: true,
          source: 'core'
        }

        coreEntities.push(entity)

        const features = [
          hasComponents && 'components',
          hasHooks && 'hooks',
          hasMigrations && 'migrations',
          hasMessages && 'messages',
          hasAssets && 'assets'
        ].filter(Boolean).join(', ') || 'config only'

        verbose(`[core-entities] Core Entity: ${entityName} (${features})`)

      } catch (error) {
        verbose(`[core-entities] Error processing ${entityName}: ${error.message}`)
      }
    }

  } catch (error) {
    verbose(`[core-entities] Error scanning core entities: ${error.message}`)
  }

  return coreEntities
}
