#!/usr/bin/env node

/**
 * Unified Build-Time Registry Generator
 *
 * Consolidates all content discovery into a single, efficient build script.
 * Generates static registries for ultra-fast runtime access (~17,255x performance improvement).
 *
 * Features:
 * - Unified plugin, entity, theme, and config discovery
 * - API endpoint registry generation
 * - TypeScript type generation
 * - Watch mode for development
 * - Turbo-compatible caching
 * - Dynamic project root support (NPM mode)
 */

import { writeFile, mkdir } from 'fs/promises'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import dotenv from 'dotenv'

// Load .env from the correct project root
// Priority: NEXTSPARK_PROJECT_ROOT env var > cwd
// This is critical for npm mode where cwd might be node_modules/@nextsparkjs/core
const envPath = process.env.NEXTSPARK_PROJECT_ROOT
  ? join(process.env.NEXTSPARK_PROJECT_ROOT, '.env')
  : undefined
dotenv.config({ path: envPath, override: true })

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Path from packages/core/scripts/build/ to project root (4 levels up)
const rootDir = join(__dirname, '../../../..')

// Validation functions moved to ./registry/validation/entity-validator.mjs

// Import shared utilities
import { log, verbose, setVerboseMode } from '../utils/index.mjs'
import { getBasename } from '../utils/paths.mjs'

// Import configuration
import { getConfig } from './registry/config.mjs'

// Import discovery modules (migrated from this file)
import { discoverParentChildRelations } from './registry/discovery/parent-child.mjs'
import { discoverPermissionsConfig } from './registry/discovery/permissions.mjs'
import { discoverCoreEntities } from './registry/discovery/core-entities.mjs'
import { discoverPlugins } from './registry/discovery/plugins.mjs'
import { discoverThemes } from './registry/discovery/themes.mjs'
import { discoverMiddlewares } from './registry/discovery/middlewares.mjs'
import { discoverTemplates } from './registry/discovery/templates.mjs'
import { discoverBlocks } from './registry/discovery/blocks.mjs'
import { discoverCoreRoutes } from './registry/discovery/core-routes.mjs'
import { discoverApiPresets } from './registry/discovery/api-presets.mjs'
import { validateEntityConfigurations } from './registry/validation/entity-validator.mjs'
import { generatePluginRegistry, generatePluginRegistryClient } from './registry/generators/plugin-registry.mjs'
import { generateEntityRegistry, generateEntityRegistryClient } from './registry/generators/entity-registry.mjs'
import { generateEntityTypes } from './registry/generators/entity-types.mjs'
import { generateThemeRegistry } from './registry/generators/theme-registry.mjs'
import { generateTemplateRegistry, generateTemplateRegistryClient } from './registry/generators/template-registry.mjs'
import { generateBlockRegistry } from './registry/generators/block-registry.mjs'
import { generateMiddlewareRegistry } from './registry/generators/middleware-registry.mjs'
import { generateRouteHandlersRegistry } from './registry/generators/route-handlers.mjs'
import { generateTranslationRegistry } from './registry/generators/translation-registry.mjs'
import { generateScopeRegistry } from './registry/generators/scope-registry.mjs'
import { generateNamespaceRegistry } from './registry/generators/namespace-registry.mjs'
import { generateBillingRegistry } from './registry/generators/billing-registry.mjs'
import { generateUnifiedRegistry } from './registry/generators/unified-registry.mjs'
import { generateFeatureRegistryFull } from './registry/generators/feature-registry.mjs'
import { generateAuthRegistry } from './registry/generators/auth-registry.mjs'
import { generatePermissionsRegistry } from './registry/generators/permissions-registry.mjs'
import { generateScheduledActionsRegistry } from './registry/generators/scheduled-actions-registry.mjs'
import { generateDocsRegistry } from './registry/generators/docs-registry.mjs'
import { generateApiPresetsRegistry, generateApiDocsRegistry } from './registry/generators/api-presets-registry.mjs'
import {
  generateMissingPages,
  displayTreeStructure,
  generateTestEntitiesJson,
  generateTestBlocksJson,
  cleanupOldRouteFiles,
  cleanupOrphanedTemplates
} from './registry/post-build/index.mjs'
import { watchContents } from './registry/watch.mjs'
import { syncAppGlobalsCss } from './theme.mjs'

// ==================== Registry File Generation ====================

async function generateRegistryFiles(CONFIG, plugins, entities, themes, templates, middlewares, blocks, permissionsConfig, coreRoutes, apiPresetsData) {
  log('Generating registry files...', 'build')

  try {
    // Ensure output directory exists
    await mkdir(CONFIG.outputDir, { recursive: true })

    // Generate client template registry (async - needs to check for server exports)
    const templateRegistryClientContent = await generateTemplateRegistryClient(templates, CONFIG)

    // Generate individual registries (pass CONFIG to all generators)
    const files = [
      { name: 'plugin-registry.ts', content: generatePluginRegistry(plugins, CONFIG) },
      { name: 'plugin-registry.client.ts', content: generatePluginRegistryClient(plugins, CONFIG) },
      { name: 'entity-registry.ts', content: generateEntityRegistry(entities, CONFIG) },
      { name: 'entity-registry.client.ts', content: generateEntityRegistryClient(entities, CONFIG) },
      { name: 'entity-types.ts', content: generateEntityTypes(entities, CONFIG) },
      { name: 'theme-registry.ts', content: generateThemeRegistry(themes, CONFIG) },
      { name: 'route-handlers.ts', content: generateRouteHandlersRegistry(plugins, themes, coreRoutes, entities, CONFIG) },
      { name: 'translation-registry.ts', content: generateTranslationRegistry(themes, CONFIG) },
      { name: 'template-registry.ts', content: generateTemplateRegistry(templates, CONFIG) },
      { name: 'template-registry.client.ts', content: templateRegistryClientContent },
      { name: 'block-registry.ts', content: generateBlockRegistry(blocks, CONFIG) },
      { name: 'billing-registry.ts', content: await generateBillingRegistry(CONFIG.activeTheme, CONFIG.contentsDir, CONFIG) },
      { name: 'middleware-registry.ts', content: generateMiddlewareRegistry(middlewares, CONFIG) },
      { name: 'scope-registry.ts', content: generateScopeRegistry(entities, CONFIG) },
      { name: 'namespace-registry.ts', content: generateNamespaceRegistry(entities, CONFIG) },
      { name: 'permissions-registry.ts', content: await generatePermissionsRegistry(permissionsConfig, entities, CONFIG) },
      { name: 'scheduled-actions-registry.ts', content: generateScheduledActionsRegistry(themes, CONFIG) },
      { name: 'docs-registry.ts', content: generateDocsRegistry() },
      { name: 'api-presets-registry.ts', content: generateApiPresetsRegistry(apiPresetsData, CONFIG) },
      { name: 'api-docs-registry.ts', content: generateApiDocsRegistry(apiPresetsData, CONFIG) },
      { name: 'index.ts', content: generateUnifiedRegistry(plugins, entities, themes, templates, middlewares, CONFIG) }
    ]

    for (const file of files) {
      const filePath = join(CONFIG.outputDir, file.name)
      await writeFile(filePath, file.content, 'utf8')
      log(`${file.name}`, 'success')
    }

  } catch (error) {
    log(`Error writing registry files: ${error.message}`, 'error')
    process.exit(1)
  }
}
// ==================== Dynamic Parent-Child Discovery ====================

// Parent-child discovery functions migrated to:
// ./registry/discovery/parent-child.mjs

// ==================== Main Build Function ====================

/**
 * Build registries with optional dynamic project root
 * @param {string|null} projectRoot - Optional project root path (for NPM mode)
 */
export async function buildRegistries(projectRoot = null) {
  // Get dynamic configuration
  const CONFIG = getConfig(projectRoot)

  // Initialize verbose mode from config
  setVerboseMode(CONFIG.verbose)

  log('Building Unified Registry System', 'build')
  if (CONFIG.isNpmMode) {
    log(`NPM Mode: Outputting to ${CONFIG.outputDir}`, 'info')
  }
  console.log()

  const startTime = Date.now()

  try {
    // Sync app/globals.css to import from active theme
    // This ensures the import path matches NEXT_PUBLIC_ACTIVE_THEME
    if (CONFIG.activeTheme) {
      syncAppGlobalsCss(CONFIG, CONFIG.activeTheme)
    }

    // Initialize parent-child discovery FIRST (needed for dynamic parseChildEntity)
    log('→ Initializing dynamic parent-child discovery...', 'info')
    await discoverParentChildRelations(CONFIG)

    // Discover all content types in parallel (pass CONFIG to each)
    const [plugins, coreEntities, themes, templates, middlewares, blocks, permissionsConfig, coreRoutes, apiPresetsData] = await Promise.all([
      discoverPlugins(CONFIG),
      discoverCoreEntities(CONFIG),
      discoverThemes(CONFIG),
      discoverTemplates(CONFIG),
      discoverMiddlewares(CONFIG),
      discoverBlocks(CONFIG),
      discoverPermissionsConfig(CONFIG),
      discoverCoreRoutes(CONFIG),
      discoverApiPresets(CONFIG)
    ])

    // Aggregate all entities with proper priority: plugin < core < theme
    // Start with plugin entities (lowest priority)
    const pluginEntities = []
    plugins.forEach(plugin => {
      if (plugin.entities && plugin.entities.length > 0) {
        pluginEntities.push(...plugin.entities)
      }
    })

    // Add theme entities (highest priority - can override core)
    const themeEntities = []
    themes.forEach(theme => {
      if (theme.entities && theme.entities.length > 0) {
        themeEntities.push(...theme.entities)
      }
    })

    // Merge all entities with priority: plugins < core < themes
    const allEntities = [
      ...pluginEntities,      // Lowest priority
      ...coreEntities,        // Core framework entities
      ...themeEntities        // Highest priority (can override core)
    ]

    // PHASE 3 VALIDATION: Ensure all entities have access.shared defined
    await validateEntityConfigurations(allEntities)

    const totalContents = plugins.length + allEntities.length + themes.length + templates.length + middlewares.length + blocks.length

    if (totalContents === 0) {
      log('No contents found!', 'warning')
      return
    }

    // Display beautiful tree structure
    displayTreeStructure(plugins, themes, coreEntities)

    // Clean up old generated route files first
    await cleanupOldRouteFiles(CONFIG)

    // Clean up orphaned template files from previous theme builds
    await cleanupOrphanedTemplates(templates, CONFIG)

    // Hoist plugin dependencies to root workspace for proper resolution
    // Generate all registry files (use aggregated entities for entity registry + blocks)
    await generateRegistryFiles(CONFIG, plugins, allEntities, themes, templates, middlewares, blocks, permissionsConfig, coreRoutes, apiPresetsData)

    // Generate missing pages for templates that don't have core app pages
    await generateMissingPages(templates, CONFIG)

    // Generate test fixtures for the active theme
    await generateTestEntitiesJson(allEntities, themes)
    await generateTestBlocksJson(blocks)

    // Generate feature registry (features, flows, tags)
    if (CONFIG.activeTheme) {
      log('Generating feature registry...', 'build')
      const featureResult = await generateFeatureRegistryFull(
        CONFIG.activeTheme,
        CONFIG.contentsDir,
        CONFIG.outputDir,
        CONFIG
      )

      // Write testing-registry.ts
      await writeFile(featureResult.registryPath, featureResult.registryContent, 'utf8')
      log('testing-registry.ts', 'success')

      // Report validation results
      if (featureResult.validation.errors.length > 0) {
        log('Feature/Flow tag validation errors:', 'error')
        featureResult.validation.errors.forEach(err => {
          console.error(`   ❌ ${err.message}`)
          if (err.files) {
            err.files.forEach(f => console.error(`      → ${f}`))
          }
        })
        process.exit(1)
      }

      if (featureResult.validation.warnings.length > 0) {
        log('Coverage warnings:', 'warning')
        featureResult.validation.warnings.forEach(warn => {
          console.warn(`   ⚠️  ${warn.message}`)
        })
      }

      // Coverage summary
      const summary = {
        features: Object.keys(featureResult.features || {}).length,
        flows: Object.keys(featureResult.flows || {}).length,
        tagsDiscovered: featureResult.discoveredTags.meta.totalTags,
        testFiles: featureResult.discoveredTags.meta.totalFiles,
      }
      console.log(`   Features: ${summary.features}, Flows: ${summary.flows}`)
      console.log(`   Tags: ${summary.tagsDiscovered} from ${summary.testFiles} test files`)
    }

    const endTime = Date.now()
    const buildTime = endTime - startTime

    console.log()
    log('Registry System built successfully!', 'success')
    console.log(`📊 Stats:`)
    console.log(`   Plugins: ${plugins.length}`)
    console.log(`   Entities: ${allEntities.length}`)
    console.log(`   Themes: ${themes.length}`)
    console.log(`   Templates: ${templates.length}`)
    console.log(`   Blocks: ${blocks.length}`)
    console.log(`   Total: ${totalContents}`)
    console.log(`   Build time: ${buildTime}ms`)
    console.log()
    console.log(`🎯 All content types now accessible with zero I/O operations`)


    if (templates.length > 0) {
      console.log(`📄 Template overrides: ${templates.length} templates discovered`)
      const groupedByTheme = templates.reduce((acc, t) => {
        acc[t.themeName] = (acc[t.themeName] || 0) + 1
        return acc
      }, {})
      Object.entries(groupedByTheme).forEach(([theme, count]) => {
        console.log(`   ${theme}: ${count} templates`)
      })
    }

  } catch (error) {
    log(`Build failed: ${error.message}`, 'error')
    if (CONFIG.verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}
// ==================== Direct Execution (Backward Compatibility) ====================

async function main() {
  // Get config for detecting run mode (no projectRoot = auto-detect)
  const config = getConfig()

  if (config.buildMode) {
    log('Running in BUILD mode (watch disabled)', 'build')
    // One-time build for production/CI
    await buildRegistries()
  } else if (config.watchMode) {
    log('Running in WATCH mode (development)', 'info')
    // Initial build
    await buildRegistries()

    // Start watching
    await watchContents(buildRegistries)
  } else {
    log('Running in ONE-TIME mode', 'info')
    // One-time build
    await buildRegistries()
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log()
  log('Build process terminated', 'warning')
  process.exit(0)
})

// Run if executed directly
// Check if this script's filename matches argv[1] (handles symlinks and different path resolutions)
// Uses getBasename to handle cross-platform path separators (Windows backslashes vs POSIX forward slashes)
const isMainScript = process.argv[1] && import.meta.url.endsWith(getBasename(process.argv[1]))
if (isMainScript) {
  main().catch(error => {
    log(`Fatal error: ${error.message}`, 'error')
    const config = getConfig()
    if (config.verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  })
}
