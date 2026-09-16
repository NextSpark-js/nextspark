// The time a migration may run for, when whoever runs the migrations asks for
// a limit, and how a migration that runs past it is stopped.
//
// MIGRATION_TIMEOUT_SECONDS sets it. db:verify-theme always does: a migration
// that waits on a lock, loops, or talks to a server that stops answering would
// otherwise leave the command waiting until something outside kills it, and
// killing the command does not stop the statement on the server. db:migrate
// leaves it unset unless asked, since a real database can hold data a
// migration legitimately spends longer on.
//
// Each migration file gets the limit as a whole, and a file still running when
// the limit has passed fails:
//  - the client gives up on the file when the limit has passed since it sent
//    it. That holds for a server that does not answer at all, for a file of
//    several statements each shorter than the limit, and for a migration that
//    switches statement_timeout off, with SET, SET LOCAL or set_config(), for
//    itself or for the migrations after it. It then asks the server, over a
//    connection of its own that waits up to 5 s (less under a shorter limit),
//    to end the session the migration was running in, and the error says
//    whether it was ended. When it was not, the statement goes on running on
//    the server, stopped only by a statement_timeout the migration left on;
//  - the server's statement_timeout, set to the same limit, cancels a statement
//    that runs past it, including one waiting on a lock, even when the process
//    that sent it is no longer there to give up on it. Postgres 13 and later
//    apply it to each statement in a file, and a migration can switch it off.
// Whichever comes first ends the file. The client starts counting before the
// server does, so it is usually the client.
//
// The limit holds whatever the database URL says. A URL that sets
// statement_timeout or query_timeout itself, `?statement_timeout=0` included,
// has those parameters left out of every connection that runs under the limit
// (see connection-time-limits.mjs), and the runner says so before it starts.
// Without a limit the URL's parameters apply as pg reads them.

import pg from 'pg';
import { timeLimitedClient, connectionSettings } from './connection-time-limits.mjs';

const { Client } = pg;

const CONNECT_MS = 10000;

export const TIME_LIMIT_VARIABLE = 'MIGRATION_TIMEOUT_SECONDS';

/**
 * The limit MIGRATION_TIMEOUT_SECONDS asks for, or null when it is unset.
 * `statementMs` is the server's limit and `queryMs` the client's, and both are
 * the limit itself.
 */
export function migrationTimeLimit(env = process.env) {
  const value = env[TIME_LIMIT_VARIABLE];
  if (value === undefined || value === '') return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`${TIME_LIMIT_VARIABLE} must be a number of seconds greater than 0, not "${value}".`);
  }
  const limitMs = Math.ceil(seconds * 1000);
  return { seconds, statementMs: limitMs, queryMs: limitMs };
}

/** The client migrations run on, under the limit when there is one. */
export function migrationClient(connectionString, limit) {
  if (limit) {
    return timeLimitedClient(connectionString, { connectMs: CONNECT_MS, statementMs: limit.statementMs, queryMs: limit.queryMs });
  }
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false, require: true },
    connectionTimeoutMillis: CONNECT_MS,
  });
}

/**
 * What the runner says when the database URL carries time limits the migration
 * limit takes the place of, or null when it carries none or there is no limit.
 * The URL itself is never shown: it holds the password.
 */
export function ignoredParametersNotice(connectionString, limit) {
  if (!limit) return null;
  const { ignored } = connectionSettings(connectionString);
  if (ignored.length === 0) return null;
  return (
    `The database URL sets ${ignored.join(' and ')}, which migrations do not use: ` +
    `each one runs under ${TIME_LIMIT_VARIABLE} (${limit.seconds} s).`
  );
}

/**
 * Runs one migration file's SQL. Past the limit, the error says so and names
 * the limit, and the session the SQL was running in has been asked to end; the
 * runner prints it next to the file's name.
 */
export async function runMigrationSql(client, { sql, limit, connectionString }) {
  try {
    return await client.query(sql);
  } catch (error) {
    if (!limit) throw error;

    // statement_timeout: the server cancelled the statement and the session is idle again
    if (error.code === '57014') {
      throw new Error(`did not finish within ${limit.seconds} s (${TIME_LIMIT_VARIABLE}): ${error.message}`);
    }

    if (error.message !== 'Query read timeout') throw error;

    // The limit has passed with no answer, and the statement may still be running
    // there. The client lets go of its connection first: a session the server
    // ends under a client still holding it surfaces as an unhandled 'error' event.
    const processID = client.processID;
    await client.end();
    const ended = await endSession(connectionString, processID, limit);
    throw new Error(
      `did not finish within ${limit.seconds} s (${TIME_LIMIT_VARIABLE}); ` +
      (ended === true ? 'its session on the server was ended.' : `its session on the server could not be ended: ${ended}.`)
    );
  }
}

/**
 * Ends a backend from a separate connection. Returns true, or why it could not.
 * The connection is limited too: a server that did not answer the migration may
 * not answer this either.
 */
async function endSession(connectionString, processID, limit) {
  if (!Number.isInteger(processID)) return 'the server never said which session it was';
  const waitMs = Math.min(5000, limit.statementMs);
  const admin = timeLimitedClient(connectionString, { connectMs: waitMs, statementMs: waitMs, queryMs: waitMs });
  try {
    await admin.connect();
  } catch (error) {
    return error.message;
  }
  try {
    await admin.query(`SELECT pg_terminate_backend(${processID})`);
    return true;
  } catch (error) {
    return error.message;
  } finally {
    await admin.end();
  }
}
