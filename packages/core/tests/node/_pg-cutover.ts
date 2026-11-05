/**
 * A throwaway PostgreSQL cluster with core's migrations, for the node tests of the RLS policies on the documented
 * nextspark_app cutover. Skipped by the callers when initdb and pg_ctl are not on the PATH.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { HAS_POSTGRES, startCluster } from '../support/throwaway-postgres'

export const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export { HAS_POSTGRES }

type TestContext = { after: (fn: () => void | Promise<void>) => void }

/** A throwaway cluster with core's migrations (no sample data), an owner client and an app client, and their URLs. */
export async function cutoverDatabase(t: TestContext, { except = [] as string[] } = {}) {
  const { port, stop } = await startCluster('team-rls-pg')
  t.after(stop)
  const url = (user: string) => `postgresql://${user}@127.0.0.1:${port}/postgres?sslmode=disable`
  const connect = async (user: string) => {
    const client = new pg.Client({ connectionString: url(user) })
    // the cluster stops under it at the end of the test
    client.on('error', () => {})
    await client.connect()
    t.after(() => client.end())
    return client
  }
  const owner = await connect('owner')
  for (const file of fs.readdirSync(path.join(CORE, 'migrations')).filter(f => f.endsWith('.sql') && f !== '090_sample_data.sql' && !except.includes(f)).sort()) {
    await owner.query(fs.readFileSync(path.join(CORE, 'migrations', file), 'utf8'))
  }
  // the documented cutover: a login without BYPASSRLS that inherits nextspark_app
  await owner.query('CREATE ROLE app_login LOGIN NOSUPERUSER NOBYPASSRLS INHERIT IN ROLE nextspark_app')
  const app = await connect('app_login')
  return { owner, app, ownerUrl: url('owner'), appUrl: url('app_login') }
}

/** Runs `sql` on the app connection as `userId`, in its own transaction, as lib/db.ts does. */
export function asUser(app: pg.Client) {
  return async (userId: string, sql: string, params: unknown[] = []) => {
    await app.query('BEGIN')
    try {
      await app.query(`SET LOCAL app.user_id = '${userId}'`)
      const result = await app.query(sql, params)
      await app.query('COMMIT')
      return result
    } catch (error) {
      await app.query('ROLLBACK')
      throw error
    }
  }
}
