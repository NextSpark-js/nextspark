/**
 * A throwaway PostgreSQL cluster with core's migrations, for the node tests of the RLS policies on the documented
 * nextspark_app cutover. Skipped by the callers when initdb and pg_ctl are not on the PATH.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

export const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

type TestContext = { after: (fn: () => void | Promise<void>) => void }

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

/** A throwaway cluster with core's migrations (no sample data), an owner client and an app client, and their URLs. */
export async function cutoverDatabase(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-rls-pg-'))
  const port = await freePort()
  execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })
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
  for (const file of fs.readdirSync(path.join(CORE, 'migrations')).filter(f => f.endsWith('.sql') && f !== '090_sample_data.sql').sort()) {
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
