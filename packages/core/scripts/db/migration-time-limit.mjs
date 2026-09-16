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
// When the server cancels a statement, the error says after how long, and the
// server's reason. The time alone does not say what cancelled it: a
// statement_timeout the migration sets for itself, or a cancellation from
// another session, can come at any moment. It does rule out the limit when the
// cancellation comes sooner than the limit after the file was sent, since the
// server starts counting only once a statement has reached it, and the error
// then says the limit had not run out.
//
// A migration stopped either way is not recorded as run, and the next run starts
// the file over. Postgres keeps nothing the migration had not committed, but
// what it committed before it was stopped, with a COMMIT in the file or in a
// procedure it calls, stays; the error says so, and what to do about it.
//
// The limit is for the file, not for recording it as run. A migration that ran
// to the end is recorded in its tracking table on the same session, and under a
// limit the record gets RECORD_WAIT_MS instead, whatever the limit: on the
// server as a SET LOCAL statement_timeout sent with the INSERT, together with
// lock_timeout off (on Postgres 13 and later both hold for the INSERT whatever
// the limit or the migration left on the session), and on the client as the
// wait for the answer. A tracking table another session holds a lock on is
// waited for up to then, and a server that stops answering is given up on then.
// When the record fails, however it fails, the error says the file ran to the
// end and is not recorded, and gives the INSERT that records it; the runner
// prints that instead of calling the file failed. A file that ran to the end
// inside a transaction it left open has nothing to record: that transaction is
// rolled back when the run stops, so the error says to add the COMMIT instead.
//
// The limit holds whatever the database URL says. A URL that sets
// statement_timeout or query_timeout itself, `?statement_timeout=0` included,
// has the limit take the place of those parameters on every connection that runs
// under it (see connection-time-limits.mjs), and the runner says so before it
// starts. Without a limit the URL's parameters apply as pg reads them.

import pg from 'pg';
import { timeLimitedClient, timeLimitParametersIn } from './connection-time-limits.mjs';

const { Client, escapeIdentifier, escapeLiteral } = pg;

const CONNECT_MS = 10000;

export const TIME_LIMIT_VARIABLE = 'MIGRATION_TIMEOUT_SECONDS';

/** How long recording a migration that ran to the end may take, under a limit. */
export const RECORD_WAIT_MS = 60000;

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

/**
 * The transaction status the server last reported to each migration client, as
 * its ReadyForQuery message carries it: 'I' idle, 'T' in a transaction, 'E' in a
 * failed one.
 */
const transactionStatus = new WeakMap();

/** The client migrations run on, under the limit when there is one. */
export function migrationClient(connectionString, limit) {
  const client = limit
    ? timeLimitedClient(connectionString, { connectMs: CONNECT_MS, statementMs: limit.statementMs, queryMs: limit.queryMs })
    : new Client({
        connectionString,
        ssl: { rejectUnauthorized: false, require: true },
        connectionTimeoutMillis: CONNECT_MS,
      });
  client.connection.on('readyForQuery', message => transactionStatus.set(client, message.status));
  return client;
}

/**
 * What the runner says when the database URL carries time limits the migration
 * limit takes the place of, or null when it carries none or there is no limit.
 * The URL itself is never shown: it holds the password.
 */
export function ignoredParametersNotice(connectionString, limit) {
  if (!limit) return null;
  const ignored = timeLimitParametersIn(connectionString);
  if (ignored.length === 0) return null;
  return (
    `The database URL sets ${ignored.join(' and ')}, which migrations do not use: ` +
    `each one runs under ${TIME_LIMIT_VARIABLE} (${limit.seconds} s).`
  );
}

/** What a migration stopped partway leaves behind, and what to do before running the migrations again. */
function leftBehind({ stillRunning }) {
  const committed = stillRunning
    ? 'It may still be running there, and what it commits, with a COMMIT in the file or in a procedure it calls, stays in the database.'
    : 'What it had not committed is gone, but what it committed before it was stopped, with a COMMIT in the file or in a procedure it calls, stays in the database.';
  return (
    `${committed} It is not recorded as run, so the next run starts the file over: ` +
    'undo those changes, or make the file safe to run again, before running the migrations again.'
  );
}

/**
 * Runs one migration file's SQL. When the limit or a statement cancellation
 * stops it, the error says which, whether its session on the server was ended,
 * and what the migration leaves behind; the runner prints it next to the file's
 * name.
 */
export async function runMigrationSql(client, { sql, limit, connectionString }) {
  const sentAt = performance.now();
  try {
    return await client.query(sql);
  } catch (error) {
    if (!limit) throw error;

    // The server cancelled a statement, and the session is idle again or in a transaction that can only roll back
    if (error.code === '57014') {
      const elapsedMs = performance.now() - sentAt;
      const cancelled = `the server cancelled it after ${Math.floor(elapsedMs)} ms`;
      const stopped =
        elapsedMs < limit.statementMs
          ? `${cancelled}, before ${TIME_LIMIT_VARIABLE} (${limit.seconds} s) ran out`
          : `did not finish within ${limit.seconds} s (${TIME_LIMIT_VARIABLE}); ${cancelled}`;
      throw new Error(`${stopped}: ${error.message}. ${leftBehind({ stillRunning: false })}`);
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
      (ended === true
        ? `its session on the server was ended. ${leftBehind({ stillRunning: false })}`
        : `its session on the server could not be ended: ${ended}. ${leftBehind({ stillRunning: true })}`)
    );
  }
}

/** A migration that ran to the end and could not be recorded as run. */
export class MigrationNotRecordedError extends Error {}

/**
 * Records a migration that ran to the end as the row given (column → value) of
 * its tracking table. Under a limit, the record waits up to `waitMs` on the
 * server and on the client, not the limit. Throws MigrationNotRecordedError when
 * it fails, with the INSERT that records it; that INSERT does nothing when the
 * row is already there, since a record whose answer never came may have been
 * written.
 */
export async function recordMigration(client, { file, table, row, limit, waitMs = RECORD_WAIT_MS }) {
  const insert =
    `INSERT INTO ${escapeIdentifier(table)} (${Object.keys(row).map(escapeIdentifier).join(', ')}) ` +
    `VALUES (${Object.values(row).map(escapeLiteral).join(', ')})`;
  const leftOpen = transactionStatus.get(client) === 'T';
  try {
    if (limit) {
      await client.query({
        text: `SET LOCAL statement_timeout = ${waitMs}; SET LOCAL lock_timeout = 0; ${insert}`,
        query_timeout: waitMs,
      });
    } else {
      await client.query(insert);
    }
  } catch (error) {
    const recording = `recording it as run in ${escapeIdentifier(table)}`;
    const outcome =
      error.message === 'Query read timeout'
        ? `${recording} got no answer within ${waitMs / 1000} s, so it may or may not be recorded`
        : `${recording} failed: ${error.message}`;
    if (leftOpen) {
      throw new MigrationNotRecordedError(
        `${file} ran to the end inside a transaction it left open, and ${outcome}. ` +
        'That transaction is rolled back when the run stops: what the file did inside it is gone, what it committed ' +
        'before stays, and it is not recorded as run, so the next run starts the file over. Add the COMMIT the file ' +
        'is missing, and undo what it committed or make the file safe to run again, before running the migrations again.'
      );
    }
    throw new MigrationNotRecordedError(
      `${file} ran to the end, but ${outcome}. ` +
      'What it committed stays in the database, and until it is recorded the next run starts the file over. ' +
      `Record it before running the migrations again: ${insert} ON CONFLICT DO NOTHING;`
    );
  }
}

/** The line the runner prints for a migration that failed. */
export function migrationFailure(file, error) {
  return error instanceof MigrationNotRecordedError ? error.message : `Failed to execute ${file}: ${error.message}`;
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
