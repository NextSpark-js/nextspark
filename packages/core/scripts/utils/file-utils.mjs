/**
 * File utilities for build scripts
 *
 * @module core/scripts/utils/file-utils
 */

import { readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { verbose } from './logging.mjs'

/**
 * Extract export name from TypeScript config file using regex patterns
 *
 * @param {string} filePath - Path to the file to parse
 * @param {RegExp[]} patterns - Array of regex patterns to try (first match wins)
 * @returns {Promise<string | null>} The extracted export name or null
 */
export async function extractExportName(filePath, patterns) {
  try {
    const content = await readFile(filePath, 'utf8')

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Extract HTTP methods from a Next.js route.ts file
 *
 * @param {string} filePath - Path to the route.ts file
 * @returns {Promise<string[]>} Array of HTTP methods (defaults to ['GET'])
 */
export async function extractHttpMethods(filePath) {
  try {
    const content = await readFile(filePath, 'utf8')
    const methods = []
    const httpMethodRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/g
    let match

    while ((match = httpMethodRegex.exec(content)) !== null) {
      methods.push(match[1])
    }

    return methods.length > 0 ? methods : ['GET']
  } catch {
    return ['GET']
  }
}

/**
 * Extract Next.js metadata export from template file
 * Parses metadata object structure and returns it as JSON
 *
 * @param {string} filePath - Path to the template file
 * @returns {Promise<object | null>} Parsed metadata object or null
 */
export async function extractTemplateMetadata(filePath) {
  try {
    const content = await readFile(filePath, 'utf8')

    // Look for export const metadata pattern with optional TypeScript type annotation
    const metadataMatch = content.match(/export\s+const\s+metadata\s*(?::\s*\w+\s*)?=\s*({[\s\S]*?})\s*(?=\n\n|\nexport|\nfunction|\n\/\*|\n\/\/|$)/m)

    if (!metadataMatch) {
      return null
    }

    const metadataStr = metadataMatch[1]

    // Try to safely evaluate the metadata object
    // This is a simplified parser - for production, you'd want a proper AST parser
    try {
      // Replace template literals and other complex expressions with placeholders
      const simplifiedMetadata = metadataStr
        .replace(/`[^`]*`/g, '"placeholder"') // Replace template literals
        .replace(/\$\{[^}]*\}/g, '"placeholder"') // Replace template expressions
        .replace(/'/g, '"') // Replace single quotes with double quotes
        .replace(/(\w+):/g, '"$1":') // Add quotes around object keys
        .replace(/,(\s*})/g, '$1') // Remove trailing commas

      // Parse the simplified JSON
      const parsed = JSON.parse(simplifiedMetadata)
      return parsed
    } catch (parseError) {
      verbose(`Failed to parse metadata in ${filePath}: ${parseError.message}`)
      return null
    }
  } catch (error) {
    verbose(`Error reading file ${filePath}: ${error.message}`)
    return null
  }
}

/**
 * Scan a directory and return its entries filtered by type
 *
 * @param {string} basePath - Directory to scan
 * @param {object} options - Options
 * @param {boolean} options.directoriesOnly - Only return directories
 * @param {boolean} options.filesOnly - Only return files
 * @param {function} options.filter - Custom filter function
 * @returns {Promise<import('fs').Dirent[]>} Array of directory entries
 */
export async function scanDirectory(basePath, options = {}) {
  const { directoriesOnly = false, filesOnly = false, filter } = options

  if (!existsSync(basePath)) {
    return []
  }

  try {
    const entries = await readdir(basePath, { withFileTypes: true })

    let result = entries

    if (directoriesOnly) {
      result = result.filter(entry => entry.isDirectory())
    } else if (filesOnly) {
      result = result.filter(entry => entry.isFile())
    }

    if (filter) {
      result = result.filter(filter)
    }

    return result
  } catch {
    return []
  }
}

/**
 * Check if a path exists (safe wrapper around existsSync)
 *
 * @param {string} path - Path to check
 * @returns {boolean}
 */
export function pathExists(path) {
  return existsSync(path)
}

/**
 * Read file content safely, returning null on error
 *
 * @param {string} filePath - Path to the file
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {Promise<string | null>}
 */
export async function readFileSafe(filePath, encoding = 'utf8') {
  try {
    return await readFile(filePath, encoding)
  } catch {
    return null
  }
}
