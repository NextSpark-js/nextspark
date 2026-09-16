// What db:verify-theme asks a Postgres server before it migrates anything.
//
// Every question has a time limit, not only the connection. A query that waits
// on a lock someone else holds on a catalog, or a server that stops answering
// once the connection is up, would otherwise leave the command waiting until
// something outside kills it, when what the command owes is a refusal. The
// limits hold whatever time limits the database URL sets (see
// connection-time-limits.mjs).

import { ROLES_SQL, DATABASES_SQL, MAINTENANCE_DATABASE } from './cluster-changes.mjs';
import { timeLimitedClient } from './connection-time-limits.mjs';

/**
 * How long each step may take. The server cancels a statement past
 * `statementMs`; `queryMs`, a little longer, is the client giving up on a
 * server that does not even answer that cancellation.
 */
export const TIMEOUTS = { connectMs: 10000, statementMs: 15000, queryMs: 20000 };

// Everything that can be created in a non-system schema: relations (tables,
// views, sequences, indexes), functions and standalone types. Objects that
// belong to an extension don't count, since the server's template database
// can bring extensions along. Functions and types count because the
// migrations' CREATE OR REPLACE would replace them without an error.
export const EXISTING_OBJECTS_SQL = `
  SELECT kind, name
    FROM (
      SELECT 'relation' AS kind, n.nspname || '.' || c.relname AS name, n.nspname,
             'pg_class'::regclass AS classid, c.oid AS objid
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      UNION ALL
      SELECT 'function', n.nspname || '.' || p.proname, n.nspname,
             'pg_proc'::regclass, p.oid
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      UNION ALL
      SELECT 'type', n.nspname || '.' || t.typname, n.nspname,
             'pg_type'::regclass, t.oid
        FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE t.typrelid = 0 AND t.typcategory <> 'A'
    ) objects
   WHERE nspname NOT IN ('pg_catalog', 'information_schema')
     AND nspname !~ '^pg_(toast|temp)'
     AND NOT EXISTS (
       SELECT 1 FROM pg_depend d
        WHERE d.classid = objects.classid AND d.objid = objects.objid AND d.deptype = 'e'
     )
   ORDER BY kind, name
   LIMIT 5
`;

export function connect(connectionString, timeouts = TIMEOUTS, target = {}) {
  return timeLimitedClient(connectionString, timeouts, target);
}

// `end()` drops the socket when a query is still active, so a connection whose
// query timed out closes instead of waiting for a server that is not answering.
async function withClient(connectionString, timeouts, work, target = {}) {
  const client = connect(connectionString, timeouts, target);
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** What the target database holds, and what the cluster around it shows. */
export function inspectTarget(connectionString, timeouts = TIMEOUTS) {
  return withClient(connectionString, timeouts, async client => {
    const [objects, roles, databases] = await Promise.all([
      client.query(EXISTING_OBJECTS_SQL),
      client.query(ROLES_SQL),
      client.query(DATABASES_SQL),
    ]);
    return { existingObjects: objects.rows, roles: roles.rows, databases: databases.rows };
  });
}

/**
 * What the maintenance database holds. A hosted Postgres keeps `postgres` for
 * connections that only need the server, and a project whose own schema lives
 * there looks, from the outside, like a server with nothing on it.
 *
 * The connection goes to the server and user the database URL names, as pg
 * reads them, with only the database changed. The target database is compared
 * the way pg resolves it too, so a URL with no database whose user is
 * `postgres` is already the maintenance database.
 *
 * A server that refuses the connection, or the query, or does not answer it in
 * time, is reported as unreachable rather than as empty: not being able to look
 * is what a managed cluster looks like, and reading it as "nothing there" is
 * how a run ends up creating cluster-wide roles on a server it was never
 * allowed to inspect.
 */
export async function inspectMaintenanceDatabase(databaseUrl, timeouts = TIMEOUTS) {
  if (connect(databaseUrl, timeouts).database === MAINTENANCE_DATABASE) return { objects: [] };
  try {
    const result = await withClient(
      databaseUrl,
      timeouts,
      client => client.query(EXISTING_OBJECTS_SQL),
      { database: MAINTENANCE_DATABASE }
    );
    return { objects: result.rows };
  } catch (error) {
    return { unreachable: true, reason: error.message };
  }
}
