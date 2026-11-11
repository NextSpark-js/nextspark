/**
 * Fixture projects for the tests that run db:migrate against a real PostgreSQL (#428, #429): a throwaway cluster
 * for the file, and a project per test on a database of its own. Call `migrationProjects(prefix)` at the top of a
 * test file: it registers the hooks that start and stop the cluster.
 *
 * Each project is a fixture monorepo (pnpm-workspace.yaml) whose core has one migration, with one project
 * migration and one entity migration; `files` adds or replaces files, by path relative to the project.
 */
import { before, after } from 'node:test'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { HAS_POSTGRES, startCluster, type ThrowawayCluster } from './throwaway-postgres'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
export const CHECK_LEDGER = path.join(CORE, 'scripts/db/check-migration-ledger.mjs')

/** The SQL of a migration that creates `table` if needed and inserts `id` in it, so a second run of it shows. */
export const logging = (table: string, id: string) => `CREATE TABLE IF NOT EXISTS ${table} (file text); INSERT INTO ${table} VALUES ('${id}');`

export function migrationProjects(prefix: string) {
  let cluster: ThrowawayCluster
  let admin: pg.Client
  let databases = 0
  const toClean: string[] = []

  before(async () => {
    if (!HAS_POSTGRES) return
    cluster = await startCluster(prefix)
    admin = new pg.Client({ connectionString: `postgresql://owner@127.0.0.1:${cluster.port}/postgres?sslmode=disable` })
    admin.on('error', () => {})
    await admin.connect()
  }, { timeout: 120000 })

  after(async () => {
    await admin?.end()
    cluster?.stop()
    for (const dir of toClean) fs.rmSync(dir, { recursive: true, force: true })
  })

  async function project(files: Record<string, string> = {}) {
    const database = `fixture_${++databases}`
    await admin.query(`CREATE DATABASE ${database}`)
    const url = `postgresql://owner@127.0.0.1:${cluster.port}/${database}?sslmode=disable`
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`))
    toClean.push(root)
    const write = (relative: string, content: string) => {
      fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
      fs.writeFileSync(path.join(root, relative), content)
    }
    write('nextspark.config.ts', 'export default { plugins: [] }\n')
    write('package.json', JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.4.2' } }))
    write('pnpm-workspace.yaml', 'packages: []\n')
    write('config/theme.config.ts', "export const themeConfig = { name: 'fixture' }\n")
    write('packages/core/migrations/001_core.sql', logging('core_log', '001'))
    write('migrations/001_project.sql', logging('project_log', '001'))
    write('entities/widgets/migrations/001_widgets.sql', logging('widget_log', '001'))
    for (const [relative, content] of Object.entries(files)) write(relative, content)

    const env = { ...process.env, DATABASE_URL: url }
    delete env.MIGRATE_DATABASE_URL
    delete env.MIGRATION_TIMEOUT_SECONDS
    const client = new pg.Client({ connectionString: url })
    client.on('error', () => {})
    await client.connect()
    const run = (script: string, args: string[]) => {
      const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env, encoding: 'utf8', timeout: 60000 })
      return { status: result.status, out: `${result.stdout}${result.stderr}` }
    }
    return {
      database,
      root,
      url,
      port: cluster.port,
      write,
      client,
      migrate: (...args: string[]) => run(RUNNER, ['--no-env-file', ...args]),
      check: () => run(CHECK_LEDGER, []),
      rows: async (sql: string) => (await client.query(sql)).rows,
      log: async (table: string) => (await client.query(`SELECT file FROM ${table} ORDER BY file`)).rows.map(row => row.file),
      /** Every table of the database and the rows of each, as text: what a dry run must leave exactly as it was. */
      snapshot: async () => {
        const tables = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)).rows.map(row => row.tablename)
        const contents: Record<string, unknown> = {}
        for (const table of tables) contents[table] = (await client.query(`SELECT t::text AS row FROM "${table}" t ORDER BY 1`)).rows.map(row => row.row)
        const columns = (await client.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY 1, 2`)).rows
        return { tables, contents, columns }
      },
      end: () => client.end(),
    }
  }

  return { project, skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH' }
}
