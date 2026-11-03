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
import { hasTopLevelKey, HOIST_PATTERNS } from '../../wizard/generators/workspace-yaml.js'

export async function checkHoisting(root = process.cwd()): Promise<HealthCheckResult> {
  const name = 'Hoisting'
  const npmrc = path.join(root, '.npmrc')
  const workspace = path.join(root, 'pnpm-workspace.yaml')
  // Only a monorepo with a mobile app has this requirement
  if (!(await fs.pathExists(path.join(root, 'mobile', 'package.json'))) || !(await fs.pathExists(workspace)) || !(await fs.pathExists(npmrc))) {
    return { name, status: 'pass', message: 'Not a web + mobile monorepo' }
  }
  const rc = await fs.readFile(npmrc, 'utf8')
  const yaml = await fs.readFile(workspace, 'utf8')
  const missing = [
    /^shamefully-hoist\s*=/m.test(rc) && !hasTopLevelKey(yaml, 'shamefullyHoist') ? 'shamefullyHoist' : '',
    /^public-hoist-pattern/m.test(rc) && !hasTopLevelKey(yaml, 'publicHoistPattern') ? 'publicHoistPattern' : '',
  ].filter(Boolean)
  if (missing.length === 0) return { name, status: 'pass', message: 'Hoisting settings are in pnpm-workspace.yaml' }
  return {
    name,
    status: 'warn',
    message: `${missing.join(' and ')} only in .npmrc: pnpm 11 and later ignore it there, and Metro cannot resolve react-native-css-interop`,
    fix: `Add to pnpm-workspace.yaml: shamefullyHoist: true, and publicHoistPattern with ${HOIST_PATTERNS.map(pattern => `'${pattern}'`).join(', ')}`,
  }
}
