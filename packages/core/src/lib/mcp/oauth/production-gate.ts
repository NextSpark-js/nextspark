/**
 * The database half of the production gate of MCP browser sign-in (#541): in production the authorization server
 * and the MCP endpoint serve no OAuth request while the role `DATABASE_URL` connects as skips row-level security,
 * unless the deployment accepts it (`MCP_OAUTH_ACCEPT_RISKS=rls-not-enforced`, see ./production-risks).
 *
 * Whether the role skips RLS is a fact of the database, read from its catalogs with the query `nextspark doctor`
 * and the start warning use (lib/rls-runtime). It cannot be known while `lib/auth` loads, which is when the
 * authorization server is configured, so it is asked on the requests instead: every endpoint of the authorization
 * server (the hook in ./consent-plugin), its discovery documents and the OAuth path of `/api/mcp`. A verdict is
 * kept for a minute and then read again; a failure to read it is not kept, and refuses that request.
 */
import { pool } from '../../db'
import { readRlsRuntime, rlsBypassReason, rlsRuntimeVerdict, type RlsRuntimeRow } from '../../rls-runtime'
import { ACCEPT_RISKS_VARIABLE, acceptedRisks, isProductionRuntime, sayOnce } from './production-risks'

type Run = (sql: string) => Promise<{ rows: RlsRuntimeRow[] }>

/** What a client is told. The reason is for the operator, in the server's log: it names a role of the database. */
export const NOT_AVAILABLE = 'MCP browser sign-in is not available on this server.'

/**
 * How long a verdict is gone by before the catalogs are read again. The role of a connection can change while the
 * process lives (`ALTER ROLE ... BYPASSRLS`, a table given another owner), in either direction: a verdict kept for
 * good would go on serving after the role stopped being subject to row-level security, and go on refusing after
 * it was fixed. A minute keeps the query off the requests and bounds both.
 */
export const GATE_RECHECK_MS = 60_000

// On globalThis: Next bundles this module separately for instrumentation and for the routes
const VERDICT = Symbol.for('nextspark.mcpOAuthDatabaseGate')
type Verdict = { refused: boolean; until: number }

/** Forgets the verdict of this process. For tests. */
export function resetProductionGate(): void {
  delete (globalThis as Record<symbol, unknown>)[VERDICT]
}

/**
 * Whether an OAuth request is refused by the gate: `false` when it may be served. Outside production it always
 * may. `run` and `now` are for tests; by default the query runs on the app pool, the connection the requests
 * themselves use.
 */
export async function mcpOAuthRefusedByGate(env: NodeJS.ProcessEnv = process.env, run?: Run, now: () => number = Date.now): Promise<boolean> {
  if (!isProductionRuntime(env)) return false
  const state = globalThis as Record<symbol, Verdict | undefined>
  const kept = state[VERDICT]
  if (kept && now() < kept.until) return kept.refused
  const keep = (refused: boolean): boolean => {
    state[VERDICT] = { refused, until: now() + GATE_RECHECK_MS }
    return refused
  }

  let row: RlsRuntimeRow | null
  try {
    row = await readRlsRuntime(run ?? (sql => pool.query(sql) as unknown as ReturnType<Run>))
  } catch {
    // Not kept: the next request asks again. Nothing of the error is logged, it can carry the connection string.
    console.error('[mcp:oauth] Could not read whether row-level security applies to the role of DATABASE_URL, so this OAuth request is refused.')
    return true
  }

  const verdict = row ? rlsRuntimeVerdict(row) : 'unknown'
  if (verdict === 'enforced') return keep(false)

  const accepted = acceptedRisks(env).has('rls-not-enforced')
  const why = verdict === 'bypassed' && row
    ? `the role DATABASE_URL connects as (${row.role}) ${rlsBypassReason(row)}, so row-level security is not applied to the application's queries`
    : 'no table with row-level security was found for the role of DATABASE_URL: the migrations have not run in this database'
  if (accepted) {
    sayOnce(
      'accepted:rls-not-enforced',
      `[mcp:oauth] MCP browser sign-in is running WITHOUT row-level security behind it: ${why}. Accepted by ${ACCEPT_RISKS_VARIABLE}=rls-not-enforced.`
    )
  } else {
    sayOnce(
      'refused:rls-not-enforced',
      `[mcp:oauth] MCP browser sign-in is built (features.mcpOAuth) and REFUSES every OAuth request: ${why}. Connect as nextspark_app (docs/10-backend/03-rls-policies.md, "Runtime role + cutover"; check with \`nextspark doctor\`), or accept this with ${ACCEPT_RISKS_VARIABLE}=rls-not-enforced.`
    )
  }
  return keep(!accepted)
}
