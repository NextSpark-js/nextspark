/**
 * Row-level security Health Check
 *
 * Runs core's scripts/db/check-rls-runtime.mjs against DATABASE_URL: RLS is skipped when the application connects as a
 * superuser, a BYPASSRLS role or the owner of the tables, which is the default until the nextspark_app cutover.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getCoreDir } from '../../utils/paths.js'
import type { HealthCheckResult } from '../index.js'
import { resolveDatabaseUrl } from './database.js'

export async function checkRlsRuntime(coreDir = getCoreDir()): Promise<HealthCheckResult> {
  const name = 'Row-level security'
  const script = join(coreDir, 'scripts', 'db', 'check-rls-runtime.mjs')
  if (!existsSync(script)) {
    return { name, status: 'warn', message: 'This @nextsparkjs/core does not check the database role', fix: 'Update @nextsparkjs/core' }
  }
  const databaseUrl = await resolveDatabaseUrl()
  if (!databaseUrl) {
    return { name, status: 'warn', message: 'Not checked: DATABASE_URL not configured', fix: 'Add DATABASE_URL to .env' }
  }

  const run = spawnSync(process.execPath, [script], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    timeout: 30000,
  })
  // one line: the doctor prints each result on its own line
  const output = (run.stdout || '').trim().replace(/\s*\n\s*/g, ' ')
  if (run.status === 0) return { name, status: 'pass', message: output }
  if (run.status === 1) {
    return {
      name,
      status: 'warn',
      message: output,
      fix: 'Connect DATABASE_URL as nextspark_app and set DATABASE_SERVICE_URL: see docs/10-backend/03-rls-policies.md (Runtime role + cutover)',
    }
  }
  return { name, status: 'warn', message: `Not checked: ${output || 'the check did not finish'}`, fix: 'Start the database and run `pnpm db:migrate`, or check DATABASE_URL' }
}
