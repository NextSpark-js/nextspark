/**
 * Whether the role DATABASE_URL connects as is subject to row-level security. RLS is skipped for a superuser, for a
 * role with BYPASSRLS and for the owner of a table (unless the table has FORCE ROW LEVEL SECURITY), and the default
 * setup connects as the owner until the `nextspark_app` cutover (docs/10-backend/03-rls-policies.md).
 *
 * The same query and verdict live in scripts/db/check-rls-runtime.mjs, which `nextspark doctor` runs.
 */

export interface RlsRuntimeRow {
  role: string
  superuser: boolean
  bypassRls: boolean
  /** RLS-enabled tables of the current schema that the role owns, directly or through an inherited role, and that do not FORCE row-level security */
  ownedTables: number
  /** RLS-enabled tables in the current schema */
  rlsTables: number
}

export type RlsRuntimeVerdict = 'enforced' | 'bypassed' | 'unknown'

type Run = (sql: string) => Promise<{ rows: RlsRuntimeRow[] }>

export const RLS_RUNTIME_SQL = `
  SELECT r.rolname AS role, r.rolsuper AS superuser, r.rolbypassrls AS "bypassRls",
         count(c.oid) FILTER (WHERE pg_has_role(r.oid, c.relowner, 'USAGE') AND NOT c.relforcerowsecurity)::int AS "ownedTables",
         count(c.oid)::int AS "rlsTables"
  FROM pg_roles r
  LEFT JOIN pg_class c ON c.relkind IN ('r', 'p') AND c.relrowsecurity AND c.relnamespace = to_regnamespace(current_schema())
  WHERE r.rolname = current_user
  GROUP BY r.oid, r.rolname, r.rolsuper, r.rolbypassrls`

/** No RLS-enabled table means the migrations have not run: nothing to judge. */
export function rlsRuntimeVerdict(row: RlsRuntimeRow): RlsRuntimeVerdict {
  if (row.rlsTables === 0) return 'unknown'
  return row.superuser || row.bypassRls || row.ownedTables > 0 ? 'bypassed' : 'enforced'
}

export async function readRlsRuntime(run: Run): Promise<RlsRuntimeRow | null> {
  return (await run(RLS_RUNTIME_SQL)).rows[0] ?? null
}

export function rlsBypassReason(row: RlsRuntimeRow): string {
  return [
    row.superuser && 'is a superuser',
    row.bypassRls && 'has BYPASSRLS',
    row.ownedTables > 0 && `owns ${row.ownedTables} of the tables with row-level security`,
  ].filter(Boolean).join(', ')
}

// On globalThis: Next bundles this module separately for instrumentation and for the routes.
const WARNED = Symbol.for('nextspark.rlsBypassWarned')

/**
 * At production server start, one warning when the role of DATABASE_URL skips RLS. It only warns: it never throws,
 * and says nothing when there is no database, no permission to read the catalogs, or the role is subject to RLS.
 * register() does not await it, so it never delays the start. `run` is for tests; by default it uses the app pool.
 */
export async function logRlsBypassAtStartup(run?: Run, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const state = globalThis as Record<symbol, unknown>
  if (state[WARNED] || env.NODE_ENV !== 'production' || env.NEXT_PHASE === 'phase-production-build' || !env.DATABASE_URL) return
  state[WARNED] = true
  try {
    const query = run ?? ((sql: string) => import('./db').then(({ pool }) => pool.query(sql) as unknown as ReturnType<Run>))
    const row = await readRlsRuntime(query)
    if (!row || rlsRuntimeVerdict(row) !== 'bypassed') return
    console.warn(
      `[rls] The role DATABASE_URL connects as (${row.role}) ${rlsBypassReason(row)}, so row-level security is not applied ` +
        'to the application\'s queries. Connect as nextspark_app: see docs/10-backend/03-rls-policies.md ("Runtime role + cutover"), ' +
        'and check with `nextspark doctor`.'
    )
  } catch {
    // no database, or no read access to the catalogs: nothing to say
  }
}
