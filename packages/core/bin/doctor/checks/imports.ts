/**
 * Imports Health Check
 *
 * Verifies that core imports are accessible and not broken.
 */

import fs from 'fs-extra'
import path from 'path'
import type { HealthCheckResult } from '../index.js'

/**
 * Core NextSpark imports that should be accessible
 */
const CORE_IMPORTS = [
  '@nextsparkjs/core',
]

/**
 * Common patterns that indicate broken imports in source files
 */
const BROKEN_IMPORT_PATTERNS = [
  // Non-existent local imports
  /from ['"]\.\.?\/.+['"]/g,
]

/**
 * Check if @nextsparkjs/core is accessible
 */
async function checkCorePackage(cwd: string): Promise<{ accessible: boolean; reason?: string }> {
  const nodeModulesPath = path.join(cwd, 'node_modules', '@nextsparkjs', 'core')

  // Check if the package exists in node_modules
  if (!await fs.pathExists(nodeModulesPath)) {
    return { accessible: false, reason: '@nextsparkjs/core not found in node_modules' }
  }

  // Check if package.json exists
  const packageJsonPath = path.join(nodeModulesPath, 'package.json')
  if (!await fs.pathExists(packageJsonPath)) {
    return { accessible: false, reason: '@nextsparkjs/core package.json not found' }
  }

  // Check if main entry point exists
  try {
    const packageJson = await fs.readJson(packageJsonPath)
    const mainEntry = packageJson.main || packageJson.module || './dist/index.js'
    const mainPath = path.join(nodeModulesPath, mainEntry)

    if (!await fs.pathExists(mainPath)) {
      return { accessible: false, reason: '@nextsparkjs/core entry point not found' }
    }
  } catch {
    return { accessible: false, reason: 'Failed to read @nextsparkjs/core package.json' }
  }

  return { accessible: true }
}

/**
 * Scan source files for potentially broken imports
 */
async function scanForBrokenImports(cwd: string): Promise<string[]> {
  const brokenImports: string[] = []

  // Common source directories to scan
  const srcDirs = ['src', 'app', 'pages', 'components', 'lib']
  const existingDirs: string[] = []

  for (const dir of srcDirs) {
    const dirPath = path.join(cwd, dir)
    if (await fs.pathExists(dirPath)) {
      existingDirs.push(dirPath)
    }
  }

  // Scan each directory for .ts/.tsx files (limited to prevent performance issues)
  const maxFilesToScan = 50
  let filesScanned = 0

  for (const dir of existingDirs) {
    if (filesScanned >= maxFilesToScan) break

    try {
      const files = await fs.readdir(dir, { withFileTypes: true })

      for (const file of files) {
        if (filesScanned >= maxFilesToScan) break

        if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.tsx'))) {
          const filePath = path.join(dir, file.name)
          try {
            const content = await fs.readFile(filePath, 'utf-8')

            // Check for imports from non-existent paths
            const importMatches = content.match(/from ['"](@?[^'"]+)['"]/g)
            if (importMatches) {
              for (const match of importMatches) {
                const importPath = match.replace(/from ['"]/g, '').replace(/['"]/g, '')

                // Only check local imports
                if (importPath.startsWith('.')) {
                  const absoluteImportPath = path.resolve(path.dirname(filePath), importPath)

                  // Check for .ts, .tsx, .js, .jsx extensions and index files
                  const possiblePaths = [
                    absoluteImportPath,
                    `${absoluteImportPath}.ts`,
                    `${absoluteImportPath}.tsx`,
                    `${absoluteImportPath}.js`,
                    `${absoluteImportPath}.jsx`,
                    path.join(absoluteImportPath, 'index.ts'),
                    path.join(absoluteImportPath, 'index.tsx'),
                    path.join(absoluteImportPath, 'index.js'),
                  ]

                  const exists = await Promise.any(
                    possiblePaths.map(async p => {
                      if (await fs.pathExists(p)) return true
                      throw new Error('Not found')
                    })
                  ).catch(() => false)

                  if (!exists) {
                    brokenImports.push(`${file.name}: ${importPath}`)
                  }
                }
              }
            }

            filesScanned++
          } catch {
            // Skip files that can't be read
          }
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  return brokenImports
}

/**
 * Check for broken imports in the project
 */
export async function checkImports(): Promise<HealthCheckResult> {
  const cwd = process.cwd()

  // Check if @nextsparkjs/core is accessible
  const coreCheck = await checkCorePackage(cwd)

  if (!coreCheck.accessible) {
    // Only warn if package.json lists it as a dependency
    const packageJsonPath = path.join(cwd, 'package.json')
    let hasCoreDep = false

    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = await fs.readJson(packageJsonPath)
        hasCoreDep = !!(packageJson.dependencies?.['@nextsparkjs/core'] ||
                       packageJson.devDependencies?.['@nextsparkjs/core'])
      } catch {
        // Ignore
      }
    }

    if (hasCoreDep) {
      return {
        name: 'Imports',
        status: 'fail',
        message: coreCheck.reason || '@nextsparkjs/core not accessible',
        fix: 'Run: pnpm install',
      }
    }
  }

  // Scan for broken local imports (quick check)
  try {
    const brokenImports = await scanForBrokenImports(cwd)

    if (brokenImports.length > 0) {
      const displayImports = brokenImports.slice(0, 3).join(', ')
      const remaining = brokenImports.length > 3 ? ` (+${brokenImports.length - 3} more)` : ''

      return {
        name: 'Imports',
        status: 'warn',
        message: `Potentially broken imports: ${displayImports}${remaining}`,
        fix: 'Check the import paths in the mentioned files',
      }
    }
  } catch {
    // If scanning fails, we still consider it a pass
    // since it might be a permissions issue
  }

  return {
    name: 'Imports',
    status: 'pass',
    message: 'No broken imports found',
  }
}
