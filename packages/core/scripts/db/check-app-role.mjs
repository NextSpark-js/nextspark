/**
 * Whether nextspark_app can use the privileges of `authenticated`. Every policy is written TO authenticated, so a
 * nextspark_app that is not a member (migration 022 skips the GRANT when the migration role has no CREATEROLE) gets none
 * of them: /api/v1/users/me answers 404 USER_NOT_FOUND, lists come back empty and api_audit_log writes fail with 42501.
 * `nextspark doctor` runs this file. It only reads pg_roles; any role can run it.
 *
 *   node check-app-role.mjs   (DATABASE_URL in the environment)
 *   first line: the report; when the membership is missing, the second line is the statement for a superuser.
 *   exit 0: member, or there is no nextspark_app (no cutover yet); 1: not a member; 2: no DATABASE_URL or the database could not be read.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { scriptClient } from './ssl-config.mjs'

export const APP_ROLE_SQL = `
  SELECT a.oid IS NOT NULL AS "hasAppRole", u.oid IS NOT NULL AS "hasAuthenticated",
         CASE WHEN a.oid IS NOT NULL AND u.oid IS NOT NULL THEN pg_has_role(a.oid, u.oid, 'USAGE') END AS usage,
         CASE WHEN a.oid IS NOT NULL AND u.oid IS NOT NULL THEN pg_has_role(a.oid, u.oid, 'MEMBER') END AS member,
         current_setting('server_version_num')::int AS version
  FROM (SELECT 1) one
  LEFT JOIN pg_roles a ON a.rolname = 'nextspark_app'
  LEFT JOIN pg_roles u ON u.rolname = 'authenticated'`

/** { status: 'ok' | 'missing', message, fix? } for the row of APP_ROLE_SQL. */
export function appRoleReport(row) {
  if (!row.hasAppRole) return { status: 'ok', message: 'No nextspark_app role: the runtime cutover has not been made, nothing to check' }
  if (!row.hasAuthenticated) return { status: 'ok', message: 'No authenticated role: run `pnpm db:migrate`' }
  if (row.usage) return { status: 'ok', message: 'nextspark_app inherits the policies of authenticated' }
  // from PostgreSQL 16 the INHERIT option belongs to the membership; before, to the role
  const fix = row.version >= 160000
    ? 'GRANT authenticated TO nextspark_app WITH INHERIT TRUE;'
    : row.member ? 'ALTER ROLE nextspark_app INHERIT;' : 'GRANT authenticated TO nextspark_app;'
  return {
    status: 'missing',
    message: `nextspark_app is not a member of authenticated that inherits it: the policies written TO authenticated do not apply to it (users/me answers 404 USER_NOT_FOUND, lists come back empty, api_audit_log writes fail with 42501)`,
    fix,
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('DATABASE_URL is not set')
    return 2
  }
  const client = scriptClient(url, { connectionTimeoutMillis: 10000 })
  try {
    await client.connect()
    const report = appRoleReport((await client.query(APP_ROLE_SQL)).rows[0])
    console.log(report.message)
    if (report.fix) console.log(report.fix)
    return report.status === 'ok' ? 0 : 1
  } catch (error) {
    // never the URL: it holds the password
    console.log(`Could not read the roles: ${error.message}`)
    return 2
  } finally {
    await client.end().catch(() => {})
  }
}

// run directly, also through a symlink (a project's node_modules/@nextsparkjs/core under pnpm)
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = await main()
}
