/**
 * Test Fixtures Generator
 *
 * Generates test entity JSON files for Cypress tests
 *
 * @module core/scripts/build/registry/post-build/test-fixtures
 */

import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { log, verbose } from '../../../utils/index.mjs'
import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { projectFiles } from '../../safe-fs.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Path from packages/core/scripts/build/registry/post-build/ to project root (6 levels up)
const rootDir = join(__dirname, '../../../../../..')

/**
 * The directory of the project's Cypress fixtures, which the build writes
 * entities.json and blocks.json into when it exists, and the root those writes
 * may land under: the project's, or the monorepo's, where the themes of the
 * monorepo are.
 *
 * @param {object} config - Configuration object from getConfig()
 * @returns {{ fixturesDir: string, root: string } | null} The project fixture location
 */
export function testFixturesPlace(config) {
  return {
    fixturesDir: join(config.projectSourceDir, 'tests', 'cypress', 'fixtures'),
    root: config.projectRoot,
  }
}

/**
 * Extract test-relevant data from an entity config file using regex
 * @param {string} configPath - Path to the entity config file
 * @param {string} entityDir - Directory containing the entity
 * @returns {Object} Extracted entity data for tests
 */
export async function extractEntityTestData(configPath, entityDir) {
  try {
    const configContent = await readFile(configPath, 'utf8')

    // Extract slug
    const slugMatch = configContent.match(/slug:\s*['"]([^'"]+)['"]/)
    const slug = slugMatch ? slugMatch[1] : null

    // Extract names
    const singularMatch = configContent.match(/singular:\s*['"]([^'"]+)['"]/)
    const pluralMatch = configContent.match(/plural:\s*['"]([^'"]+)['"]/)
    const singular = singularMatch ? singularMatch[1] : slug
    const plural = pluralMatch ? pluralMatch[1] : slug

    // Extract tableName (defaults to slug)
    const tableMatch = configContent.match(/tableName:\s*['"]([^'"]+)['"]/)
    const tableName = tableMatch ? tableMatch[1] : slug

    // Extract filters from ui.dashboard.filters
    const filtersMatch = configContent.match(/filters:\s*\[([\s\S]*?)\]/m)
    const filters = []
    if (filtersMatch) {
      const filterFieldMatches = filtersMatch[1].matchAll(/field:\s*['"]([^'"]+)['"]/g)
      for (const match of filterFieldMatches) {
        filters.push(match[1])
      }
    }

    // Try to read fields from separate .fields.ts file
    const fields = []
    const fieldsFilePath = join(entityDir, `${slug}.fields.ts`)

    if (existsSync(fieldsFilePath)) {
      const fieldsContent = await readFile(fieldsFilePath, 'utf8')
      // Extract field names
      const fieldNameMatches = fieldsContent.matchAll(/name:\s*['"]([^'"]+)['"]/g)
      for (const match of fieldNameMatches) {
        fields.push(match[1])
      }
    } else {
      // Try to extract fields from config file itself
      const fieldsSection = configContent.match(/fields:\s*\[([\s\S]*?)\](?=,?\s*(?:\/\/|\/\*|[a-zA-Z_]+:|$))/m)
      if (fieldsSection) {
        const fieldNameMatches = fieldsSection[1].matchAll(/name:\s*['"]([^'"]+)['"]/g)
        for (const match of fieldNameMatches) {
          fields.push(match[1])
        }
      }
    }

    return { slug, singular, plural, tableName, fields, filters }
  } catch (error) {
    verbose(`Error extracting test data from ${configPath}: ${error.message}`)
    return null
  }
}

/**
 * Generate entities.json test fixture for the project
 * This file is used by Cypress tests (POMs and API Controllers)
 * @param {Array} entities - All discovered entities
 * @param {Array} themes - All discovered themes
 */
export async function generateTestEntitiesJson(entities, themes, CONFIG = DEFAULT_CONFIG) {
  const projectName = CONFIG.projectName
  const theme = themes[0]
  if (!theme) {
    verbose('No project theme config found, skipping test fixtures generation')
    return
  }

  // Check if tests directory exists
  const { fixturesDir, root } = testFixturesPlace(CONFIG)
  if (!existsSync(fixturesDir)) {
    verbose(`Test fixtures directory not found for project "${projectName}", skipping`)
    return
  }

  log(`Generating test fixtures for project: ${projectName}`, 'build')

  // Build entities data
  const entitiesData = {}

  for (const entity of entities) {
    // Determine source
    let source = 'theme'
    if (entity.isCore) {
      source = 'core'
    } else if (entity.pluginContext) {
      source = 'plugin'
    }

    // Get the actual config file path on disk
    let configFilePath = null
    let entityDir = null

    if (entity.isCore) {
      entityDir = join(rootDir, 'core', 'lib', 'entities', 'core', entity.name)
      // Try different config patterns
      configFilePath = join(entityDir, `${entity.name}.config.ts`)
      if (!existsSync(configFilePath) && entity.name.endsWith('s')) {
        const singularName = entity.name.slice(0, -1)
        configFilePath = join(entityDir, `${singularName}.config.ts`)
      }
    } else if (entity.themeContext) {
      entityDir = join(CONFIG.projectSourceDir, 'entities', entity.relativePath)
      configFilePath = join(entityDir, `${entity.name}.config.ts`)
    } else if (entity.pluginContext) {
      entityDir = join(CONFIG.pluginsDir, entity.pluginContext.pluginName, 'entities', entity.relativePath)
      configFilePath = join(entityDir, `${entity.name}.config.ts`)
    }

    if (!configFilePath || !existsSync(configFilePath)) {
      // Fallback: use basic info from entity object
      entitiesData[entity.name] = {
        slug: entity.name,
        singular: entity.name.endsWith('s') ? entity.name.slice(0, -1) : entity.name,
        plural: entity.name.charAt(0).toUpperCase() + entity.name.slice(1),
        tableName: entity.name,
        fields: [],
        filters: [],
        source
      }
      continue
    }

    // Extract detailed data from config
    const testData = await extractEntityTestData(configFilePath, entityDir)
    if (testData) {
      entitiesData[entity.name] = {
        ...testData,
        source
      }
    }
  }

  // Build the full JSON structure (selectors are in separate static file: selectors.json)
  // NOTE: No _generatedAt field to avoid merge conflicts - file only changes when content changes
  const jsonContent = {
    $schema: './entities.schema.json',
    _warning: 'AUTO-GENERATED by build-registry.mjs - DO NOT EDIT MANUALLY',
    _theme: projectName,
    entities: entitiesData
  }

  // Write the file
  const outputPath = join(fixturesDir, 'entities.json')
  await projectFiles(root).writeFile(outputPath, JSON.stringify(jsonContent, null, 2), 'utf8')
  log(`entities.json generated for project "${projectName}"`, 'success')
}

/**
 * Generate blocks.json test fixture for the project
 * This file is used by Cypress tests for block-related testing
 * @param {Array} blocks - All discovered blocks
 */
export async function generateTestBlocksJson(blocks, CONFIG = DEFAULT_CONFIG) {
  const projectName = CONFIG.projectName

  // Check if tests directory exists
  const { fixturesDir, root } = testFixturesPlace(CONFIG)
  if (!existsSync(fixturesDir)) {
    verbose(`Test fixtures directory not found for project "${projectName}", skipping blocks.json`)
    return
  }

  // Build blocks data - simplified for tests
  const blocksData = {
    available: blocks.map(block => ({
      slug: block.slug,
      name: block.name,
      description: block.description,
      category: block.category,
      icon: block.icon,
      scope: block.scope || ['pages', 'posts']
    })),
    categories: [...new Set(blocks.map(b => b.category))].sort(),
    byCategory: blocks.reduce((acc, block) => {
      const cat = block.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(block.slug)
      return acc
    }, {})
  }

  const jsonContent = {
    $schema: './blocks.schema.json',
    _warning: 'AUTO-GENERATED by build-registry.mjs - DO NOT EDIT MANUALLY',
    _theme: projectName,
    _totalBlocks: blocks.length,
    ...blocksData
  }

  const outputPath = join(fixturesDir, 'blocks.json')
  await projectFiles(root).writeFile(outputPath, JSON.stringify(jsonContent, null, 2), 'utf8')
  log(`blocks.json generated for project "${projectName}" (${blocks.length} blocks)`, 'success')
}
