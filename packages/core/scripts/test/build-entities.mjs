#!/usr/bin/env node

/**
 * Test Entities JSON Generator
 *
 * Auto-generates entities.json for Cypress E2E tests from entity configs.
 * This ensures Cypress POMs always stay in sync with entity configurations.
 *
 * Output: contents/themes/{theme}/tests/cypress/fixtures/entities.json
 *
 * Usage:
 *   node scripts/build-test-entities.mjs           # Generate for active theme
 *   node scripts/build-test-entities.mjs --watch   # Watch mode
 *   node scripts/build-test-entities.mjs --all     # Generate for all themes
 */

import { readdir, writeFile, mkdir, readFile, stat } from 'fs/promises'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, watch } from 'fs'
import dotenv from 'dotenv'

dotenv.config({ override: true })

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Path from packages/core/scripts/test/ to project root (4 levels up)
const rootDir = join(__dirname, '../../../..')

// Configuration
const CONFIG = {
  contentsDir: join(rootDir, 'contents', 'themes'),
  activeTheme: process.env.NEXT_PUBLIC_ACTIVE_THEME?.replace(/'/g, '') || 'team-manager',
  watchMode: process.argv.includes('--watch'),
  allThemes: process.argv.includes('--all'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
}

// Logging utilities
function log(message, type = 'info') {
  const prefix = {
    info: '🔍',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    build: '🏗️ ',
  }[type] || '📝'

  console.log(`${prefix} ${message}`)
}

function verbose(message) {
  if (CONFIG.verbose) {
    console.log(`   ${message}`)
  }
}

/**
 * Discover all entities in a theme's entities directory
 */
async function discoverEntities(themeDir) {
  const entitiesDir = join(themeDir, 'entities')

  if (!existsSync(entitiesDir)) {
    verbose(`No entities directory found in ${themeDir}`)
    return []
  }

  const entries = await readdir(entitiesDir, { withFileTypes: true })
  const entities = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const entityDir = join(entitiesDir, entry.name)
    const configFiles = await readdir(entityDir)
    const configFile = configFiles.find(f => f.endsWith('.config.ts'))

    if (!configFile) {
      verbose(`No config file found for entity: ${entry.name}`)
      continue
    }

    const configPath = join(entityDir, configFile)
    const fieldsFile = configFiles.find(f => f.endsWith('.fields.ts'))

    entities.push({
      name: entry.name,
      configPath,
      fieldsPath: fieldsFile ? join(entityDir, fieldsFile) : null,
    })
  }

  return entities
}

/**
 * Parse TypeScript config file to extract entity metadata
 * Note: This is a simple regex-based parser for the specific structure we use
 */
async function parseEntityConfig(configPath) {
  const content = await readFile(configPath, 'utf-8')

  // Extract slug
  const slugMatch = content.match(/slug:\s*['"]([^'"]+)['"]/)
  const slug = slugMatch ? slugMatch[1] : null

  // Extract tableName
  const tableNameMatch = content.match(/tableName:\s*['"]([^'"]+)['"]/)
  const tableName = tableNameMatch ? tableNameMatch[1] : slug

  // Extract singular name
  const singularMatch = content.match(/singular:\s*['"]([^'"]+)['"]/)
  const singular = singularMatch ? singularMatch[1] : null

  // Extract plural name
  const pluralMatch = content.match(/plural:\s*['"]([^'"]+)['"]/)
  const plural = pluralMatch ? pluralMatch[1] : null

  return { slug, tableName, singular, plural }
}

/**
 * Parse TypeScript fields file to extract field names and sections
 */
async function parseEntityFields(fieldsPath) {
  if (!fieldsPath || !existsSync(fieldsPath)) {
    return { fields: [], sections: [], filters: [] }
  }

  const content = await readFile(fieldsPath, 'utf-8')

  // Extract field names
  const fieldMatches = content.matchAll(/name:\s*['"]([^'"]+)['"]/g)
  const fields = [...fieldMatches].map(m => m[1])

  // Extract sections from section property if present
  const sectionMatches = content.matchAll(/section:\s*['"]([^'"]+)['"]/g)
  const sections = [...new Set([...sectionMatches].map(m => m[1]))]

  // Extract filterable fields (fields with filter: true or in filterConfig)
  const filterMatches = content.matchAll(/name:\s*['"]([^'"]+)['"][^}]*?(?:filterable:\s*true|filter:\s*{)/gs)
  const filters = [...filterMatches].map(m => m[1])

  // Also check for explicit filter options
  const filterableFields = content.matchAll(/name:\s*['"]([^'"]+)['"][^}]*showInFilter:\s*true/gs)
  const additionalFilters = [...filterableFields].map(m => m[1])

  const allFilters = [...new Set([...filters, ...additionalFilters])]

  return {
    fields: fields.filter(f => !['createdAt', 'updatedAt', 'deletedAt', 'id'].includes(f)),
    sections: sections.length > 0 ? sections : ['basic'],
    filters: allFilters,
  }
}

/**
 * Generate entities.json for a specific theme
 */
async function generateEntitiesJson(themePath, themeName) {
  const entities = await discoverEntities(themePath)

  if (entities.length === 0) {
    log(`No entities found in theme: ${themeName}`, 'warning')
    return null
  }

  const entitiesData = {}

  for (const entity of entities) {
    const config = await parseEntityConfig(entity.configPath)
    const { fields, sections, filters } = await parseEntityFields(entity.fieldsPath)

    if (!config.slug) {
      verbose(`Skipping entity without slug: ${entity.name}`)
      continue
    }

    entitiesData[entity.name] = {
      slug: config.slug,
      singular: config.singular || entity.name,
      plural: config.plural || `${entity.name}s`,
      tableName: config.tableName || config.slug,
      fields,
      sections,
      filters,
    }

    verbose(`  Processed: ${entity.name} (${fields.length} fields, ${sections.length} sections)`)
  }

  const output = {
    $schema: './entities.schema.json',
    _comment: 'AUTO-GENERATED - Do not edit manually. Run: node scripts/build-test-entities.mjs',
    _convention: '{slug}-{component}-{detail} - e.g., people-form-submit, squads-field-name',
    _lastUpdated: new Date().toISOString().split('T')[0],

    entities: entitiesData,

    selectors: {
      _description: 'Standard data-cy selector patterns for all entities',

      list: {
        page: '{slug}-page',
        table: '{slug}-table',
        row: '{slug}-row-{id}',
        card: '{slug}-card-{id}',
        createBtn: '{slug}-create-btn',
        search: '{slug}-search',
        searchInput: '{slug}-search-input',
        filter: '{slug}-filter-{field}',
        filterTrigger: '{slug}-filter-{field}-trigger',
        filterOption: '{slug}-filter-{field}-option-{value}',
        pagination: '{slug}-pagination',
        paginationPrev: '{slug}-pagination-prev',
        paginationNext: '{slug}-pagination-next',
        bulkActions: '{slug}-bulk-actions',
        emptyState: '{slug}-empty',
      },

      form: {
        page: '{slug}-form-page',
        form: '{slug}-form',
        submit: '{slug}-form-submit',
        cancel: '{slug}-form-cancel',
        section: '{slug}-section-{name}',
        field: '{slug}-field-{name}',
        fieldInput: '{slug}-field-{name} input',
        fieldTextarea: '{slug}-field-{name} textarea',
        fieldSelect: '{slug}-field-{name} [role="combobox"]',
        fieldOption: '{slug}-field-{name}-option-{value}',
        fieldError: '{slug}-field-{name}-error',
      },

      actions: {
        edit: '{slug}-action-edit-{id}',
        delete: '{slug}-action-delete-{id}',
        view: '{slug}-action-view-{id}',
        dropdown: '{slug}-actions-{id}',
        dropdownTrigger: '{slug}-actions-trigger-{id}',
      },

      dialogs: {
        confirmDelete: '{slug}-confirm-delete',
        confirmDeleteBtn: '{slug}-confirm-delete-btn',
        cancelDeleteBtn: '{slug}-cancel-delete-btn',
      },
    },
  }

  return output
}

/**
 * Write entities.json to the theme's Cypress fixtures directory
 *
 * New location (theme-level testing):
 *   contents/themes/{theme}/tests/cypress/fixtures/entities.json
 *
 * Legacy location (for backwards compatibility):
 *   core/tests/cypress/fixtures/themes/{theme}/entities.json
 */
async function writeEntitiesJson(themePath, themeName, data) {
  // New location: theme-level Cypress fixtures
  const themeFixturesDir = join(themePath, 'tests', 'cypress', 'fixtures')
  // Legacy location: central Cypress fixtures (for backwards compatibility)
  const centralFixturesDir = join(rootDir, 'core', 'tests', 'cypress', 'fixtures', 'themes', themeName)

  // Ensure directories exist
  if (!existsSync(themeFixturesDir)) {
    await mkdir(themeFixturesDir, { recursive: true })
  }
  if (!existsSync(centralFixturesDir)) {
    await mkdir(centralFixturesDir, { recursive: true })
  }

  const jsonContent = JSON.stringify(data, null, 2) + '\n'

  // Primary location: theme-level
  const outputPath = join(themeFixturesDir, 'entities.json')
  // Secondary location: central (backwards compatibility)
  const legacyOutputPath = join(centralFixturesDir, 'entities.json')

  await writeFile(outputPath, jsonContent)
  await writeFile(legacyOutputPath, jsonContent)

  verbose(`  Primary: ${outputPath}`)
  verbose(`  Legacy:  ${legacyOutputPath}`)

  return outputPath
}

/**
 * Process a single theme
 */
async function processTheme(themeName) {
  const themePath = join(CONFIG.contentsDir, themeName)

  if (!existsSync(themePath)) {
    log(`Theme not found: ${themeName}`, 'error')
    return false
  }

  log(`Processing theme: ${themeName}`, 'build')

  const data = await generateEntitiesJson(themePath, themeName)

  if (!data) {
    return false
  }

  const outputPath = await writeEntitiesJson(themePath, themeName, data)
  const entityCount = Object.keys(data.entities).length

  log(`Generated ${outputPath} (${entityCount} entities)`, 'success')
  return true
}

/**
 * Main execution
 */
async function main() {
  log('Test Entities JSON Generator', 'build')
  log('============================')

  const startTime = Date.now()

  if (CONFIG.allThemes) {
    // Process all themes
    const themes = await readdir(CONFIG.contentsDir, { withFileTypes: true })

    for (const theme of themes) {
      if (theme.isDirectory()) {
        await processTheme(theme.name)
      }
    }
  } else {
    // Process only active theme
    await processTheme(CONFIG.activeTheme)
  }

  const elapsed = Date.now() - startTime
  log(`Completed in ${elapsed}ms`, 'success')

  // Watch mode
  if (CONFIG.watchMode) {
    log('Watching for changes...', 'info')

    const watchPath = join(CONFIG.contentsDir, CONFIG.activeTheme, 'entities')

    if (existsSync(watchPath)) {
      let debounceTimer = null

      watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (!filename || !filename.endsWith('.ts')) return

        // Debounce rebuilds
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(async () => {
          log(`Change detected: ${filename}`, 'info')
          await processTheme(CONFIG.activeTheme)
        }, 500)
      })
    }
  }
}

main().catch(err => {
  log(`Error: ${err.message}`, 'error')
  console.error(err)
  process.exit(1)
})
