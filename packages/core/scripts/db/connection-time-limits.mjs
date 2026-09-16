// Time limits on a pg connection that hold whatever the connection string says.
//
// pg reads a connection string's parameters over the options passed next to it,
// so a URL ending in `?statement_timeout=0&query_timeout=` would switch off both
// the server's limit and the client's. The connection string is therefore not
// handed to pg as a string: the parser pg itself loads reads it, the two
// parameters are taken out of what that parser returns, and the client is built
// from the rest. Where the connection goes, and as whom, is decided by the same
// code that decides it for pg, on the string exactly as it was given.
//
// Nothing else a connection brings along lifts the server's limit: the
// statement_timeout sent when connecting outranks one in
// `options=-c statement_timeout=…`, in PGOPTIONS, or set on the database or the
// role.

import { createRequire } from 'node:module';
import pg from 'pg';

const { Client } = pg;

// The copy of pg-connection-string that pg requires, resolved from pg's own location.
const require = createRequire(import.meta.url);
const { parse } = createRequire(require.resolve('pg'))('pg-connection-string');

/** The connection-string parameters pg reads over the time limits given next to them. */
export const TIME_LIMIT_PARAMETERS = ['statement_timeout', 'query_timeout'];

/**
 * Names pg's Client acts on only when they come in the options it is
 * constructed with, and `connectionString`, which it would parse again. When pg
 * parses a connection string with a parameter of one of these names, the client
 * connects and queries as if it were not there, so it is left out here too.
 */
const CLIENT_OPTIONS = [
  'connectionString',
  'Promise',
  'types',
  'enableChannelBinding',
  'connection',
  'stream',
  'keepAlive',
  'keepAliveInitialDelayMillis',
  'binary',
  'connectionTimeoutMillis',
];

/**
 * What pg reads from a connection string, without its time-limit parameters,
 * and the names of the ones it carried.
 */
export function connectionSettings(connectionString) {
  const parsed = parse(connectionString);
  return {
    settings: Object.fromEntries(
      Object.entries(parsed).filter(([name]) => !TIME_LIMIT_PARAMETERS.includes(name) && !CLIENT_OPTIONS.includes(name))
    ),
    ignored: TIME_LIMIT_PARAMETERS.filter(name => Object.hasOwn(parsed, name)),
  };
}

/**
 * A client whose limits are the ones given: `connectMs` to connect,
 * `statementMs` for the server to cancel a statement, `queryMs` for the client
 * to give up on an answer. `database` connects to another database on the same
 * server, as whoever the connection string names.
 */
export function timeLimitedClient(connectionString, { connectMs, statementMs, queryMs }, { database } = {}) {
  return new Client({
    ssl: { rejectUnauthorized: false, require: true },
    ...connectionSettings(connectionString).settings,
    ...(database === undefined ? {} : { database }),
    connectionTimeoutMillis: connectMs,
    statement_timeout: statementMs,
    query_timeout: queryMs,
  });
}
