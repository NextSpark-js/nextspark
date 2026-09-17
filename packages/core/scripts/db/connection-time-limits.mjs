// Time limits on a pg connection that hold whatever the connection string says.
//
// pg reads a connection string's parameters over the options passed next to it,
// so a URL ending in `?statement_timeout=0&query_timeout=` would switch off both
// the server's limit and the client's. The client is therefore built exactly as
// pg builds one for the string, with no limits among the options, and the two
// limits are then set on the connection parameters pg resolved for it. Which of
// the string's parameters a client acts on, and which it ignores, is decided by
// the installed version of pg in the same way it would be without the limits;
// only the two limits differ. pg reads them from those parameters when it
// connects (statement_timeout, sent in the startup message) and each time it
// sends a query (query_timeout).
//
// Nothing else a connection brings along lifts the server's limit: the
// statement_timeout sent when connecting outranks one in
// `options=-c statement_timeout=…`, in PGOPTIONS, or set on the database or the
// role.

import pg from 'pg';
import { parseSSLConfig, stripSSLParams } from './ssl-config.mjs';

const { Client } = pg;

/** The connection-string parameters pg reads over the time limits given next to them. */
export const TIME_LIMIT_PARAMETERS = ['statement_timeout', 'query_timeout'];

/** How pg builds a client for the string, with the shared application SSL policy. */
function clientFor(connectionString, options = {}) {
  return new Client({
    ...options,
    connectionString: stripSSLParams(connectionString),
    ssl: parseSSLConfig(connectionString),
  });
}

/**
 * The time-limit parameters the connection string sets, as pg reads them: the
 * ones whose value stays the same whatever limit is passed next to the string.
 */
export function timeLimitParametersIn(connectionString) {
  const withLimits = limit => clientFor(connectionString, { statement_timeout: limit, query_timeout: limit }).connectionParameters;
  const one = withLimits(1);
  const two = withLimits(2);
  return TIME_LIMIT_PARAMETERS.filter(name => one[name] === two[name]);
}

/**
 * A client whose limits are the ones given: `connectMs` to connect,
 * `statementMs` for the server to cancel a statement, `queryMs` for the client
 * to give up on an answer. `database` connects to another database on the same
 * server, as whoever the connection string names.
 */
export function timeLimitedClient(connectionString, { connectMs, statementMs, queryMs }, { database } = {}) {
  const client = clientFor(connectionString, { connectionTimeoutMillis: connectMs });
  const parameters = client.connectionParameters;
  parameters.statement_timeout = statementMs;
  parameters.query_timeout = queryMs;
  if (database !== undefined) client.database = parameters.database = database;
  return client;
}
