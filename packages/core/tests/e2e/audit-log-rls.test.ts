import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import type { NextRequest } from 'next/server'

const testDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(testDir, '../../../..')
const e2eDir = join(repoRoot, '.e2e')
const dataDir = join(e2eDir, 'pg')
const logFile = join(e2eDir, 'postgres.log')
const socketDir = join('/tmp', `nextspark-pg-206-${process.pid}`)
const migrationPath = join(repoRoot, 'packages/core/migrations/028_api_audit_log_insert_policy.sql')
const database = 'nextspark_audit_206'
const owner = 'nextspark_owner'

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): void {
  console.log(`$ ${command} ${args.join(' ')}`)
  execFileSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    timeout: 120_000,
  })
}

async function freeHighPort(): Promise<number> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const port = 49_152 + Math.floor(Math.random() * (65_535 - 49_152))
    const available = await new Promise<boolean>(resolvePort => {
      const server = createServer()
      server.once('error', () => resolvePort(false))
      server.listen(port, '127.0.0.1', () => server.close(() => resolvePort(true)))
    })
    if (available) return port
  }
  throw new Error('Could not find a free high PostgreSQL port')
}

async function main(): Promise<void> {
  assert.equal(existsSync(e2eDir), false, `${e2eDir} already exists; refusing to delete pre-existing test data`)

  const port = await freeHighPort()
  const ownerUrl = `postgresql://${owner}@127.0.0.1:${port}/${database}?sslmode=disable`
  const runtimeUrl = `postgresql://nextspark_app@127.0.0.1:${port}/${database}?sslmode=disable`
  let clusterStarted = false
  let dbModule: typeof import('../../src/lib/db') | undefined

  mkdirSync(e2eDir, { recursive: true })
  mkdirSync(socketDir, { recursive: true })

  try {
    run('initdb', [
      '-D', dataDir,
      '--auth=trust',
      '--no-locale',
      '--encoding=UTF8',
      '--username', owner,
    ])
    run('pg_ctl', ['-D', dataDir, '-l', logFile, '-o', `-h 127.0.0.1 -p ${port} -k ${socketDir}`, 'start', '-w'])
    clusterStarted = true
    run('createdb', ['--host', '127.0.0.1', '--port', String(port), '--username', owner, database])

    const migrationEnv = {
      ...process.env,
      DATABASE_URL: ownerUrl,
      MIGRATE_DATABASE_URL: ownerUrl,
      NEXT_PUBLIC_ACTIVE_THEME: '__audit_log_e2e__',
      NODE_ENV: 'test',
    }
    run('node', ['packages/core/scripts/db/run-migrations.mjs', '--no-env-file'], migrationEnv)

    // The runner records migrations by filename, while each migration must also
    // be safe to execute directly more than once during recovery/manual rollout.
    if (existsSync(migrationPath)) {
      run('psql', [ownerUrl, '--set', 'ON_ERROR_STOP=1', '--file', migrationPath])
    }

    const admin = new Client({ connectionString: ownerUrl })
    await admin.connect()
    try {
      // Migration 022 intentionally creates this runtime role as NOLOGIN; a
      // deployment grants it a credential. Trust auth lets this throwaway
      // cluster test the exact role without storing a password.
      await admin.query('ALTER ROLE nextspark_app LOGIN')
      await admin.query(
        `INSERT INTO public."users" (id, email, name, role)
         VALUES ($1, $2, $3, 'member'), ($4, $5, $6, 'member')`,
        ['audit-user-206', 'audit-user-206@example.test', 'Audit User', 'other-user-206', 'other-user-206@example.test', 'Other User']
      )
    } finally {
      await admin.end()
    }

    process.env.DATABASE_URL = runtimeUrl
    process.env.DATABASE_SERVICE_URL = ownerUrl
    process.env.NODE_ENV = 'test'

    const loadedDbModule = await import('../../src/lib/db')
    dbModule = loadedDbModule
    const { logGenericHandlerUsage } = await import('../../src/lib/api/entity/audit-log')

    const [runtimeIdentity] = await loadedDbModule.queryWithRLS<{
      currentUser: string
      bypassesRls: boolean
      ownsAuditTable: boolean
    }>(
      `SELECT
         current_user AS "currentUser",
         rolbypassrls AS "bypassesRls",
         current_user = pg_get_userbyid(c.relowner) AS "ownsAuditTable"
       FROM pg_roles
       CROSS JOIN pg_class c
       WHERE rolname = current_user
         AND c.oid = 'public.api_audit_log'::regclass`,
      [],
      'audit-user-206'
    )
    assert.deepEqual(runtimeIdentity, {
      currentUser: 'nextspark_app',
      bypassesRls: false,
      ownsAuditTable: false,
    })
    console.log('PASS: runtime connection is nextspark_app with RLS enforced')

    const request = {
      nextUrl: new URL('http://localhost/api/v1/pets'),
      method: 'GET',
      headers: new Headers({
        'user-agent': 'audit-log-rls-e2e',
        'x-forwarded-for': '203.0.113.206',
      }),
    } as NextRequest

    await logGenericHandlerUsage(
      {
        success: true,
        type: 'session',
        user: { id: 'audit-user-206', email: 'audit-user-206@example.test', role: 'member' },
      },
      request,
      200,
      12
    )

    const verify = new Client({ connectionString: ownerUrl })
    await verify.connect()
    try {
      const result = await verify.query<{
        userId: string
        endpoint: string
        method: string
        statusCode: number
      }>(
        `SELECT "userId", endpoint, method, "statusCode"
         FROM public."api_audit_log"
         ORDER BY "createdAt"`
      )
      assert.equal(result.rowCount, 1, 'generic-handler audit writer must persist exactly one row')
      assert.deepEqual(result.rows[0], {
        userId: 'audit-user-206',
        endpoint: '/api/v1/pets',
        method: 'GET',
        statusCode: 200,
      })
    } finally {
      await verify.end()
    }

    let rejectedCode: string | undefined
    try {
      await loadedDbModule.mutateWithRLS(
        `INSERT INTO public."api_audit_log"
         ("apiKeyId", "userId", endpoint, method, "statusCode")
         VALUES (NULL, $1, '/api/v1/forged', 'POST', 201)`,
        ['other-user-206'],
        'audit-user-206'
      )
    } catch (error) {
      rejectedCode = (error as { code?: string }).code
    }
    assert.equal(rejectedCode, '42501', 'RLS must reject an audit row forged for another user')

    const finalCheck = new Client({ connectionString: ownerUrl })
    await finalCheck.connect()
    try {
      const result = await finalCheck.query<{ count: string }>('SELECT count(*)::text AS count FROM public."api_audit_log"')
      assert.equal(result.rows[0]?.count, '1', 'rejected forged insert must not add a second row')
    } finally {
      await finalCheck.end()
    }

    console.log('PASS: generic-handler audit write persisted 1 row for audit-user-206')
    console.log('PASS: cross-user audit insert was rejected with PostgreSQL 42501')
  } finally {
    if (dbModule) await dbModule.gracefulShutdown(5_000)
    if (clusterStarted) {
      try {
        run('pg_ctl', ['-D', dataDir, 'stop', '-m', 'fast', '-w'])
      } catch (error) {
        console.error('Failed to stop the throwaway PostgreSQL cluster:', error)
      }
    }
    rmSync(e2eDir, { recursive: true, force: true })
    rmSync(socketDir, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
