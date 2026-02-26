/**
 * Simple migration runner for Studio.
 * Reads SQL files from migrations/ and executes them in order.
 * Tracks applied migrations in a _migrations table.
 */

import { pool } from './db'
import { readdir, readFile } from 'fs/promises'
import path from 'path'

// Try multiple paths for the migrations directory:
// - Dev mode: process.cwd() is apps/studio/, so ./migrations works
// - Docker standalone: process.cwd() is /app, migrations copied to /app/apps/studio/migrations
const CANDIDATE_DIRS = [
  path.resolve(process.cwd(), 'migrations'),
  path.resolve(process.cwd(), 'apps', 'studio', 'migrations'),
]

let migrated = false

async function findMigrationsDir(): Promise<string | null> {
  for (const dir of CANDIDATE_DIRS) {
    try {
      await readdir(dir)
      return dir
    } catch {
      // try next
    }
  }
  return null
}

export async function runMigrations(): Promise<void> {
  if (migrated) return
  migrated = true

  // Create tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Get already-applied migrations
  const { rows: applied } = await pool.query('SELECT name FROM _migrations ORDER BY name')
  const appliedSet = new Set(applied.map((r: { name: string }) => r.name))

  // Find migrations directory
  const migrationsDir = await findMigrationsDir()
  if (!migrationsDir) return

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()

  for (const file of files) {
    if (appliedSet.has(file)) continue

    const sql = await readFile(path.join(migrationsDir, file), 'utf-8')
    await pool.query(sql)
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
  }
}
