/**
 * Dependencies Health Check
 *
 * Verifies that node_modules are installed and match package.json dependencies.
 */

import fs from 'fs-extra'
import path from 'path'
import type { HealthCheckResult } from '../index.js'

/**
 * Check if dependencies are installed by comparing node_modules with package.json
 */
export async function checkDependencies(): Promise<HealthCheckResult> {
  const cwd = process.cwd()
  const nodeModulesPath = path.join(cwd, 'node_modules')
  const packageJsonPath = path.join(cwd, 'package.json')

  // Check if package.json exists
  if (!await fs.pathExists(packageJsonPath)) {
    return {
      name: 'Dependencies',
      status: 'fail',
      message: 'package.json not found',
      fix: 'Ensure you are in a NextSpark project directory',
    }
  }

  // Check if node_modules exists
  if (!await fs.pathExists(nodeModulesPath)) {
    return {
      name: 'Dependencies',
      status: 'fail',
      message: 'node_modules not found',
      fix: 'Run: pnpm install',
    }
  }

  // Read package.json
  let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  try {
    packageJson = await fs.readJson(packageJsonPath)
  } catch {
    return {
      name: 'Dependencies',
      status: 'fail',
      message: 'Failed to read package.json',
      fix: 'Ensure package.json is valid JSON',
    }
  }

  // Collect all dependencies
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  // Check for missing critical dependencies
  const missingDeps: string[] = []
  const criticalDeps = ['next', 'react', 'react-dom']

  for (const dep of criticalDeps) {
    if (allDependencies[dep]) {
      const depPath = path.join(nodeModulesPath, dep)
      if (!await fs.pathExists(depPath)) {
        missingDeps.push(dep)
      }
    }
  }

  // Check for @nextsparkjs/core
  const nextsparksCorePath = path.join(nodeModulesPath, '@nextsparkjs', 'core')
  const hasNextSparkCore = await fs.pathExists(nextsparksCorePath)

  if (missingDeps.length > 0) {
    return {
      name: 'Dependencies',
      status: 'fail',
      message: `Missing packages: ${missingDeps.join(', ')}`,
      fix: 'Run: pnpm install',
    }
  }

  if (!hasNextSparkCore && allDependencies['@nextsparkjs/core']) {
    return {
      name: 'Dependencies',
      status: 'warn',
      message: '@nextsparkjs/core not installed',
      fix: 'Run: pnpm install',
    }
  }

  // All dependencies are installed
  return {
    name: 'Dependencies',
    status: 'pass',
    message: 'All packages installed',
  }
}
