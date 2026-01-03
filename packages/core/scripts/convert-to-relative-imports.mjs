#!/usr/bin/env node

/**
 * Convert @/core/* imports to relative imports
 *
 * This script scans all TypeScript files in packages/core/src and converts
 * imports like `@/core/lib/utils` to relative paths like `../../lib/utils`.
 *
 * This is necessary for npm distribution - published packages cannot use
 * path aliases as consumers won't have them configured.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, relative, posix } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = join(__dirname, '..', 'src')

// Regex to match @/core/* imports
const IMPORT_REGEX = /from\s+['"]@\/core\/([^'"]+)['"]/g
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*['"]@\/core\/([^'"]+)['"]\s*\)/g
const DYNAMIC_IMPORT_TEMPLATE_REGEX = /import\s*\(\s*`@\/core\/([^`]+)`\s*\)/g

/**
 * Get all TypeScript files recursively
 */
function getAllTsFiles(dir) {
  const files = []
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath))
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Calculate relative path from file to target
 */
function getRelativePath(fromFile, importPath) {
  const fromDir = dirname(fromFile)
  const targetPath = join(SRC_DIR, importPath)

  // Get relative path using posix for consistent forward slashes
  let relativePath = relative(fromDir, targetPath)

  // Convert to forward slashes (for Windows compatibility)
  relativePath = relativePath.split('\\').join('/')

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath
  }

  return relativePath
}

/**
 * Convert imports in a single file
 */
function convertFile(filePath) {
  let content = readFileSync(filePath, 'utf-8')
  let modified = false
  const changes = []

  // Convert static imports: from '@/core/...'
  content = content.replace(IMPORT_REGEX, (match, importPath) => {
    const relativePath = getRelativePath(filePath, importPath)
    changes.push({ from: `@/core/${importPath}`, to: relativePath })
    modified = true
    return `from '${relativePath}'`
  })

  // Convert dynamic imports: import('@/core/...')
  content = content.replace(DYNAMIC_IMPORT_REGEX, (match, importPath) => {
    const relativePath = getRelativePath(filePath, importPath)
    changes.push({ from: `@/core/${importPath}`, to: relativePath })
    modified = true
    return `import('${relativePath}')`
  })

  // Convert template literal imports: import(`@/core/...`)
  // Note: These need special handling as they may contain variables
  content = content.replace(DYNAMIC_IMPORT_TEMPLATE_REGEX, (match, templateContent) => {
    // For template literals, we need to be careful
    // If it contains ${...}, we need to preserve the template literal
    if (templateContent.includes('${')) {
      // Replace @/core/ prefix with relative path
      const fromDir = dirname(filePath)
      const toSrc = relative(fromDir, SRC_DIR).split('\\').join('/')
      const prefix = toSrc.startsWith('.') ? toSrc : './' + toSrc
      const newTemplate = templateContent.replace(/^/, prefix + '/')
      changes.push({ from: `@/core/${templateContent}`, to: `${prefix}/${templateContent}` })
      modified = true
      return `import(\`${newTemplate}\`)`
    } else {
      const relativePath = getRelativePath(filePath, templateContent)
      changes.push({ from: `@/core/${templateContent}`, to: relativePath })
      modified = true
      return `import('${relativePath}')`
    }
  })

  if (modified) {
    writeFileSync(filePath, content)
    return changes
  }

  return null
}

/**
 * Main function
 */
function main() {
  console.log('🔄 Converting @/core/* imports to relative paths...\n')
  console.log(`📁 Source directory: ${SRC_DIR}\n`)

  const files = getAllTsFiles(SRC_DIR)
  console.log(`📋 Found ${files.length} TypeScript files\n`)

  let totalChanges = 0
  let filesModified = 0

  for (const file of files) {
    const changes = convertFile(file)
    if (changes) {
      filesModified++
      totalChanges += changes.length
      const relativePath = relative(SRC_DIR, file)
      console.log(`✅ ${relativePath} (${changes.length} imports)`)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`✅ Done! Modified ${filesModified} files with ${totalChanges} import changes.`)
  console.log('='.repeat(50) + '\n')

  // Verify no @/core imports remain
  console.log('🔍 Verifying no @/core imports remain...')
  let remaining = 0
  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const matches = content.match(/@\/core\//g)
    if (matches) {
      remaining += matches.length
      console.log(`⚠️  ${relative(SRC_DIR, file)}: ${matches.length} remaining`)
    }
  }

  if (remaining === 0) {
    console.log('✅ All @/core imports have been converted!\n')
  } else {
    console.log(`\n⚠️  Warning: ${remaining} @/core references still remain\n`)
  }
}

main()
