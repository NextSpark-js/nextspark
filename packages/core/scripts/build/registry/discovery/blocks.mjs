/**
 * Block Discovery
 *
 * Discovers page builder blocks from themes
 *
 * @module core/scripts/build/registry/discovery/blocks
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { log, verbose } from '../../../utils/index.mjs'

/**
 * Discover all blocks in the active theme
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<Array>} Array of discovered blocks
 */
export async function discoverBlocks(config = DEFAULT_CONFIG) {
  log('Discovering blocks...', 'info')
  const blocks = []

  if (!config.activeTheme) {
    verbose('Warning: NEXT_PUBLIC_ACTIVE_THEME not set, skipping block discovery')
    return blocks
  }

  const themeName = config.activeTheme
  const blocksDir = join(config.themesDir, themeName, 'blocks')

  // Check if blocks directory exists
  try {
    await stat(blocksDir)
  } catch (error) {
    verbose(`No blocks directory found for theme "${themeName}"`)
    return blocks
  }

  try {
    const blockDirs = await readdir(blocksDir, { withFileTypes: true })

    for (const dir of blockDirs) {
      if (!dir.isDirectory()) continue

      const blockSlug = dir.name
      const blockPath = join(blocksDir, blockSlug)

      // Check for required files
      const configPath = join(blockPath, 'config.ts')
      const schemaPath = join(blockPath, 'schema.ts')
      const fieldsPath = join(blockPath, 'fields.ts')
      const componentPath = join(blockPath, 'component.tsx')
      const examplesPath = join(blockPath, 'examples.ts')

      const hasConfig = existsSync(configPath)
      const hasSchema = existsSync(schemaPath)
      const hasFields = existsSync(fieldsPath)
      const hasComponent = existsSync(componentPath)
      const hasExamples = existsSync(examplesPath)

      if (!hasConfig || !hasSchema || !hasFields || !hasComponent) {
        log(`WARNING: Block "${blockSlug}" missing required files (config/schema/fields/component)`, 'warning')
        continue
      }

      // Read config file to extract metadata
      try {
        const configContent = await readFile(configPath, 'utf-8')

        // Extract metadata using regex (simple parsing)
        const slugMatch = configContent.match(/slug:\s*['"]([^'"]+)['"]/)
        const nameMatch = configContent.match(/name:\s*['"]([^'"]+)['"]/)
        const descMatch = configContent.match(/description:\s*['"]([^'"]+)['"]/)
        const categoryMatch = configContent.match(/category:\s*['"]([^'"]+)['"]/)
        const iconMatch = configContent.match(/icon:\s*['"]([^'"]+)['"]/)
        const scopeMatch = configContent.match(/scope:\s*\[([^\]]+)\]/)
        const allowInPatternsMatch = configContent.match(/allowInPatterns:\s*(true|false)/)

        const extractedSlug = slugMatch ? slugMatch[1] : blockSlug

        if (extractedSlug !== blockSlug) {
          log(`WARNING: Block folder "${blockSlug}" has mismatched slug "${extractedSlug}" in config`, 'warning')
        }

        // Parse scope array if present
        let scope = undefined
        if (scopeMatch) {
          const scopeString = scopeMatch[1]
          scope = scopeString
            .split(',')
            .map(s => s.trim().replace(/['"]/g, ''))
            .filter(s => s.length > 0)
        }

        // Parse allowInPatterns (default: undefined, which means true)
        let allowInPatterns = undefined
        if (allowInPatternsMatch) {
          allowInPatterns = allowInPatternsMatch[1] === 'true'
        }

        blocks.push({
          slug: extractedSlug,
          name: nameMatch ? nameMatch[1] : blockSlug,
          description: descMatch ? descMatch[1] : '',
          category: categoryMatch ? categoryMatch[1] : 'other',
          icon: iconMatch ? iconMatch[1] : 'Box',
          scope,
          allowInPatterns,
          themeName,
          hasExamples,
          paths: {
            config: `@/contents/themes/${themeName}/blocks/${blockSlug}/config`,
            schema: `@/contents/themes/${themeName}/blocks/${blockSlug}/schema`,
            fields: `@/contents/themes/${themeName}/blocks/${blockSlug}/fields`,
            component: `@/contents/themes/${themeName}/blocks/${blockSlug}/component`,
            examples: `@/contents/themes/${themeName}/blocks/${blockSlug}/examples`,
            thumbnail: existsSync(join(blockPath, 'thumbnail.png'))
              ? `/theme/blocks/${blockSlug}/thumbnail.png`
              : null
          }
        })

        verbose(`Block discovered: ${extractedSlug} (${blocks[blocks.length - 1].name})`)
      } catch (error) {
        log(`ERROR: Failed to parse block "${blockSlug}": ${error.message}`, 'error')
      }
    }

    log(`Found ${blocks.length} blocks in theme "${themeName}"`, 'success')
  } catch (error) {
    log(`Error discovering blocks: ${error.message}`, 'error')
  }

  return blocks
}
