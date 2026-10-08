import { Pool, type PoolClient, type PoolConfig } from 'pg';

/**
 * The one place core's runtime pg pools get their resilience options, so the app pool, the service pool and the
 * Better Auth pool cannot drift. Idle connections on Neon, Supabase poolers and behind NAT/load balancers are dropped
 * silently; without these options the next query waits for the OS TCP timeout (minutes) on a dead socket, and the
 * socket error on an idle client surfaces as an `uncaughtException`.
 */

/** Far below the idle cutoffs seen in practice (Azure LB 4 min, AWS NLB 350 s, NAT tables 60 s and up): an idle client is closed by us long before a provider drops it, at the cost of an occasional reconnect. */
export const POOL_IDLE_TIMEOUT_MS = 10_000;
export const POOL_CONNECTION_TIMEOUT_MS = 10_000;
/** First TCP keep-alive probe 10 s after the socket goes quiet; how soon a dead peer is detected after that depends on the OS. */
export const POOL_KEEP_ALIVE_DELAY_MS = 10_000;
/** Default for DB_QUERY_TIMEOUT_MS: long enough for a heavy report, short of the minutes a dead socket takes to fail. */
export const DEFAULT_QUERY_TIMEOUT_MS = 60_000;

/**
 * A timeout in milliseconds from the environment. Unset or empty gives `fallback`; `0` gives `undefined` (no limit);
 * anything that is not a non-negative integer warns once and gives `fallback`.
 */
export function parseTimeoutMs(name: string, raw: string | undefined, fallback: number | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    console.warn(`[DB] Ignoring ${name}="${raw}": expected a non-negative integer of milliseconds (0 disables).`);
    return fallback;
  }
  return value === 0 ? undefined : value;
}

/**
 * DB_QUERY_TIMEOUT_MS (default 60000): the client gives up on a query that has no answer after this long. It works on
 * every provider, pooled or not, and is what fails a query on a dead socket. 0 disables it.
 * DB_STATEMENT_TIMEOUT_MS (default unset): also asks the server to cancel a statement after this long. Opt-in because
 * the limit travels as a connection startup parameter, which a transaction pooler can reject (PgBouncer) or silently drop
 * (Neon: the setting stays 0, pooled or direct). Behind those use DB_QUERY_TIMEOUT_MS or ALTER ROLE ... SET statement_timeout.
 */
export function poolTimeouts(env: NodeJS.ProcessEnv = process.env): Pick<PoolConfig, 'query_timeout' | 'statement_timeout'> {
  return {
    query_timeout: parseTimeoutMs('DB_QUERY_TIMEOUT_MS', env.DB_QUERY_TIMEOUT_MS, DEFAULT_QUERY_TIMEOUT_MS),
    statement_timeout: parseTimeoutMs('DB_STATEMENT_TIMEOUT_MS', env.DB_STATEMENT_TIMEOUT_MS, undefined),
  };
}

/** What is safe to log about a pool error: its code or class, never the message (it can carry hosts, users or databases). */
export function describePoolError(err: unknown): string {
  const e = err as { code?: unknown; name?: unknown } | null | undefined;
  return String(e?.code ?? e?.name ?? 'unknown');
}

const QUERY_TIMEOUT_MESSAGE = 'Query read timeout';

/**
 * pg's client-side timeout rejects the query but leaves it running on the socket, and pg-pool still takes the client
 * back on release(): the next user would queue behind it, or reuse a transaction left open. Destroy the socket, so
 * the pool discards the client; this also frees every user of the pool, not only pool.query().
 */
function dropOnQueryTimeout(client: PoolClient): void {
  const query = client.query.bind(client) as (...args: unknown[]) => unknown;
  const drop = (err: unknown) => {
    if ((err as Error | null | undefined)?.message === QUERY_TIMEOUT_MESSAGE) {
      // pg only learns the socket is gone on a later tick; pg-pool drops a non-queryable client on release(), even in this tick
      (client as unknown as { _queryable: boolean })._queryable = false;
      (client as unknown as { connection?: { stream?: { destroy(): void } } }).connection?.stream?.destroy();
    }
  };
  (client as unknown as { query: (...args: unknown[]) => unknown }).query = (...args) => {
    const last = args[args.length - 1];
    if (typeof last === 'function') {
      args[args.length - 1] = (err: unknown, ...rest: unknown[]) => { drop(err); last(err, ...rest); };
    }
    const result = query(...args) as { catch?: (fn: (err: unknown) => void) => unknown } | undefined;
    // registered before the caller awaits, so the socket is gone before its catch block runs
    if (typeof result?.catch === 'function') result.catch(drop);
    return result;
  };
}

/** A Pool with core's keep-alive, timeouts and error handling on top of `config`; `label` says which pool in the log. */
export function createPool(label: string, config: PoolConfig): Pool {
  const pool = new Pool({
    max: 20,
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
    keepAlive: true,
    keepAliveInitialDelayMillis: POOL_KEEP_ALIVE_DELAY_MS,
    ...poolTimeouts(),
    ...config,
  });
  // A client emits 'error' when its socket dies, idle or checked out; unhandled, that is an uncaughtException.
  // pg-pool drops the idle listener on checkout, so the listener lives on the client itself and logs for both cases.
  pool.on('connect', (client) => {
    dropOnQueryTimeout(client);
    client.on('error', (err) => console.warn(`[DB] ${label} pool: client error (${describePoolError(err)}); connection dropped.`));
  });
  // The pool re-emits an idle client's error; the client listener above already logged it. Needed so it is not thrown.
  pool.on('error', () => {});
  return pool;
}
