#!/usr/bin/env node

/**
 * Test Entities JSON Generator
 *
 * Auto-generates entities.json for Cypress E2E tests from entity configs.
 * This ensures Cypress POMs always stay in sync with entity configurations.
 *
 * Output: tests/cypress/fixtures/entities.json
 *
 * Usage:
 *   node scripts/build-test-entities.mjs           # Generate for the current project
 *   node scripts/build-test-entities.mjs --watch   # Watch mode
 */

import { readdir, writeFile, mkdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync, watch } from 'fs'
import { resolveProjectPaths } from '../build/registry/project-mode.mjs'

const { projectRoot } = resolveProjectPaths(process.cwd())

// Configuration
const CONFIG = {
  projectRoot,
  watchMode: process.argv.includes('--watch'),
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
async function generateEntitiesJson(projectPath) {
  const entities = await discoverEntities(projectPath)

  if (entities.length === 0) {
    log('No entities found in the project', 'warning')
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

/** Write entities.json to the project's Cypress fixtures directory. */
async function writeEntitiesJson(projectPath, data) {
  const fixturesDir = join(projectPath, 'tests', 'cypress', 'fixtures')
  if (!existsSync(fixturesDir)) await mkdir(fixturesDir, { recursive: true })
  const outputPath = join(fixturesDir, 'entities.json')
  await writeFile(outputPath, JSON.stringify(data, null, 2) + '\n')
  verbose(`  Output: ${outputPath}`)
  return outputPath
}

async function processProject() {
  log('Processing current project', 'build')
  const data = await generateEntitiesJson(CONFIG.projectRoot)
  if (!data) return false
  const outputPath = await writeEntitiesJson(CONFIG.projectRoot, data)
  log(`Generated ${outputPath} (${Object.keys(data.entities).length} entities)`, 'success')
  return true
}

async function main() {
  log('Test Entities JSON Generator', 'build')
  log('============================')
  const startTime = Date.now()
  await processProject()
  log(`Completed in ${Date.now() - startTime}ms`, 'success')

  if (CONFIG.watchMode) {
    log('Watching for changes...', 'info')
    const watchPath = join(CONFIG.projectRoot, 'entities')
    if (existsSync(watchPath)) {
      let debounceTimer = null
      watch(watchPath, { recursive: true }, (_eventType, filename) => {
        if (!filename || !filename.endsWith('.ts')) return
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(async () => {
          log(`Change detected: ${filename}`, 'info')
          await processProject()
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
