#!/usr/bin/env node

/**
 * Script to update all registry imports to use @nextspark/registries/* alias
 *
 * This changes:
 *   from '../registries/entity-registry'
 *   from '../../lib/registries/entity-registry'
 *   from '@/core/lib/registries/entity-registry'
 *
 * To:
 *   from '@nextspark/registries/entity-registry'
 */

import { readFile, writeFile } from 'fs/promises'
import { glob } from 'glob'
import { resolve } from 'path'

// Registry files to update
const REGISTRIES = [
  'auth-registry',
  'billing-registry',
  'block-registry',
  'entity-registry',
  'entity-registry.client',
  'entity-types',
  'feature-registry',
  'docs-registry',
  'middleware-registry',
  'namespace-registry',
  'permissions-registry',
  'plugin-registry',
  'route-handlers',
  'scheduled-actions-registry',
  'scope-registry',
  'template-registry',
  'testing-registry',
  'theme-registry',
  'translation-registry',
  'unified-registry'
]

async function updateFile(filePath) {
  let content = await readFile(filePath, 'utf-8')
  let modified = false

  for (const registry of REGISTRIES) {
    // Escape dots in registry name for regex
    const escapedRegistry = registry.replace(/\./g, '\\.')

    // Pattern 1: Relative imports like '../registries/entity-registry' or '../../lib/registries/entity-registry'
    const relativePattern1 = new RegExp(
      `from ['"](\\.\\./)+registries/${escapedRegistry}['"]`,
      'g'
    )
    const relativePattern2 = new RegExp(
      `from ['"](\\.\\./)+lib/registries/${escapedRegistry}['"]`,
      'g'
    )

    if (relativePattern1.test(content)) {
      content = content.replace(
        relativePattern1,
        `from '@nextspark/registries/${registry}'`
      )
      modified = true
    }

    if (relativePattern2.test(content)) {
      content = content.replace(
        relativePattern2,
        `from '@nextspark/registries/${registry}'`
      )
      modified = true
    }

    // Pattern 3: @/core/lib/registries/entity-registry
    const corePattern = new RegExp(
      `from ['"]@/core/lib/registries/${escapedRegistry}['"]`,
      'g'
    )
    if (corePattern.test(content)) {
      content = content.replace(
        corePattern,
        `from '@nextspark/registries/${registry}'`
      )
      modified = true
    }
  }

  if (modified) {
    await writeFile(filePath, content, 'utf-8')
    console.log(`✅ Updated: ${filePath}`)
    return true
  }

  return false
}

async function main() {
  console.log('🔍 Searching for files with registry imports...')

  // Find all TypeScript files in src directory
  const files = await glob('src/**/*.{ts,tsx}', {
    ignore: ['**/*.test.ts', '**/*.test.tsx', '**/node_modules/**']
  })

  console.log(`📝 Found ${files.length} files to check`)

  let updatedCount = 0
  for (const file of files) {
    const filePath = resolve(process.cwd(), file)
    const wasUpdated = await updateFile(filePath)
    if (wasUpdated) {
      updatedCount++
    }
  }

  console.log(`\n✅ Updated ${updatedCount} files`)
  console.log(`📊 Checked ${files.length} files total`)
}

main().catch(console.error)
