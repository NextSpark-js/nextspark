/**
 * scripts/db/check-auth-schema.mjs: the NOT NULL, no-default columns of the auth tables that Better Auth never
 * writes (Better Auth 1.7.3 and later refuses every auth call on them). Quiet on core's schema, the column the
 * report names for account.issuer and for a project's own column, the exit codes `nextspark doctor` reads, and
 * `db:migrate` stopping after a project migration adds such a column.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CORE, HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'
import { authSchemaProblems, authSchemaReport } from '../../scripts/db/check-auth-schema.mjs'

const SCRIPT = path.join(CORE, 'scripts/db/check-auth-schema.mjs')
const RUNNER = path.join(CORE, 'scripts/db/run-migrations.mjs')
const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'

function check(env: Record<string, string | undefined>) {
  const result = spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 })
  return { status: result.status, output: result.stdout.trim() }
}

test('the auth schema check: quiet on core\'s schema, names account.issuer and a project\'s column, exits 0/1/2', { skip, timeout: 240000 }, async t => {
  const { owner, ownerUrl, appUrl } = await cutoverDatabase(t)
  assert.deepEqual(await authSchemaProblems(owner), [])
  assert.deepEqual(check({ DATABASE_URL: ownerUrl }), { status: 0, output: 'The auth tables match Better Auth\'s schema' })
  // the runtime role reads the catalogs too
  assert.equal(check({ DATABASE_URL: appUrl }).status, 0)

  await owner.query(`
    ALTER TABLE account ADD COLUMN issuer TEXT NOT NULL DEFAULT 'x';
    ALTER TABLE account ALTER COLUMN issuer DROP DEFAULT;
    ALTER TABLE users ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 't';
    ALTER TABLE users ALTER COLUMN "tenantId" DROP DEFAULT;
    ALTER TABLE users ADD COLUMN seq INT GENERATED ALWAYS AS IDENTITY;
    ALTER TABLE session ADD COLUMN kind TEXT NOT NULL DEFAULT 'web';
  `)
  const problems = await authSchemaProblems(owner)
  assert.deepEqual(problems, [{ table: 'account', column: 'issuer' }, { table: 'users', column: 'tenantId' }])
  const report = authSchemaReport(problems)
  assert.match(report, /account\.issuer: written by Better Auth 1\.7\.0-1\.7\.2 only\. Migration 038_better_auth_account_identity\.sql/)
  assert.match(report, /users\."tenantId": .*ALTER TABLE "users" ALTER COLUMN "tenantId" SET DEFAULT/)
  const failed = check({ DATABASE_URL: ownerUrl })
  assert.equal(failed.status, 1)
  assert.equal(failed.output, report)

  assert.deepEqual(check({ DATABASE_URL: '' }), { status: 2, output: 'DATABASE_URL is not set' })
  const unreachable = check({ DATABASE_URL: 'postgresql://nobody:secret-pw@127.0.0.1:1/x?sslmode=disable' })
  assert.equal(unreachable.status, 2)
  assert.match(unreachable.output, /^Could not read the auth tables: /)
  assert.doesNotMatch(unreachable.output, /secret-pw/)
})

test('db:migrate stops when a project migration leaves an auth column Better Auth never writes', { skip, timeout: 240000 }, async t => {
  const { ownerUrl } = await cutoverDatabase(t)
  // a project in monorepo layout with no core migrations of its own (the database already has core's schema)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-schema-check-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const migrations = path.join(root, 'entities/widgets/migrations')
  fs.mkdirSync(path.join(root, 'packages/core/migrations'), { recursive: true })
  fs.mkdirSync(migrations, { recursive: true })
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '16.3.8' } }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  fs.writeFileSync(path.join(root, 'config/theme.config.ts'), "export const themeConfig = { name: 'fixture' }\n")
  const migrate = () => {
    const env = { ...process.env, DATABASE_URL: ownerUrl }
    delete env.MIGRATE_DATABASE_URL
    delete env.MIGRATION_TIMEOUT_SECONDS
    const result = spawnSync(process.execPath, [RUNNER, '--no-env-file'], { cwd: root, env, encoding: 'utf8', timeout: 60000 })
    return { status: result.status, output: `${result.stdout}${result.stderr}` }
  }

  fs.writeFileSync(path.join(migrations, '001_widgets.sql'), 'CREATE TABLE widgets (id int PRIMARY KEY);')
  const clean = migrate()
  assert.equal(clean.status, 0, clean.output)
  assert.doesNotMatch(clean.output, /Better Auth never writes/)

  fs.writeFileSync(path.join(migrations, '002_users_tenant.sql'),
    `ALTER TABLE users ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 't'; ALTER TABLE users ALTER COLUMN "tenantId" DROP DEFAULT;`)
  const failed = migrate()
  assert.equal(failed.status, 1, failed.output)
  assert.match(failed.output, /002_users_tenant\.sql executed successfully[\s\S]*Better Auth never writes[\s\S]*users\."tenantId"/)

  fs.writeFileSync(path.join(migrations, '003_users_tenant_default.sql'), `ALTER TABLE users ALTER COLUMN "tenantId" SET DEFAULT 't';`)
  const fixed = migrate()
  assert.equal(fixed.status, 0, fixed.output)
})
