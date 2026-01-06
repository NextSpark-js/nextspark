/**
 * Configuration Health Check
 *
 * Verifies that configuration files exist and have valid syntax.
 */

import fs from 'fs-extra'
import path from 'path'
import type { HealthCheckResult } from '../index.js'

/**
 * Required configuration files for a NextSpark project
 */
const REQUIRED_CONFIG_FILES = [
  'next.config.ts',
  'tailwind.config.ts',
  'tsconfig.json',
]

/**
 * Optional configuration files that should be valid if they exist
 */
const OPTIONAL_CONFIG_FILES = [
  'next.config.js',
  'next.config.mjs',
  'tailwind.config.js',
  'tailwind.config.mjs',
]

/**
 * Check if configuration files exist and are valid
 */
export async function checkConfigs(): Promise<HealthCheckResult> {
  const cwd = process.cwd()
  const missingFiles: string[] = []
  const invalidFiles: string[] = []

  // Check required config files
  for (const file of REQUIRED_CONFIG_FILES) {
    const filePath = path.join(cwd, file)

    // Check for alternative extensions
    if (file.endsWith('.ts')) {
      const jsPath = path.join(cwd, file.replace('.ts', '.js'))
      const mjsPath = path.join(cwd, file.replace('.ts', '.mjs'))

      const tsExists = await fs.pathExists(filePath)
      const jsExists = await fs.pathExists(jsPath)
      const mjsExists = await fs.pathExists(mjsPath)

      if (!tsExists && !jsExists && !mjsExists) {
        // Skip next.config.ts since it may be .mjs by default
        if (!file.includes('next.config') && !file.includes('tailwind.config')) {
          missingFiles.push(file)
        }
      }
      continue
    }

    if (!await fs.pathExists(filePath)) {
      missingFiles.push(file)
    }
  }

  // Check tsconfig.json specifically and validate JSON syntax
  const tsconfigPath = path.join(cwd, 'tsconfig.json')
  if (await fs.pathExists(tsconfigPath)) {
    try {
      const content = await fs.readFile(tsconfigPath, 'utf-8')
      JSON.parse(content)
    } catch {
      invalidFiles.push('tsconfig.json')
    }
  } else {
    missingFiles.push('tsconfig.json')
  }

  // Check config directory if it exists
  const configDir = path.join(cwd, 'config')
  if (await fs.pathExists(configDir)) {
    const configFiles = await fs.readdir(configDir)
    const tsConfigFiles = configFiles.filter(f => f.endsWith('.ts'))

    // We don't validate TS syntax here since that requires compilation
    // but we check that the files are not empty
    for (const file of tsConfigFiles) {
      const filePath = path.join(configDir, file)
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        if (content.trim().length === 0) {
          invalidFiles.push(`config/${file}`)
        }
      } catch {
        invalidFiles.push(`config/${file}`)
      }
    }
  }

  // Report results
  if (invalidFiles.length > 0) {
    return {
      name: 'Configuration',
      status: 'fail',
      message: `Invalid config files: ${invalidFiles.join(', ')}`,
      fix: 'Check the syntax of the invalid configuration files',
    }
  }

  if (missingFiles.length > 0) {
    return {
      name: 'Configuration',
      status: 'warn',
      message: `Missing config files: ${missingFiles.join(', ')}`,
      fix: 'Run: npx nextspark init to regenerate configuration',
    }
  }

  return {
    name: 'Configuration',
    status: 'pass',
    message: 'All config files valid',
  }
}
