/**
 * withServiceTransaction (lib/db.ts, #266) against a real PostgreSQL: the db helpers that run on the service pool
 * join the transaction, so a throw rolls back every write they made; work that outlives the transaction goes back to
 * the pool and commits on its own.
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when they are not on the
 * PATH.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Client } from 'pg'

const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)
const describeWithPostgres = HAS_POSTGRES ? describe : describe.skip

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

describeWithPostgres('withServiceTransaction', () => {
  let dir: string
  let outside: Client
  let db: typeof import('@nextsparkjs/core/lib/db')

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'service-tx-pg-'))
    const port = await freePort()
    execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
    const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
    outside = new Client({ connectionString: url })
    // the cluster stops under it at the end
    outside.on('error', () => {})
    await outside.connect()
    await outside.query('CREATE TABLE notes (label TEXT NOT NULL)')

    // lib/db.ts opens its pools on import, from DATABASE_URL
    process.env.DATABASE_URL = url
    delete process.env.DATABASE_SERVICE_URL
    db = require('@nextsparkjs/core/lib/db')
  }, 120000)

  afterAll(async () => {
    await db?.pool.end()
    await outside?.end()
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  beforeEach(() => outside.query('DELETE FROM notes'))

  /** The labels a separate connection sees: only committed rows. */
  const committed = async () => (await outside.query('SELECT label FROM notes ORDER BY label')).rows.map(r => r.label)
  const insert = `INSERT INTO notes (label) VALUES ($1) RETURNING label`

  test('every service-pool helper writes in the transaction, and a throw rolls all of it back', async () => {
    let seenInside: string[] = []

    await expect(db.withServiceTransaction(async () => {
      await db.query(insert, ['query'])
      await db.queryRows(insert, ['queryRows'])
      await db.queryOne(insert, ['queryOne'])
      await db.queryWithRLS(insert, ['queryWithRLS'])
      await db.queryOneWithRLS(insert, ['queryOneWithRLS'])
      await db.mutateWithRLS(insert, ['mutateWithRLS'])
      await db.queryWithRLS(insert, ['queryWithRLS service'], 'u1', { service: true })
      await db.mutateWithRLS(insert, ['mutateWithRLS service'], 'u1', { service: true })
      seenInside = (await db.queryRows<{ label: string }>('SELECT label FROM notes ORDER BY label')).map(r => r.label)
      // none of them committed on a connection of its own
      expect(await committed()).toEqual([])
      throw new Error('handler failed')
    })).rejects.toThrow('handler failed')

    expect(seenInside).toEqual([
      'mutateWithRLS', 'mutateWithRLS service', 'query', 'queryOne', 'queryOneWithRLS', 'queryRows', 'queryWithRLS',
      'queryWithRLS service',
    ])
    expect(await committed()).toEqual([])
  })

  test('the writes commit together when the function resolves', async () => {
    await db.withServiceTransaction(async () => {
      await db.query(insert, ['first'])
      await db.mutateWithRLS(insert, ['second'])
    })

    expect(await committed()).toEqual(['first', 'second'])
  })

  test('a query issued after the transaction ended goes to the pool and is committed', async () => {
    let finishLate!: () => void
    const lateGate = new Promise<void>(resolve => { finishLate = resolve })
    let late!: Promise<unknown>

    await expect(db.withServiceTransaction(async () => {
      await db.query(insert, ['inside'])
      // started inside, not awaited: it still carries the transaction's context when it runs
      late = lateGate.then(() => db.query(insert, ['after the transaction']))
      throw new Error('handler failed')
    })).rejects.toThrow('handler failed')

    // the released client goes to the next transaction: had the late query reused it, this rollback would undo it
    await expect(db.withServiceTransaction(async () => {
      finishLate()
      await late
      throw new Error('next handler failed')
    })).rejects.toThrow('next handler failed')
    await db.query(insert, ['after, plain'])

    expect(await committed()).toEqual(['after the transaction', 'after, plain'])
  })
})
