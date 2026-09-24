/**
 * Route Cleanup
 *
 * Cleans up old/orphaned route and template files
 *
 * @module core/scripts/build/registry/post-build/route-cleanup
 */

import { existsSync } from 'fs'
import { readdir, readFile } from 'fs/promises'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

import { log, verbose } from '../../../utils/index.mjs'
import { isUnsafeWrite, projectFiles } from '../../safe-fs.mjs'
import { projectGeneratedAppDir, projectGeneratedTemplatesDir } from '../project-mode.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Clean up old generated route files
 * @param {object} CONFIG - Configuration object from getConfig()
 */
export async function cleanupOldRouteFiles(CONFIG) {
  const rootDir = CONFIG?.projectRoot || process.cwd()
  const appApiDir = join(CONFIG?.generatedAppDir || projectGeneratedAppDir(rootDir), 'api', 'v1', 'plugin')

  try {
    // Only clean up if directory exists
    if (existsSync(appApiDir)) {
      const entries = await readdir(appApiDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== '[...path]') {
          const pluginDir = join(appApiDir, entry.name)
          const routeFile = join(pluginDir, 'route.ts')

          // Check if this is an auto-generated file
          if (existsSync(routeFile)) {
            const content = await readFile(routeFile, 'utf8')
            if (content.includes('Auto-generated Plugin Route Proxy')) {
              // Remove the entire plugin route directory
              await projectFiles(rootDir).rm(pluginDir, { recursive: true, force: true })
              verbose(`Cleaned up old route: ${pluginDir}`)
            }
          }
        }
      }
    }
  } catch (error) {
    // An UNSAFE_WRITE refusal propagates and stops the build; every other error here is a non-fatal cleanup failure
    if (isUnsafeWrite(error)) throw error
    verbose(`Error during route cleanup: ${error.message}`)
  }
}

/**
 * Clean up orphaned template files that no longer have corresponding templates
 * Removes files from src/app/(templates)/ when their source templates are deleted
 * @param {object[]} activeTemplates - List of active templates from discovery
 * @param {object} CONFIG - Configuration object from getConfig()
 */
export async function cleanupOrphanedTemplates(activeTemplates, CONFIG) {
  const rootDir = CONFIG?.projectRoot || process.cwd()
  const templatesDir = CONFIG?.generatedTemplatesDir || projectGeneratedTemplatesDir(rootDir)
  if (!existsSync(templatesDir)) {
    return
  }

  log('Cleaning up orphaned template files...', 'info')

  // Create a Set of all active template paths for quick lookup
  const activeTemplatePaths = new Set(
    activeTemplates.map(template =>
      join(templatesDir, template.appPath.replace('app/', ''))
    )
  )

  let cleaned = 0
  const dirsToCleanup = []

  async function scanAndCleanDirectory(dir, relativePath = '') {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        const currentRelativePath = relativePath ? join(relativePath, entry.name) : entry.name

        if (entry.isDirectory()) {
          await scanAndCleanDirectory(fullPath, currentRelativePath)
          // Check if directory is empty after scanning
          const remainingEntries = await readdir(fullPath)
          if (remainingEntries.length === 0) {
            dirsToCleanup.push(fullPath)
          }
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
          // NEVER delete layout files - they are auto-generated and necessary for Next.js hierarchy
          // Even if the theme doesn't override them, they must exist to provide layout to custom pages
          if (entry.name === 'layout.tsx' || entry.name === 'layout.ts') {
            continue
          }

          // Check if this generated file has a corresponding active template
          if (!activeTemplatePaths.has(fullPath)) {
            await projectFiles(rootDir).unlink(fullPath)
            log(`Cleaned orphaned file: ${fullPath.replace(rootDir, '')}`, 'info')
            cleaned++
          }
        }
      }
    } catch (error) {
      if (isUnsafeWrite(error)) throw error
      verbose(`Error scanning directory ${dir}: ${error.message}`)
    }
  }

  await scanAndCleanDirectory(templatesDir)

  // Clean up empty directories (in reverse order to handle nested structures)
  if (dirsToCleanup.length > 0) {
    for (const dir of dirsToCleanup.reverse()) {
      try {
        await projectFiles(rootDir).rmdir(dir)
        log(`Removed empty directory: ${dir.replace(rootDir, '')}`, 'info')
      } catch (error) {
        if (isUnsafeWrite(error)) throw error
        // Directory might not be empty anymore, ignore
      }
    }
  }

  if (cleaned > 0) {
    log(`Cleaned up ${cleaned} orphaned template files`, 'success')
  } else {
    verbose('No orphaned template files found')
  }
}

/**
 * Map template file path to generated app template path
 * @param {string} templateFilePath - Full path to the template file
 * @param {object} CONFIG - Configuration object from getConfig()
 */
export function mapTemplateToAppPath(templateFilePath, CONFIG) {
  const rootDir = CONFIG?.projectRoot || process.cwd()
  const templatesDir = join(CONFIG?.projectSourceDir || rootDir, 'templates')
  const relativeTemplatePath = relative(templatesDir, templateFilePath)
  if (!relativeTemplatePath || relativeTemplatePath.startsWith('..')) return null
  return join(CONFIG?.generatedTemplatesDir || projectGeneratedTemplatesDir(rootDir), relativeTemplatePath)
}

/**
 * Clean up generated template files when original templates are deleted
 * @param {string} templateFilePath - Full path to the template file
 * @param {object} CONFIG - Configuration object from getConfig()
 */
export async function cleanupDeletedTemplate(templateFilePath, CONFIG) {
  const rootDir = CONFIG?.projectRoot || process.cwd()
  const appTemplatePath = mapTemplateToAppPath(templateFilePath, CONFIG)
  if (!appTemplatePath || !existsSync(appTemplatePath)) {
    return
  }

  try {
    const files = projectFiles(rootDir)

    // Remove the generated template file
    await files.unlink(appTemplatePath)
    log(`Removed generated template: ${appTemplatePath.replace(rootDir, '')}`, 'info')

    // Try to remove empty parent directories (but don't fail if they're not empty)
    let parentDir = dirname(appTemplatePath)
    const templatesDir = CONFIG?.generatedTemplatesDir || projectGeneratedTemplatesDir(rootDir)

    while (parentDir !== templatesDir && parentDir !== rootDir) {
      try {
        const entries = await readdir(parentDir)
        if (entries.length === 0) {
          await files.rmdir(parentDir)
          log(`Removed empty directory: ${parentDir.replace(rootDir, '')}`, 'info')
          parentDir = dirname(parentDir)
        } else {
          break // Directory is not empty, stop cleanup
        }
      } catch (error) {
        if (isUnsafeWrite(error)) throw error
        break // Error reading directory or removing, stop cleanup
      }
    }
  } catch (error) {
    if (isUnsafeWrite(error)) throw error
    verbose(`Failed to cleanup template file ${appTemplatePath}: ${error.message}`)
  }
}
