/**
 * Recorded migrations Health Check (#428)
 *
 * Runs core's scripts/db/check-migration-ledger.mjs against MIGRATE_DATABASE_URL, else DATABASE_URL (the ledgers are for
 * the migration role): a migration file that was edited after it
 * was applied never reaches that database, and one that was renamed would be applied a second time. Nothing is
 * written, not even the hash of a row that has none (db:migrate fills it in). An edit is a warning, because the
 * database still migrates correctly; a rename fails, because db:migrate refuses to run until the ledger is updated.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getCoreDir } from '../../utils/paths.js'
import type { HealthCheckResult } from '../index.js'
import { readProjectEnv, resolveDatabaseUrl } from './database.js'

interface Findings {
  edited: { file: string; source: string }[]
  accept: string[]
  renamed: { from: string; to: string; source: string; update: string }[]
}

export async function checkMigrationLedger(coreDir = getCoreDir()): Promise<HealthCheckResult> {
  const name = 'Migrations'
  const script = join(coreDir, 'scripts', 'db', 'check-migration-ledger.mjs')
  if (!existsSync(script)) return { name, status: 'pass', message: 'Not checked: this @nextsparkjs/core has no check for it' }
  const databaseUrl = await resolveDatabaseUrl()
  // the Database check already says when there is no DATABASE_URL
  if (!databaseUrl) return { name, status: 'pass', message: 'Not checked: DATABASE_URL not configured' }

  // The ledgers are for the migration role, which is not the one DATABASE_URL connects as after the runtime cutover
  const migrateUrl = process.env.MIGRATE_DATABASE_URL || (await readProjectEnv())['MIGRATE_DATABASE_URL']
  const run = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, ...(migrateUrl ? { MIGRATE_DATABASE_URL: migrateUrl } : {}) },
    encoding: 'utf8',
    timeout: 30000,
  })
  const output = (run.stdout || '').trim()
  let found: Findings | null = null
  if (run.status === 0) {
    try {
      const parsed = JSON.parse(output) as Findings
      if (Array.isArray(parsed?.edited) && Array.isArray(parsed?.renamed) && Array.isArray(parsed?.accept)) found = parsed
    } catch {
      // not a verdict
    }
  }
  // the RLS check already warns about a database it cannot read
  if (!found) return { name, status: 'pass', message: `Not checked: ${output.replace(/\s*\n\s*/g, ' ') || 'the check did not finish'}` }

  if (found.renamed.length > 0) {
    return {
      name,
      status: 'fail',
      code: 'NS_MIGRATION_RENAMED',
      message: `NS_MIGRATION_RENAMED: ${found.renamed.map(item => `${item.from} is now ${item.to} (${item.source})`).join(', ')}; db:migrate would apply ${found.renamed.length === 1 ? 'it' : 'them'} again`,
      fix: `Record the new ${found.renamed.length === 1 ? 'name' : 'names'}: ${found.renamed.map(item => item.update).join(' ')}`,
    }
  }
  if (found.edited.length > 0) {
    return {
      name,
      status: 'warn',
      code: 'NS_MIGRATION_EDITED',
      message: `NS_MIGRATION_EDITED: ${found.edited.map(item => `${item.file} (${item.source})`).join(', ')} changed after ${found.edited.length === 1 ? 'it was' : 'they were'} applied, so the change never reached this database`,
      fix: `Put the change in a new migration or restore the file. If the edit changes nothing the database sees, accept it: ${found.accept.join(' ')}`,
    }
  }
  return { name, status: 'pass', message: 'The recorded migrations match the files' }
}
