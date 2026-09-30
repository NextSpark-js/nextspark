#!/usr/bin/env node

// First, so what any module prints as it loads is escaped too
import '../utils/console-guard.mjs'

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
 * - Dynamic project root support (NPM mode)
 *
 * Writes registries only, under .nextspark/registries (or NEXTSPARK_REGISTRIES_OUT). `nextspark prepare`
 * runs it into a staging directory and publishes the result together with the generated src/app
 * (registry/host/prepare.mjs); nothing here writes into src/app.
 */

import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Path from packages/core/scripts/build/ to project root (4 levels up)
const rootDir = join(__dirname, '../../../..')

// Validation functions moved to ./registry/validation/entity-validator.mjs

// Import shared utilities
import { log, logFailure, verbose, setVerboseMode } from '../utils/index.mjs'
import { getBasename } from '../utils/paths.mjs'

// Import configuration
import { getConfig, validateEnvironment } from './registry/config.mjs'
import { unsafeWritePlaces, unsafeWritePlacesLines } from './registry/write-places.mjs'
import { projectFiles } from './safe-fs.mjs'

// Import discovery modules (migrated from this file)
import { discoverParentChildRelations } from './registry/discovery/parent-child.mjs'
import { discoverPermissionsConfig } from './registry/discovery/permissions.mjs'
import { discoverCoreEntities } from './registry/discovery/core-entities.mjs'
import { mergeEntities } from './registry/discovery/all-entities.mjs'
import { discoverPlugins } from './registry/discovery/plugins.mjs'
import { pluginsFor } from './registry/discovery/plugin-capabilities.mjs'
import { discoverThemes } from './registry/discovery/themes.mjs'
import { discoverMiddlewares } from './registry/discovery/middlewares.mjs'
import { discoverEmails } from './registry/discovery/emails.mjs'
import { discoverBlocks } from './registry/discovery/blocks.mjs'
import { discoverIcons } from './registry/discovery/icons.mjs'
import { discoverCoreRoutes } from './registry/discovery/core-routes.mjs'
import { discoverApiPresets } from './registry/discovery/api-presets.mjs'
import { discoverMcpOverrides } from './registry/discovery/mcp-overrides.mjs'
import { validateEntityConfigurations } from './registry/validation/entity-validator.mjs'
import { generatePluginRegistry, generatePluginRegistryClient } from './registry/generators/plugin-registry.mjs'
import { generatePluginCatalog } from './registry/generators/plugin-catalog.mjs'
import { generateEntityRegistry, generateEntityRegistryClient } from './registry/generators/entity-registry.mjs'
import { generateEntityTypes } from './registry/generators/entity-types.mjs'
import { generateThemeRegistry, generateThemeRegistryClient, generateAppConfigClient, generateDashboardConfigClient, generateDevKeyringClient } from './registry/generators/theme-registry.mjs'
import { generateEmailRegistry } from './registry/generators/email-registry.mjs'
import { generateBlockRegistry, generateBlockRegistryClient, generateBlockRegistryLazy, generateBlockSchemas } from './registry/generators/block-registry.mjs'
import { generateIconRegistry } from './registry/generators/icon-registry.mjs'
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
import { generateMcpRegistry } from './registry/generators/mcp-registry.mjs'
import {
  displayTreeStructure,
  generateTestEntitiesJson,
  generateTestBlocksJson
} from './registry/post-build/index.mjs'

// ==================== Registry File Generation ====================

async function generateRegistryFiles(CONFIG, plugins, entities, themes, middlewares, blocks, permissionsConfig, coreRoutes, apiPresetsData, emails, mcpOverridesData) {
  log('Generating registry files...', 'build')

  try {
    const files = projectFiles(CONFIG.projectRoot)

    // Ensure output directory exists
    await files.mkdir(CONFIG.outputDir, { recursive: true })

    // Collect the icon names configs can ask for by string (async - reads configs)
    const iconNames = await discoverIcons(blocks, CONFIG)

    // Each registry takes only the plugins that declare its surface: the server registries the
    // 'server' plugins, the client registry the 'web' ones (a build-only or mobile-only plugin is in neither).
    const serverPlugins = pluginsFor(plugins, 'server')
    const webPlugins = pluginsFor(plugins, 'web')

    // Generate individual registries (pass CONFIG to all generators)
    const registries = [
      { name: 'plugin-registry.ts', content: generatePluginRegistry(serverPlugins, CONFIG) },
      { name: 'plugin-registry.client.ts', content: generatePluginRegistryClient(webPlugins, CONFIG) },
      { name: 'plugin-catalog.ts', content: generatePluginCatalog(plugins) },
      { name: 'entity-registry.ts', content: generateEntityRegistry(entities, CONFIG) },
      { name: 'entity-registry.client.ts', content: generateEntityRegistryClient(entities, CONFIG) },
      { name: 'entity-types.ts', content: generateEntityTypes(entities, CONFIG) },
      { name: 'theme-registry.ts', content: generateThemeRegistry(themes, CONFIG) },
      { name: 'theme-registry.client.ts', content: generateThemeRegistryClient(themes, CONFIG) },
      { name: 'app-config.client.ts', content: generateAppConfigClient(themes, CONFIG) },
      { name: 'dashboard-config.client.ts', content: generateDashboardConfigClient(themes, CONFIG) },
      { name: 'dev-keyring.client.ts', content: generateDevKeyringClient(themes, CONFIG) },
      { name: 'route-handlers.ts', content: generateRouteHandlersRegistry(serverPlugins, themes, coreRoutes, entities) },
      { name: 'translation-registry.ts', content: generateTranslationRegistry(themes, CONFIG) },
      { name: 'email-registry.ts', content: generateEmailRegistry(emails, CONFIG) },
      { name: 'block-registry.ts', content: generateBlockRegistry(blocks, CONFIG) },
      { name: 'block-registry.client.ts', content: generateBlockRegistryClient(blocks, CONFIG) },
      { name: 'block-registry.lazy.ts', content: generateBlockRegistryLazy(blocks) },
      { name: 'block-schemas.ts', content: generateBlockSchemas(blocks) },
      { name: 'icon-registry.ts', content: generateIconRegistry(iconNames, CONFIG) },
      { name: 'billing-registry.ts', content: await generateBillingRegistry(CONFIG) },
      { name: 'middleware-registry.ts', content: generateMiddlewareRegistry(middlewares, CONFIG) },
      { name: 'scope-registry.ts', content: generateScopeRegistry(entities, CONFIG) },
      { name: 'namespace-registry.ts', content: generateNamespaceRegistry(entities, CONFIG) },
      { name: 'permissions-registry.ts', content: await generatePermissionsRegistry(permissionsConfig, entities, CONFIG) },
      { name: 'scheduled-actions-registry.ts', content: generateScheduledActionsRegistry(themes, CONFIG) },
      { name: 'docs-registry.ts', content: generateDocsRegistry(CONFIG) },
      { name: 'api-presets-registry.ts', content: generateApiPresetsRegistry(apiPresetsData, CONFIG) },
      { name: 'api-docs-registry.ts', content: generateApiDocsRegistry(apiPresetsData, CONFIG) },
      { name: 'mcp-registry.ts', content: generateMcpRegistry(mcpOverridesData, CONFIG) },
      { name: 'index.ts', content: generateUnifiedRegistry(serverPlugins, entities, themes, middlewares, CONFIG) }
    ]

    for (const file of registries) {
      const filePath = join(CONFIG.outputDir, file.name)
      await files.writeFile(filePath, file.content, 'utf8')
      log(`${file.name}`, 'success')
    }

  } catch (error) {
    logFailure('Error writing registry files', error)
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

  // Validate required environment variables before proceeding
  const validation = validateEnvironment(CONFIG)
  if (!validation.valid) {
    console.error('')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ NextSpark Environment Configuration Error')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('')
    for (const error of validation.errors) {
      error.split('\n').forEach((line, index) => console.error(index === 0 ? `   ${line}` : line))
      console.error('')
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('')
    process.exit(1)
  }

  // Nothing is written, in the project or through it, while a place the build
  // writes under can't take it safely
  const unsafe = unsafeWritePlaces(CONFIG.projectRoot)
  if (unsafe.length > 0) {
    log("Build failed before writing anything: the registry build can't write safely under these paths", 'error')
    for (const line of unsafeWritePlacesLines(unsafe)) console.log(`   ${line}`)
    process.exit(1)
  }

  log('Building Unified Registry System', 'build')
  if (CONFIG.isNpmMode) {
    log(`NPM Mode: Outputting to ${CONFIG.outputDir}`, 'info')
  }
  console.log()

  const startTime = Date.now()

  try {
    // Initialize parent-child discovery FIRST (needed for dynamic parseChildEntity)
    log('→ Initializing dynamic parent-child discovery...', 'info')
    await discoverParentChildRelations(CONFIG)

    // Discover all content types in parallel (pass CONFIG to each)
    const [plugins, coreEntities, themes, middlewares, blocks, permissionsConfig, coreRoutes, apiPresetsData, emails, mcpOverridesData] = await Promise.all([
      discoverPlugins(CONFIG),
      discoverCoreEntities(CONFIG),
      discoverThemes(CONFIG),
      discoverMiddlewares(CONFIG),
      discoverBlocks(CONFIG),
      discoverPermissionsConfig(CONFIG),
      discoverCoreRoutes(CONFIG),
      discoverApiPresets(CONFIG),
      discoverEmails(CONFIG),
      discoverMcpOverrides(CONFIG)
    ])

    // Aggregate all entities with proper priority: plugin < core < project (a project entity can
    // override core's with the same slug, e.g. patterns)
    const allEntities = mergeEntities({
      plugins,
      coreEntities,
      themes,
      onOverride: (entity, replaced) => log(`  ↳ Theme override: "${entity.name}" (${entity.source || 'theme'} replaces ${replaced.source || 'core'})`, 'info'),
    })

    // PHASE 3 VALIDATION: Ensure all entities have access.shared defined
    await validateEntityConfigurations(allEntities, CONFIG)

    const totalContents = plugins.length + allEntities.length + themes.length + middlewares.length + blocks.length

    // A project with no contents still gets its (empty) registries: the host publishes them with src/app
    if (totalContents === 0) log('No contents found!', 'warning')

    // Display beautiful tree structure
    displayTreeStructure(plugins, themes, coreEntities)

    // Hoist plugin dependencies to root workspace for proper resolution
    // Generate all registry files (use aggregated entities for entity registry + blocks)
    await generateRegistryFiles(CONFIG, plugins, allEntities, themes, middlewares, blocks, permissionsConfig, coreRoutes, apiPresetsData, emails, mcpOverridesData)

    // Generate test fixtures for the root-first project.
    await generateTestEntitiesJson(allEntities, themes, CONFIG)
    await generateTestBlocksJson(blocks, CONFIG)

    // Generate feature registry (features, flows, tags)
    {
      log('Generating feature registry...', 'build')
      const featureResult = await generateFeatureRegistryFull(
        CONFIG.projectName,
        CONFIG.projectSourceDir,
        CONFIG.outputDir,
        CONFIG
      )

      // Write testing-registry.ts
      await projectFiles(CONFIG.projectRoot).writeFile(featureResult.registryPath, featureResult.registryContent, 'utf8')
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
    console.log(`   Blocks: ${blocks.length}`)
    console.log(`   Total: ${totalContents}`)
    console.log(`   Build time: ${buildTime}ms`)
    console.log()
    console.log(`🎯 All content types now accessible with zero I/O operations`)

  } catch (error) {
    logFailure('Build failed', error, CONFIG.verbose)
    process.exit(1)
  }
}
// ==================== Direct Execution (Backward Compatibility) ====================

async function main() {
  if (process.argv.includes('--watch')) {
    console.error('registry.mjs no longer watches: nextspark prepare --watch (or nextspark dev) regenerates src/app and the registries on source changes.')
    process.exit(1)
  }
  // One build, whatever the flags: `--build` is what `nextspark prepare` passes, and regenerating
  // on source changes is the generated host's watcher (registry/host/prepare.mjs watchHost)
  log('Running in BUILD mode', 'build')
  await buildRegistries()
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
    logFailure('Fatal error', error, process.argv.includes('--verbose') || process.argv.includes('-v'))
    process.exit(1)
  })
}
