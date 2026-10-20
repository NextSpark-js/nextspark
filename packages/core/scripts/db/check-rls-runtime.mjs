/**
 * Whether the role DATABASE_URL connects as is subject to row-level security: not a superuser, no BYPASSRLS, and not
 * the owner of the tables with RLS (unless they FORCE it). `nextspark doctor` runs this file; the same query and
 * verdict run at server start from src/lib/rls-runtime.ts.
 *
 *   node check-rls-runtime.mjs   (DATABASE_URL in the environment)
 *   exit 0: RLS applies; 1: the role skips it; 2: no DATABASE_URL, the database could not be read, or no table has RLS yet.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { scriptClient } from './ssl-config.mjs'

export const RLS_RUNTIME_SQL = `
  SELECT r.rolname AS role, r.rolsuper AS superuser, r.rolbypassrls AS "bypassRls",
         count(c.oid) FILTER (WHERE pg_has_role(r.oid, c.relowner, 'USAGE') AND NOT c.relforcerowsecurity)::int AS "ownedTables",
         count(c.oid)::int AS "rlsTables"
  FROM pg_roles r
  LEFT JOIN pg_class c ON c.relkind IN ('r', 'p') AND c.relrowsecurity AND c.relnamespace = to_regnamespace(current_schema())
  WHERE r.rolname = current_user
  GROUP BY r.oid, r.rolname, r.rolsuper, r.rolbypassrls`

export async function rlsRuntime(client) {
  return (await client.query(RLS_RUNTIME_SQL)).rows[0] ?? null
}

/** 'unknown' when no table has RLS yet (migrations not run) */
export function rlsRuntimeVerdict(row) {
  if (row.rlsTables === 0) return 'unknown'
  return row.superuser || row.bypassRls || row.ownedTables > 0 ? 'bypassed' : 'enforced'
}

export function rlsRuntimeReport(row) {
  const attributes = `role ${row.role}: superuser=${row.superuser}, bypassrls=${row.bypassRls}, owns ${row.ownedTables} of ${row.rlsTables} tables with RLS`
  const verdict = rlsRuntimeVerdict(row)
  if (verdict === 'unknown') return `No table has row-level security yet (${attributes}): run \`pnpm db:migrate\``
  return verdict === 'enforced'
    ? `Row-level security applies to the application's queries (${attributes})`
    : `Row-level security is NOT applied to the application's queries (${attributes})`
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
    const row = await rlsRuntime(client)
    if (!row) {
      console.log('Could not read the role from pg_roles')
      return 2
    }
    console.log(rlsRuntimeReport(row))
    return { enforced: 0, bypassed: 1, unknown: 2 }[rlsRuntimeVerdict(row)]
  } catch (error) {
    // never the URL: it holds the password
    console.log(`Could not read the role: ${error.message}`)
    return 2
  } finally {
    await client.end().catch(() => {})
  }
}

// run directly, also through a symlink (a project's node_modules/@nextsparkjs/core under pnpm)
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = await main()
}
