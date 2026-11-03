/**
 * Hoisting Health Check
 *
 * A web + mobile monorepo needs shamefully-hoist / public-hoist-pattern so Metro resolves react-native-css-interop
 * from the mobile app. pnpm 11 and later read them only from pnpm-workspace.yaml; a project that has them only in
 * .npmrc builds on pnpm 10 and fails to resolve the module on pnpm 11 (#377).
 */

import fs from 'fs-extra'
import path from 'path'
import type { HealthCheckResult } from '../index.js'
import { hasTopLevelKey, HOIST_PATTERNS, readPackageEntries } from '../../wizard/generators/workspace-yaml.js'

/** The nearest directory from `start` upwards that holds a pnpm-workspace.yaml (doctor runs from web/ in a generated monorepo). */
async function findWorkspaceRoot(start: string): Promise<string | null> {
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (await fs.pathExists(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    if (path.dirname(dir) === dir) return null
  }
}

export async function checkHoisting(start = process.cwd()): Promise<HealthCheckResult> {
  const name = 'Hoisting'
  const root = await findWorkspaceRoot(start)
  const notApplicable = { name, status: 'pass' as const, message: 'Not a web + mobile monorepo' }
  if (!root) return notApplicable
  const yaml = await fs.readFile(path.join(root, 'pnpm-workspace.yaml'), 'utf8')
  const npmrc = path.join(root, '.npmrc')
  // Only a workspace that lists mobile has this requirement (a mobile app added to a web project is not one)
  if (!readPackageEntries(yaml).includes('mobile') || !(await fs.pathExists(path.join(root, 'mobile', 'package.json'))) || !(await fs.pathExists(npmrc))) {
    return notApplicable
  }
  const rc = await fs.readFile(npmrc, 'utf8')
  const missing = [
    /^shamefully-hoist\s*=/m.test(rc) && !hasTopLevelKey(yaml, 'shamefullyHoist') ? 'shamefullyHoist' : '',
    /^public-hoist-pattern/m.test(rc) && !hasTopLevelKey(yaml, 'publicHoistPattern') ? 'publicHoistPattern' : '',
  ].filter(Boolean)
  if (missing.length === 0) return { name, status: 'pass', message: 'Hoisting settings are in pnpm-workspace.yaml' }
  return {
    name,
    status: 'warn',
    message: `${missing.join(' and ')} only in .npmrc: pnpm 11 and later ignore it there, and Metro cannot resolve react-native-css-interop`,
    fix: `Add to ${path.join(root, 'pnpm-workspace.yaml')}: shamefullyHoist: true, and publicHoistPattern with ${HOIST_PATTERNS.map(pattern => `'${pattern}'`).join(', ')}`,
  }
}
