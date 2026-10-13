/**
 * Auth Schema Health Check
 *
 * Runs core's scripts/db/check-auth-schema.mjs against DATABASE_URL: the auth tables must not have a NOT NULL
 * column without a default that Better Auth never writes, or Better Auth refuses every auth call.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getCoreDir } from '../../utils/paths.js'
import type { HealthCheckResult } from '../index.js'
import { readProjectEnv } from './database.js'

export async function checkAuthSchema(coreDir = getCoreDir()): Promise<HealthCheckResult> {
  const name = 'Auth schema'
  const script = join(coreDir, 'scripts', 'db', 'check-auth-schema.mjs')
  if (!existsSync(script)) {
    return { name, status: 'warn', message: 'This @nextsparkjs/core does not check the auth tables', fix: 'Update @nextsparkjs/core' }
  }
  const databaseUrl = (await readProjectEnv())['DATABASE_URL'] || process.env.DATABASE_URL
  if (!databaseUrl) {
    return { name, status: 'warn', message: 'Not checked: DATABASE_URL not configured', fix: 'Add DATABASE_URL to .env' }
  }

  const run = spawnSync(process.execPath, [script], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    timeout: 30000,
  })
  const output = (run.stdout || '').trim()
  if (run.status === 0) return { name, status: 'pass', message: output }
  if (run.status === 1) {
    return { name, status: 'fail', message: output, fix: 'Change the columns listed, then run `pnpm db:migrate`' }
  }
  return { name, status: 'warn', message: `Not checked: ${output || 'the check did not finish'}`, fix: 'Start the database, or check DATABASE_URL' }
}
