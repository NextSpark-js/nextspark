/**
 * The auth tables against the schema of the Better Auth line core pins. Better Auth
 * (1.7.3 and later) checks its tables when it starts and refuses every auth call,
 * getSession included, when one has a NOT NULL column without a default that it
 * never writes. This finds those columns first: `db:migrate` runs it after the
 * migrations, and `nextspark doctor` runs this file.
 *
 *   node check-auth-schema.mjs   (DATABASE_URL in the environment)
 *   exit 0: the schema matches; 1: it does not, and the report says what to change;
 *   2: no DATABASE_URL, or the database could not be read.
 */
import { pathToFileURL } from 'node:url'
import { scriptClient } from './ssl-config.mjs'

/** The tables core maps Better Auth's models to (lib/auth.ts), and the columns Better Auth writes in each. */
export const BETTER_AUTH_COLUMNS = {
  users: ['id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt', 'firstName', 'lastName', 'language', 'role'],
  session: ['id', 'expiresAt', 'token', 'createdAt', 'updatedAt', 'ipAddress', 'userAgent', 'userId'],
  account: [
    'id', 'accountId', 'providerId', 'userId', 'accessToken', 'refreshToken', 'idToken', 'accessTokenExpiresAt',
    'refreshTokenExpiresAt', 'scope', 'password', 'createdAt', 'updatedAt',
  ],
  verification: ['id', 'identifier', 'value', 'expiresAt', 'createdAt', 'updatedAt'],
}

/**
 * The NOT NULL columns without a default (or identity, or generation) that Better Auth never writes, in the auth
 * tables the connection's search_path finds, as Better Auth looks them up. A missing table is not reported.
 */
export async function authSchemaProblems(client) {
  const { rows } = await client.query(
    `SELECT t.name AS "table", a.attname AS "column"
     FROM unnest($1::text[]) AS t(name)
     JOIN pg_attribute a ON a.attrelid = to_regclass(quote_ident(t.name))
     WHERE a.attnum > 0 AND NOT a.attisdropped AND a.attnotnull AND NOT a.atthasdef
       AND a.attidentity = '' AND a.attgenerated = ''
     ORDER BY t.name, a.attnum`,
    [Object.keys(BETTER_AUTH_COLUMNS)],
  )
  return rows.filter(({ table, column }) => !BETTER_AUTH_COLUMNS[table].includes(column))
}

/** What to tell the project about the columns authSchemaProblems found. */
export function authSchemaReport(problems) {
  const lines = problems.map(({ table, column }) =>
    table === 'account' && column === 'issuer'
      ? '  - account.issuer: written by Better Auth 1.7.0-1.7.2 only. Migration 038_better_auth_account_identity.sql makes it nullable: run `pnpm db:migrate`.'
      : `  - ${table}."${column}": in a migration of your own, give it a default (ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT ...) or make it nullable (... DROP NOT NULL).`)
  return [
    'The auth tables have NOT NULL columns without a default that Better Auth never writes. Better Auth refuses every',
    'auth call (sign-in, sign-up, getSession) until they change:',
    ...lines,
  ].join('\n')
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
    const problems = await authSchemaProblems(client)
    console.log(problems.length ? authSchemaReport(problems) : 'The auth tables match Better Auth\'s schema')
    return problems.length ? 1 : 0
  } catch (error) {
    // never the URL: it holds the password
    console.log(`Could not read the auth tables: ${error.message}`)
    return 2
  } finally {
    await client.end().catch(() => {})
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main()
}
