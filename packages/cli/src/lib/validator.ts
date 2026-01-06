import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { NextSparkPackageJson, ValidationResult, PeerDepIssue } from '../types/nextspark-package.js'

export function validatePlugin(
  packageJson: NextSparkPackageJson,
  extractedPath: string
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const peerDepIssues: PeerDepIssue[] = []

  // 1. Verificar plugin.config.ts
  if (!existsSync(join(extractedPath, 'plugin.config.ts'))) {
    errors.push('Missing plugin.config.ts - not a valid NextSpark plugin')
  }

  // 2. Verificar nextspark metadata
  if (!packageJson.nextspark) {
    warnings.push('Missing nextspark field in package.json (recommended)')
  } else if (packageJson.nextspark.type !== 'plugin') {
    warnings.push(`nextspark.type is "${packageJson.nextspark.type}", expected "plugin"`)
  }

  // 3. Verificar peerDependencies
  const peerDeps = packageJson.peerDependencies || {}
  if (!peerDeps['@nextsparkjs/core']) {
    warnings.push('Plugin should have @nextsparkjs/core as peerDependency')
  }

  // 4. Validar compatibilidad de peerDeps con proyecto
  const projectPkgPath = join(process.cwd(), 'package.json')
  if (existsSync(projectPkgPath)) {
    const projectPkg = JSON.parse(readFileSync(projectPkgPath, 'utf-8'))
    const projectDeps = {
      ...projectPkg.dependencies,
      ...projectPkg.devDependencies
    }

    for (const [name, required] of Object.entries(peerDeps)) {
      const installed = projectDeps[name]
      if (!installed) {
        peerDepIssues.push({
          name,
          required: required as string,
          installed: null,
          severity: 'warning'
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    peerDepIssues
  }
}

export function validateTheme(
  packageJson: NextSparkPackageJson,
  extractedPath: string
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const peerDepIssues: PeerDepIssue[] = []

  // 1. Verificar config/theme.config.ts
  const configPath = join(extractedPath, 'config', 'theme.config.ts')
  if (!existsSync(configPath)) {
    errors.push('Missing config/theme.config.ts - not a valid NextSpark theme')
  }

  // 2. Verificar nextspark metadata
  if (!packageJson.nextspark) {
    warnings.push('Missing nextspark field in package.json (recommended)')
  } else if (packageJson.nextspark.type !== 'theme') {
    warnings.push(`nextspark.type is "${packageJson.nextspark.type}", expected "theme"`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    peerDepIssues
  }
}
