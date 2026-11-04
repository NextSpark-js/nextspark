/**
 * App role Health Check
 *
 * Runs core's scripts/db/check-app-role.mjs against DATABASE_URL: the policies are written TO authenticated, so
 * nextspark_app has to be a member of it that inherits. Migration 022 skips that GRANT when the migration role cannot
 * run it. A database with no nextspark_app (no cutover yet) has nothing to check, and says so as a pass.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getCoreDir } from '../../utils/paths.js'
import type { HealthCheckResult } from '../index.js'
import { resolveDatabaseUrl } from './database.js'

const CODE = 'NS_APP_ROLE_NOT_AUTHENTICATED'

export async function checkAppRole(coreDir = getCoreDir()): Promise<HealthCheckResult> {
  const name = 'App role'
  const script = join(coreDir, 'scripts', 'db', 'check-app-role.mjs')
  if (!existsSync(script)) return { name, status: 'pass', message: 'Not checked: this @nextsparkjs/core has no check for it' }
  const databaseUrl = await resolveDatabaseUrl()
  // the Database check already says when there is no DATABASE_URL
  if (!databaseUrl) return { name, status: 'pass', message: 'Not checked: DATABASE_URL not configured' }

  const run = spawnSync(process.execPath, [script], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    timeout: 30000,
  })
  const [message = '', statement = ''] = (run.stdout || '').trim().split('\n').map(line => line.trim())
  if (run.status === 0) return { name, status: 'pass', message }
  if (run.status === 1) {
    return {
      name,
      status: 'warn',
      code: CODE,
      message: `${CODE}: ${message}`,
      fix: `As a superuser, run: ${statement}`,
    }
  }
  // the RLS check already warns about a database it cannot read
  return { name, status: 'pass', message: `Not checked: ${message || 'the check did not finish'}` }
}
