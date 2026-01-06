import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

export type PackageManager = 'npm' | 'pnpm' | 'yarn'

/**
 * Detects the package manager used in the current project
 * Priority:
 * 1. Lockfile existence (pnpm-lock.yaml, yarn.lock, package-lock.json)
 * 2. packageManager field in package.json
 * 3. Default to npm
 */
export function detectPackageManager(): PackageManager {
  const cwd = process.cwd()

  // Detect by existing lockfile
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(cwd, 'package-lock.json'))) return 'npm'

  // Detect by packageManager field in package.json
  const pkgPath = join(cwd, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      if (pkg.packageManager) {
        if (pkg.packageManager.startsWith('pnpm')) return 'pnpm'
        if (pkg.packageManager.startsWith('yarn')) return 'yarn'
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Default: npm
  return 'npm'
}

/**
 * Returns the install command for a package manager with dependencies
 */
export function getInstallCommand(pm: PackageManager, deps: string[]): string {
  const depsStr = deps.join(' ')
  switch (pm) {
    case 'pnpm':
      return `pnpm add ${depsStr}`
    case 'yarn':
      return `yarn add ${depsStr}`
    default:
      return `npm install ${depsStr}`
  }
}

/**
 * Runs the package manager install command for the given dependencies
 */
export async function runInstall(pm: PackageManager, deps: string[]): Promise<void> {
  if (deps.length === 0) return

  const command = getInstallCommand(pm, deps)
  execSync(command, { stdio: 'inherit', cwd: process.cwd() })
}
