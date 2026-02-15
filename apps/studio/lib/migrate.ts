/**
 * Simple migration runner for Studio.
 * Reads SQL files from migrations/ and executes them in order.
 * Tracks applied migrations in a _migrations table.
 */

import { pool } from './db'
import { readdir, readFile } from 'fs/promises'
import path from 'path'

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations')

let migrated = false

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

  // Read migration files
  let files: string[]
  try {
    files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
  } catch {
    // No migrations directory — nothing to run
    return
  }

  for (const file of files) {
    if (appliedSet.has(file)) continue

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf-8')
    await pool.query(sql)
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
  }
}
