/**
 * API Presets Discovery
 *
 * Discovers API preset and documentation files from multiple sources:
 *
 * Priority (highest to lowest):
 * 1. Theme custom routes: {theme}/app/api/**\/docs.md and presets.ts
 * 2. Entity folders: {theme}/entities/*\/api/docs.md and presets.ts
 * 3. Core routes: packages/core/templates/app/api/**\/docs.md and presets.ts
 *
 * @module core/scripts/build/registry/discovery/api-presets
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join, relative, basename, dirname } from 'path'
import { existsSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { log, verbose } from '../../../utils/index.mjs'

/**
 * Normalize path separators to forward slashes (for cross-platform compatibility)
 * @param {string} path - Path to normalize
 * @returns {string} Path with forward slashes
 */
function normalizePath(path) {
  return path.replace(/\\/g, '/')
}

/**
 * Find the matching closing brace for an opening brace
 * Uses brace counting to handle nested objects correctly
 *
 * @param {string} content - Content to search in
 * @param {number} startIndex - Index of the opening brace
 * @returns {number} Index of matching closing brace, or -1 if not found
 */
function findMatchingBrace(content, startIndex) {
  let depth = 0
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Extract a nested object from content using brace counting
 *
 * @param {string} content - Content to extract from
 * @param {string} key - Property name to find
 * @returns {string|null} The object content including braces, or null
 */
function extractNestedObject(content, key) {
  const keyPattern = new RegExp(`${key}:\\s*\\{`)
  const match = content.match(keyPattern)
  if (!match) return null

  const startIndex = content.indexOf(match[0]) + match[0].length - 1
  const endIndex = findMatchingBrace(content, startIndex)
  if (endIndex === -1) return null

  return content.slice(startIndex, endIndex + 1)
}

/**
 * Parse preset configuration from TypeScript file content
 * Extracts the configuration from defineApiEndpoint() or direct export
 *
 * @param {string} content - File content
 * @returns {Object|null} Parsed preset config
 */
function parsePresetFile(content) {
  try {
    // Extract endpoint (optional - can be derived from entity/route)
    const endpointMatch = content.match(/endpoint:\s*['"`]([^'"`]+)['"`]/)
    const endpoint = endpointMatch ? endpointMatch[1] : null

    // Extract summary
    const summaryMatch = content.match(/summary:\s*['"`]([^'"`]+)['"`]/)
    const summary = summaryMatch ? summaryMatch[1] : ''

    // Find presets array start
    const presetsArrayMatch = content.match(/presets:\s*\[/)
    if (!presetsArrayMatch) {
      return { endpoint, summary, presets: [] }
    }

    const presetsArrayStart = content.indexOf(presetsArrayMatch[0]) + presetsArrayMatch[0].length
    const presets = []

    // Find each preset object using brace counting
    let searchStart = presetsArrayStart
    while (true) {
      // Find next opening brace that starts a preset (look for { followed by id:)
      const nextPresetMatch = content.slice(searchStart).match(/\{\s*id:\s*['"`]/)
      if (!nextPresetMatch) break

      const presetStart = searchStart + content.slice(searchStart).indexOf(nextPresetMatch[0])
      const presetEnd = findMatchingBrace(content, presetStart)

      if (presetEnd === -1) break

      const presetBlock = content.slice(presetStart, presetEnd + 1)
      const preset = {}

      // Extract id
      const idMatch = presetBlock.match(/id:\s*['"`]([^'"`]+)['"`]/)
      if (idMatch) preset.id = idMatch[1]

      // Extract title
      const titleMatch = presetBlock.match(/title:\s*['"`]([^'"`]+)['"`]/)
      if (titleMatch) preset.title = titleMatch[1]

      // Extract description
      const descMatch = presetBlock.match(/description:\s*['"`]([^'"`]+)['"`]/)
      if (descMatch) preset.description = descMatch[1]

      // Extract method
      const methodMatch = presetBlock.match(/method:\s*['"`]([^'"`]+)['"`]/)
      if (methodMatch) preset.method = methodMatch[1]

      // Extract params object (simple, no nesting expected)
      const paramsObj = extractNestedObject(presetBlock, 'params')
      if (paramsObj) {
        preset.params = parseSimpleObject(paramsObj.slice(1, -1))
      }

      // Extract pathParams object
      const pathParamsObj = extractNestedObject(presetBlock, 'pathParams')
      if (pathParamsObj) {
        preset.pathParams = parseSimpleObject(pathParamsObj.slice(1, -1))
      }

      // Extract headers object
      const headersObj = extractNestedObject(presetBlock, 'headers')
      if (headersObj) {
        preset.headers = parseSimpleObject(headersObj.slice(1, -1))
      }

      // Extract payload object (can be nested)
      const payloadObj = extractNestedObject(presetBlock, 'payload')
      if (payloadObj) {
        try {
          // Try to parse as JSON after cleaning up
          const cleanedPayload = payloadObj
            .replace(/(['"`])(\w+)(['"`]):/g, '"$2":') // Convert quoted keys to double quotes
            .replace(/(\w+):/g, '"$1":') // Convert unquoted keys to double quotes
            .replace(/:\s*['`]([^'`]*)['`]/g, ': "$1"') // Convert string values to double quotes
            .replace(/,\s*}/g, '}') // Remove trailing commas
            .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
            .replace(/""+/g, '"') // Fix double quotes
          preset.payload = JSON.parse(cleanedPayload)
        } catch {
          // If JSON parse fails, store as empty object
          preset.payload = {}
        }
      }

      // Extract sessionConfig object
      const sessionObj = extractNestedObject(presetBlock, 'sessionConfig')
      if (sessionObj) {
        const sessionContent = sessionObj.slice(1, -1)
        preset.sessionConfig = {}

        const crossTeamMatch = sessionContent.match(/crossTeam:\s*(true|false)/)
        if (crossTeamMatch) {
          preset.sessionConfig.crossTeam = crossTeamMatch[1] === 'true'
        }

        const teamIdMatch = sessionContent.match(/teamId:\s*['"`]([^'"`]+)['"`]/)
        if (teamIdMatch) {
          preset.sessionConfig.teamId = teamIdMatch[1]
        }

        const authTypeMatch = sessionContent.match(/authType:\s*['"`]([^'"`]+)['"`]/)
        if (authTypeMatch) {
          preset.sessionConfig.authType = authTypeMatch[1]
        }
      }

      // Extract tags array
      const tagsMatch = presetBlock.match(/tags:\s*\[([^\]]+)\]/)
      if (tagsMatch) {
        preset.tags = tagsMatch[1]
          .split(',')
          .map(t => t.trim().replace(/['"`]/g, ''))
          .filter(t => t.length > 0)
      }

      if (preset.id && preset.title && preset.method) {
        presets.push(preset)
      }

      // Move past this preset for next iteration
      searchStart = presetEnd + 1
    }

    return { endpoint, summary, presets }
  } catch (error) {
    verbose(`Error parsing preset file: ${error.message}`)
    return null
  }
}

/**
 * Parse a simple object from string (key: value pairs)
 * @param {string} content - Object content without braces
 * @returns {Object} Parsed object
 */
function parseSimpleObject(content) {
  const result = {}
  const pairs = content.match(/(\w+):\s*(['"`]?[^,\n]+['"`]?)/g)

  if (pairs) {
    for (const pair of pairs) {
      const match = pair.match(/(\w+):\s*(['"`]?)([^'"`\n,]+)['"`]?/)
      if (match) {
        const key = match[1]
        let value = match[3].trim()

        // Try to parse as number
        if (!isNaN(value) && value !== '') {
          value = Number(value)
        } else if (value === 'true') {
          value = true
        } else if (value === 'false') {
          value = false
        }

        result[key] = value
      }
    }
  }

  return result
}

/**
 * Extract title from markdown content
 * @param {string} content - Markdown content
 * @returns {string} Extracted title
 */
function extractMarkdownTitle(content) {
  // Try frontmatter first
  const frontmatterMatch = content.match(/^---\n[\s\S]*?title:\s*['"]?([^'"\n]+)['"]?\n[\s\S]*?---/)
  if (frontmatterMatch) {
    return frontmatterMatch[1].trim()
  }

  // Try first heading
  const headingMatch = content.match(/^#\s+(.+)$/m)
  if (headingMatch) {
    return headingMatch[1].trim()
  }

  return 'Untitled'
}

/**
 * Derive endpoint from entity name
 * @param {string} entityName - Entity name (e.g., 'customers')
 * @returns {string} API endpoint
 */
function deriveEndpointFromEntity(entityName) {
  return `/api/v1/${entityName}`
}

/**
 * Derive endpoint from route folder path
 * @param {string} routePath - Path like 'app/api/v1/teams/invites'
 * @returns {string} API endpoint
 */
function deriveEndpointFromRoute(routePath) {
  // Extract the API path from full path
  const match = routePath.match(/app(\/api\/.+)$/)
  if (match) {
    return match[1]
  }
  return routePath
}

/**
 * Get the storage path for registry (handles monorepo vs npm mode)
 * Always normalizes to forward slashes for cross-platform compatibility
 * @param {string} absolutePath - Absolute file path
 * @param {object} config - Configuration object
 * @returns {string} Path to store in registry (with forward slashes)
 */
function getStoragePath(absolutePath, config) {
  let result
  if (config.isMonorepoMode) {
    // In monorepo, use path relative to monorepo root
    result = relative(config.monorepoRoot, absolutePath)
  } else {
    // In npm mode, use path relative to project root with contents/ prefix
    result = relative(config.projectRoot, absolutePath)
  }
  // Always normalize to forward slashes (Windows uses backslashes)
  return normalizePath(result)
}

/**
 * Recursively find files matching a pattern in a directory
 * @param {string} dir - Directory to search
 * @param {string} filename - Filename to match
 * @returns {Promise<string[]>} Array of absolute paths
 */
async function findFilesRecursive(dir, filename) {
  const results = []

  if (!existsSync(dir)) {
    return results
  }

  async function walk(currentDir) {
    try {
      const entries = await readdir(currentDir)

      for (const entry of entries) {
        const fullPath = join(currentDir, entry)
        const entryStat = await stat(fullPath)

        if (entryStat.isDirectory()) {
          // Skip node_modules and hidden directories
          if (!entry.startsWith('.') && entry !== 'node_modules') {
            await walk(fullPath)
          }
        } else if (entry === filename) {
          results.push(fullPath)
        }
      }
    } catch {
      // Silently skip directories we can't read
    }
  }

  await walk(dir)
  return results
}

/**
 * Discover docs and presets from entity folders
 * @param {object} config - Configuration object
 * @param {object} results - Results accumulator
 * @param {Set} processedEndpoints - Set of already processed endpoints
 */
async function discoverEntityFolders(config, results, processedEndpoints) {
  const themeName = config.activeTheme
  const entitiesDir = join(config.themesDir, themeName, 'entities')

  if (!existsSync(entitiesDir)) {
    verbose(`No entities directory found for theme "${themeName}"`)
    return
  }

  try {
    const entities = await readdir(entitiesDir)

    for (const entityName of entities) {
      const entityApiDir = join(entitiesDir, entityName, 'api')

      if (!existsSync(entityApiDir)) {
        continue
      }

      const endpoint = deriveEndpointFromEntity(entityName)

      // Skip if this endpoint was already processed (priority rule)
      if (processedEndpoints.has(endpoint)) {
        verbose(`  Skipping entity ${entityName}: endpoint already processed`)
        continue
      }

      // Check for docs.md
      const docsPath = join(entityApiDir, 'docs.md')
      if (existsSync(docsPath)) {
        try {
          const content = await readFile(docsPath, 'utf-8')
          const title = extractMarkdownTitle(content)

          results.docs.push({
            slug: entityName,
            title,
            endpoint,
            filePath: getStoragePath(docsPath, config),
            source: 'entity',
            themeName
          })
          verbose(`  Entity doc discovered: ${entityName} -> ${endpoint}`)
        } catch (error) {
          log(`  ERROR: Failed to read entity doc "${entityName}": ${error.message}`, 'error')
        }
      }

      // Check for presets.ts
      const presetsPath = join(entityApiDir, 'presets.ts')
      if (existsSync(presetsPath)) {
        try {
          const content = await readFile(presetsPath, 'utf-8')
          const presetConfig = parsePresetFile(content)

          // Use derived endpoint if not specified in file
          const finalEndpoint = presetConfig?.endpoint || endpoint

          results.presets.push({
            slug: entityName,
            endpoint: finalEndpoint,
            summary: presetConfig?.summary || '',
            presets: presetConfig?.presets || [],
            sourcePath: getStoragePath(presetsPath, config),
            source: 'entity',
            themeName
          })
          verbose(`  Entity presets discovered: ${entityName} (${presetConfig?.presets?.length || 0} presets)`)

          processedEndpoints.add(finalEndpoint)
        } catch (error) {
          log(`  ERROR: Failed to parse entity presets "${entityName}": ${error.message}`, 'error')
        }
      } else if (existsSync(docsPath)) {
        // If only docs exist, still mark endpoint as processed
        processedEndpoints.add(endpoint)
      }
    }
  } catch (error) {
    log(`Error discovering entity folders: ${error.message}`, 'error')
  }
}

/**
 * Discover docs and presets from theme custom routes
 * @param {object} config - Configuration object
 * @param {object} results - Results accumulator
 * @param {Set} processedEndpoints - Set of already processed endpoints
 */
async function discoverThemeRoutes(config, results, processedEndpoints) {
  const themeName = config.activeTheme
  const themeApiDir = join(config.themesDir, themeName, 'app', 'api')

  if (!existsSync(themeApiDir)) {
    verbose(`No theme API routes found for "${themeName}"`)
    return
  }

  // Find all docs.md files in theme routes
  const docFiles = await findFilesRecursive(themeApiDir, 'docs.md')
  const presetFiles = await findFilesRecursive(themeApiDir, 'presets.ts')

  // Process docs
  for (const docsPath of docFiles) {
    try {
      const routeDir = dirname(docsPath)
      const relativeDir = relative(join(config.themesDir, themeName, 'app'), routeDir)
      const endpoint = '/' + normalizePath(relativeDir)

      const content = await readFile(docsPath, 'utf-8')
      const title = extractMarkdownTitle(content)

      // Extract slug from endpoint
      const slug = basename(routeDir)

      results.docs.push({
        slug,
        title,
        endpoint,
        filePath: getStoragePath(docsPath, config),
        source: 'route',
        themeName
      })
      verbose(`  Theme route doc discovered: ${endpoint}`)

      processedEndpoints.add(endpoint)
    } catch (error) {
      log(`  ERROR: Failed to read theme route doc: ${error.message}`, 'error')
    }
  }

  // Process presets
  for (const presetsPath of presetFiles) {
    try {
      const routeDir = dirname(presetsPath)
      const relativeDir = relative(join(config.themesDir, themeName, 'app'), routeDir)
      const endpoint = '/' + normalizePath(relativeDir)

      const content = await readFile(presetsPath, 'utf-8')
      const presetConfig = parsePresetFile(content)

      const slug = basename(routeDir)
      const finalEndpoint = presetConfig?.endpoint || endpoint

      results.presets.push({
        slug,
        endpoint: finalEndpoint,
        summary: presetConfig?.summary || '',
        presets: presetConfig?.presets || [],
        sourcePath: getStoragePath(presetsPath, config),
        source: 'route',
        themeName
      })
      verbose(`  Theme route presets discovered: ${finalEndpoint} (${presetConfig?.presets?.length || 0} presets)`)

      processedEndpoints.add(finalEndpoint)
    } catch (error) {
      log(`  ERROR: Failed to parse theme route presets: ${error.message}`, 'error')
    }
  }
}

/**
 * Discover docs and presets from core routes
 * @param {object} config - Configuration object
 * @param {object} results - Results accumulator
 * @param {Set} processedEndpoints - Set of already processed endpoints
 */
async function discoverCoreRoutes(config, results, processedEndpoints) {
  const coreApiDir = join(config.coreDir, 'templates', 'app', 'api')

  if (!existsSync(coreApiDir)) {
    verbose('No core API routes found')
    return
  }

  // Find all docs.md files in core routes
  const docFiles = await findFilesRecursive(coreApiDir, 'docs.md')
  const presetFiles = await findFilesRecursive(coreApiDir, 'presets.ts')

  // Process docs
  for (const docsPath of docFiles) {
    try {
      const routeDir = dirname(docsPath)
      const relativeDir = relative(join(config.coreDir, 'templates', 'app'), routeDir)
      const endpoint = '/' + normalizePath(relativeDir)

      // Skip if already processed by theme or entity
      if (processedEndpoints.has(endpoint)) {
        verbose(`  Skipping core route ${endpoint}: already processed`)
        continue
      }

      const content = await readFile(docsPath, 'utf-8')
      const title = extractMarkdownTitle(content)

      const slug = basename(routeDir)

      results.docs.push({
        slug,
        title,
        endpoint,
        filePath: getStoragePath(docsPath, config),
        source: 'core',
        themeName: null
      })
      verbose(`  Core route doc discovered: ${endpoint}`)
    } catch (error) {
      log(`  ERROR: Failed to read core route doc: ${error.message}`, 'error')
    }
  }

  // Process presets
  for (const presetsPath of presetFiles) {
    try {
      const routeDir = dirname(presetsPath)
      const relativeDir = relative(join(config.coreDir, 'templates', 'app'), routeDir)
      const endpoint = '/' + normalizePath(relativeDir)

      // Skip if already processed by theme or entity
      if (processedEndpoints.has(endpoint)) {
        verbose(`  Skipping core route presets ${endpoint}: already processed`)
        continue
      }

      const content = await readFile(presetsPath, 'utf-8')
      const presetConfig = parsePresetFile(content)

      const slug = basename(routeDir)
      const finalEndpoint = presetConfig?.endpoint || endpoint

      results.presets.push({
        slug,
        endpoint: finalEndpoint,
        summary: presetConfig?.summary || '',
        presets: presetConfig?.presets || [],
        sourcePath: getStoragePath(presetsPath, config),
        source: 'core',
        themeName: null
      })
      verbose(`  Core route presets discovered: ${finalEndpoint} (${presetConfig?.presets?.length || 0} presets)`)

      processedEndpoints.add(finalEndpoint)
    } catch (error) {
      log(`  ERROR: Failed to parse core route presets: ${error.message}`, 'error')
    }
  }
}

/**
 * Discover all API presets and docs from multiple sources
 *
 * Priority (highest to lowest):
 * 1. Theme custom routes
 * 2. Entity folders
 * 3. Core routes
 *
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<{presets: Array, docs: Array}>}
 */
export async function discoverApiPresets(config = DEFAULT_CONFIG) {
  log('Discovering API presets...', 'info')

  const results = { presets: [], docs: [] }
  const processedEndpoints = new Set()

  if (!config.activeTheme) {
    verbose('Warning: NEXT_PUBLIC_ACTIVE_THEME not set, skipping theme-based discovery')
    // Still discover core routes
    await discoverCoreRoutes(config, results, processedEndpoints)

    if (results.presets.length > 0 || results.docs.length > 0) {
      log(`Found ${results.presets.length} preset files and ${results.docs.length} doc files (core only)`, 'success')
    }
    return results
  }

  // 1. Theme custom routes (highest priority)
  verbose('Checking theme custom routes...')
  await discoverThemeRoutes(config, results, processedEndpoints)

  // 2. Entity folders (second priority)
  verbose('Checking entity folders...')
  await discoverEntityFolders(config, results, processedEndpoints)

  // 3. Core routes (lowest priority)
  verbose('Checking core routes...')
  await discoverCoreRoutes(config, results, processedEndpoints)

  if (results.presets.length > 0 || results.docs.length > 0) {
    log(`Found ${results.presets.length} preset files and ${results.docs.length} doc files`, 'success')
  } else {
    verbose('No preset or doc files found')
  }

  return results
}
