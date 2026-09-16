// Time limits on a pg connection that hold whatever the connection string says.
//
// pg reads a connection string's parameters over the options passed next to it,
// so a URL ending in `?statement_timeout=0&query_timeout=` would switch off both
// the server's limit and the client's. Those two parameters are taken out of the
// connection string before pg reads it. Nothing else a connection brings along
// lifts the server's limit: the statement_timeout sent when connecting outranks
// one in `options=-c statement_timeout=…`, in PGOPTIONS, or set on the database
// or the role.

import pg from 'pg';

const { Client } = pg;

/** The connection-string parameters pg reads over the time limits given next to them. */
export const TIME_LIMIT_PARAMETERS = ['statement_timeout', 'query_timeout'];

/**
 * The connection string without its time-limit parameters, and the names of the
 * ones it carried.
 *
 * The parameters are found the way pg finds them, through the URL parser: the
 * query runs from the first `?` to a `#`, a name is percent-decoded with `+` as
 * a space, and tabs and newlines are dropped from the string first. A Unix
 * socket written as `/dir database` has no parameters. Everything else is kept
 * as written, the `?` included: a string that is only a query still names the
 * host pg resolves it against.
 */
export function withoutTimeLimitParameters(connectionString) {
  const unchanged = { connectionString, ignored: [] };
  if (connectionString.startsWith('/')) return unchanged;

  const url = connectionString.replace(/[\t\n\r]/g, '');
  const queryStart = url.indexOf('?');
  const fragmentStart = url.indexOf('#');
  if (queryStart === -1 || (fragmentStart !== -1 && fragmentStart < queryStart)) return unchanged;
  const queryEnd = fragmentStart === -1 ? url.length : fragmentStart;

  const found = new Set();
  const kept = url
    .slice(queryStart + 1, queryEnd)
    .split('&')
    .filter(pair => {
      const [name] = new URLSearchParams(pair).keys();
      if (!TIME_LIMIT_PARAMETERS.includes(name)) return true;
      found.add(name);
      return false;
    });
  if (found.size === 0) return unchanged;

  return {
    connectionString: `${url.slice(0, queryStart)}?${kept.join('&')}${url.slice(queryEnd)}`,
    ignored: TIME_LIMIT_PARAMETERS.filter(name => found.has(name)),
  };
}

/**
 * A client whose limits are the ones given: `connectMs` to connect,
 * `statementMs` for the server to cancel a statement, `queryMs` for the client
 * to give up on an answer.
 */
export function timeLimitedClient(connectionString, { connectMs, statementMs, queryMs }) {
  return new Client({
    connectionString: withoutTimeLimitParameters(connectionString).connectionString,
    ssl: { rejectUnauthorized: false, require: true },
    connectionTimeoutMillis: connectMs,
    statement_timeout: statementMs,
    query_timeout: queryMs,
  });
}
