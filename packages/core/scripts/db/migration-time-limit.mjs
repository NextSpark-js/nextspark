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
// A file has to leave its session outside a transaction, with or without a
// limit. Recording it goes on the same session, so a record sent while the file
// still has a transaction open would go inside that transaction, and be undone
// with it when the connection closes. A file that ends inside a transaction it
// opened and did not close, or fails inside one, has that transaction rolled
// back before anything is recorded, and fails with an error that says its
// transactional changes are undone. Effects that are not transactional, such as
// a sequence a statement inside it advanced with nextval or set with setval,
// are not: a ROLLBACK leaves them as the file left them. Where the file left
// the session is the transaction status the server sends with the answer to
// the file: BEGIN sets it whether or not the transaction has written anything.
//
// A file that leaves a transaction prepared with PREPARE TRANSACTION, rather
// than committed or rolled back, ends its session outside a transaction too, so
// none of the above notices it: the prepared transaction stays on the server,
// neither applied nor undone, until something issues COMMIT PREPARED or
// ROLLBACK PREPARED for it.
//
// What tells the file's prepared transactions apart is the id the file writes
// for each. Postgres takes that id only as a string constant, and runs PREPARE
// TRANSACTION only as a statement of the query itself: inside a DO block, a
// function, a procedure or an EXECUTE it refuses it. Before the file is sent,
// the constant of each PREPARE TRANSACTION statement at the top level of its
// text is picked out, skipping comments, quoted strings, quoted identifiers and
// dollar quotes, and Postgres decodes it on the file's session, under the
// session's standard_conforming_strings, which is what the file is read under.
// For each decoded id this database already lists, its identity -- transaction
// id and prepared timestamp -- is kept. Once the file has run, however it ended,
// this database's pg_prepared_xacts is read for every id the file writes,
// whoever owns the transaction: on the file's session when the server answered
// the file, and otherwise, or when that read fails, on a connection of its own.
// A transaction newly listed under one of those ids, or listed with an identity
// different from the one kept, is taken for the file's; one still listed with
// the same identity is not. A file that leaves one prepared is not recorded,
// and fails with an error naming each one and the command that resolves it;
// neither is run for it. When the ids cannot be decoded the file is not run,
// and when they cannot be read afterwards the error says so and names every id,
// since none can be ruled out.
//
// A transaction prepared under an id the file does not write, by another
// session or by one the file opens itself (through dblink, for instance), is
// not reported.
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
// prints that instead of calling the file failed.
//
// The limit holds whatever the database URL says. A URL that sets
// statement_timeout or query_timeout itself, `?statement_timeout=0` included,
// has the limit take the place of those parameters on every connection that runs
// under it (see connection-time-limits.mjs), and the runner says so before it
// starts. Without a limit the URL's parameters apply as pg reads them.

import pg from 'pg';
import { timeLimitedClient, timeLimitParametersIn } from './connection-time-limits.mjs';

const { Client, DatabaseError, escapeIdentifier, escapeLiteral } = pg;

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

/** The client migrations run on, under the limit when there is one. */
export function migrationClient(connectionString, limit) {
  return limit
    ? timeLimitedClient(connectionString, { connectMs: CONNECT_MS, statementMs: limit.statementMs, queryMs: limit.queryMs })
    : new Client({
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
  const ignored = timeLimitParametersIn(connectionString);
  if (ignored.length === 0) return null;
  return (
    `The database URL sets ${ignored.join(' and ')}, which migrations do not use: ` +
    `each one runs under ${TIME_LIMIT_VARIABLE} (${limit.seconds} s).`
  );
}

/** What a migration stopped partway leaves behind, and what to do before running the migrations again. */
function leftBehind({ stillRunning, prepared = NONE_PREPARED }) {
  const committed = stillRunning
    ? 'It may still be running there, and what it commits, with a COMMIT in the file or in a procedure it calls, stays in the database.'
    : `What it had ${mayLeavePrepared(prepared) ? 'neither committed nor left prepared' : 'not committed'} is gone, but what it committed ` +
      'before it was stopped, with a COMMIT in the file or in a procedure it calls, stays in the database.';
  return withSentences(
    `${committed} It is not recorded as run, so the next run starts the file over: ` +
      'undo those changes, or make the file safe to run again, before running the migrations again.',
    preparedSentences(prepared, { stillRunning })
  );
}

/**
 * The transaction status the server sends with the next ReadyForQuery on the
 * client's connection: 'I' idle, 'T' in a transaction, 'E' in a failed one. It
 * is null when the connection closes first. pg settles a query that fails as
 * soon as the error arrives, before that ReadyForQuery, so the status has to be
 * waited for; listening starts before the query is sent.
 */
function nextTransactionStatus(client) {
  const { connection } = client;
  if (!connection) return Promise.resolve(null);
  return new Promise(resolve => {
    const settle = status => {
      connection.off('readyForQuery', onReady);
      connection.off('end', onEnd);
      resolve(status);
    };
    const onReady = message => settle(message.status);
    const onEnd = () => settle(null);
    connection.on('readyForQuery', onReady);
    connection.on('end', onEnd);
  });
}

/**
 * Rolls back the transaction a migration file left its session in, open or
 * failed, as `status` says. Returns null when the file left none, and otherwise
 * how that transaction ends: rolled back here, or, when the ROLLBACK fails, when
 * the run stops and closes the connection.
 */
async function rollBackLeftTransaction(client, status) {
  if (status !== 'T' && status !== 'E') return null;
  try {
    await client.query('ROLLBACK');
    return 'that transaction was rolled back';
  } catch (error) {
    return `rolling that transaction back failed (${error.message}), and Postgres rolls it back when the run stops and closes the connection`;
  }
}

/**
 * Runs one migration file's SQL. When the limit or a statement cancellation
 * stops it, the error says which, whether its session on the server was ended,
 * and what the migration leaves behind; the runner prints it next to the file's
 * name. A file the server answers inside a transaction fails too, once that
 * transaction is rolled back, so it is never recorded as run. A file that
 * leaves prepared a transaction it names in PREPARE TRANSACTION fails too,
 * however it ended, naming it and how to resolve it; nothing resolves it here.
 */
export async function runMigrationSql(client, { sql, limit, connectionString }) {
  // Read before listening for the file's own ReadyForQuery: these queries' are answered, and consumed, first.
  const named = await transactionsTheFileNames(client, sql);
  const preparedNow = async ({ onSession }) =>
    named.length === 0 ? NONE_PREPARED : preparedLeft(named, { client, onSession, connectionString, limit });
  const sentAt = performance.now();
  const answered = nextTransactionStatus(client);
  let result;
  try {
    result = await client.query(sql);
  } catch (error) {
    const elapsedMs = performance.now() - sentAt;
    // Only an error the server sent comes with the status it answered the file with; a client that gave up has none coming
    const answeredByServer = error instanceof DatabaseError;
    const rolledBack = answeredByServer ? await rollBackLeftTransaction(client, await answered) : null;

    // The server cancelled a statement, which ends the file there
    if (limit && error.code === '57014') {
      const prepared = await preparedNow({ onSession: answeredByServer });
      const cancelled = `the server cancelled it after ${Math.floor(elapsedMs)} ms`;
      const stopped =
        elapsedMs < limit.statementMs
          ? `${cancelled}, before ${TIME_LIMIT_VARIABLE} (${limit.seconds} s) ran out`
          : `did not finish within ${limit.seconds} s (${TIME_LIMIT_VARIABLE}); ${cancelled}`;
      throw new Error(`${stopped}: ${error.message}. ${leftBehind({ stillRunning: false, prepared })}`);
    }

    if (!limit || error.message !== 'Query read timeout') {
      // Nothing but an answer from the server says the file is no longer running there
      const prepared = await preparedNow({ onSession: answeredByServer });
      throw failedInsideTransaction(error, rolledBack, prepared, { stillRunning: !answeredByServer });
    }

    // The limit has passed with no answer, and the statement may still be running
    // there. The client lets go of its connection first: a session the server
    // ends under a client still holding it surfaces as an unhandled 'error' event.
    const processID = client.processID;
    await client.end();
    const ended = await endSession(connectionString, processID, limit);
    const prepared = await preparedNow({ onSession: false });
    throw new Error(
      `did not finish within ${limit.seconds} s (${TIME_LIMIT_VARIABLE}); ` +
      (ended === true
        ? `its session on the server was ended. ${leftBehind({ stillRunning: false, prepared })}`
        : `its session on the server could not be ended: ${ended}. ${leftBehind({ stillRunning: true, prepared })}`)
    );
  }

  const rolledBack = await rollBackLeftTransaction(client, await answered);
  const prepared = await preparedNow({ onSession: true });
  if (rolledBack) {
    throw new Error(
      withSentences(
        `the file ends inside a transaction it opened and did not close; ${rolledBack}: ${TRANSACTIONAL_ONLY}, ` +
          'and it is not recorded as run, so the next run starts the file over. Anything it committed before opening that transaction ' +
          'stays in the database. Add the COMMIT the file is missing, and undo anything it committed or make the file safe to run again, ' +
          'before running the migrations again.',
        preparedSentences(prepared, { stillRunning: false })
      )
    );
  }
  if (prepared.unchecked !== undefined) {
    throw new Error(
      `the file ran to the end, and it is not recorded as run, so the next run starts the file over. ${preparedSentences(prepared, { stillRunning: false })}`
    );
  }
  if (prepared.left.length > 0) throw new Error(leftoverPreparedMessage(prepared.left));

  return result;
}

/** What a ROLLBACK does and does not undo, said as a clause: transactional changes, not effects such as a sequence. */
const TRANSACTIONAL_ONLY = 'its transactional changes inside it are undone, but effects that are not transactional, ' +
  'such as a sequence advanced with nextval or set with setval, are not';

/**
 * The error a file that failed fails with: the server's own, unless it failed
 * inside a transaction it had not closed, or there is something to say about the
 * transactions it names in PREPARE TRANSACTION. `stillRunning` when nothing says
 * the file is no longer running on the server.
 */
function failedInsideTransaction(error, rolledBack, prepared = NONE_PREPARED, { stillRunning = false } = {}) {
  const sentences = preparedSentences(prepared, { stillRunning });
  if (!rolledBack && !sentences) return error;
  const outcome = rolledBack
    ? `It failed inside a transaction it had not closed, and ${rolledBack}: ${TRANSACTIONAL_ONLY}. ` +
      'Anything it committed before opening that transaction stays in the database, and it is not recorded as run, so the next run ' +
      'starts the file over.'
    : 'It is not recorded as run, so the next run starts the file over.';
  return new Error(withSentences(`${error.message}. ${outcome}`, sentences), { cause: error });
}

/** How long a connection of the run's own, beside the migration's, waits to connect and for each answer. */
function sideConnectionWaitMs(limit) {
  return limit ? Math.min(5000, limit.statementMs) : 5000;
}

/** The outcome for a file that names no transaction in PREPARE TRANSACTION. */
const NONE_PREPARED = Object.freeze({ named: [], left: [], unlisted: [] });

/**
 * The distinct ids a file's top-level PREPARE TRANSACTION statements name, as
 * the server decodes them on the file's session, and each one's identity before
 * the file runs, or null when none is listed. The file is not run when they
 * cannot be read.
 */
async function transactionsTheFileNames(client, sql) {
  // A PREPARE keyword is these letters in a row: nothing in SQL stands for a keyword's letters
  if (!/prepare/i.test(sql)) return [];
  let constants = [];
  try {
    const setting = await client.query({ text: 'SHOW standard_conforming_strings', rowMode: 'array' });
    constants = preparedTransactionConstants(sql, { standardConformingStrings: setting.rows[0]?.[0] !== 'off' });
    if (constants.length === 0) return [];
    const rows = await preparedAmong(client, constants);
    const named = new Map();
    for (const [gid, listed, transaction, prepared] of rows) {
      if (!named.has(gid)) named.set(gid, [gid, listed === null ? null : [transaction, prepared]]);
    }
    return [...named.values()];
  } catch (error) {
    throw new Error(
      `the file was not run: reading the transaction ids its PREPARE TRANSACTION statements name` +
        `${constants.length > 0 ? ` (${constants.join(', ')})` : ''} failed: ${error.message}. It is not recorded as run.`,
      { cause: error }
    );
  }
}

/**
 * For each id constant, [the id it stands for, that id again when this database
 * lists a prepared transaction under it or null, its transaction id, and its
 * prepared timestamp]. The constants go into the statement as the file writes
 * them; the extended protocol holds it to a single statement.
 */
async function preparedAmong(client, constants) {
  const result = await client.query({
    text:
      `SELECT named.gid, listed.gid, listed.transaction, listed.prepared ` +
      `FROM (VALUES ${constants.map(constant => `(${constant})`).join(', ')}) AS named (gid) ` +
      'LEFT JOIN pg_catalog.pg_prepared_xacts AS listed ON listed.gid = named.gid AND listed.database = pg_catalog.current_database()',
    rowMode: 'array',
    queryMode: 'extended',
  });
  return result.rows;
}

/** Whether two snapshots identify the same row of pg_prepared_xacts. */
function samePreparedIdentity(before, after) {
  const sameValue = (left, right) =>
    left instanceof Date && right instanceof Date ? Object.is(left.getTime(), right.getTime()) : Object.is(left, right);
  return sameValue(before[0], after[0]) && sameValue(before[1], after[1]);
}

/**
 * Which of the ids `named` this database now lists under a new identity:
 * `left`; which it does not list, `unlisted`; or `unchecked`, why that could not
 * be read. It is read on the file's session when `onSession`, and otherwise, or
 * when that read fails, on a connection of its own.
 */
async function preparedLeft(named, { client, onSession, connectionString, limit }) {
  const gids = named.map(([gid]) => gid);
  const constants = gids.map(escapeLiteral);
  const outcome = rows => {
    const current = new Map(
      rows.map(([gid, listed, transaction, prepared]) => [gid, listed === null ? null : [transaction, prepared]])
    );
    const left = [];
    const unlisted = [];
    for (const [gid, before] of named) {
      const after = current.get(gid) ?? null;
      if (after === null) unlisted.push(gid);
      else if (before === null || !samePreparedIdentity(before, after)) left.push(gid);
    }
    return { named: gids, left, unlisted };
  };
  const unchecked = error => ({ named: gids, left: [], unlisted: [], unchecked: error.message });
  if (onSession) {
    try {
      return outcome(await preparedAmong(client, constants));
    } catch {
      // read on a connection of its own instead, which says why when it cannot either
    }
  }
  const waitMs = sideConnectionWaitMs(limit);
  const own = timeLimitedClient(connectionString, { connectMs: waitMs, statementMs: waitMs, queryMs: waitMs });
  try {
    await own.connect();
  } catch (error) {
    return unchecked(error);
  }
  try {
    return outcome(await preparedAmong(own, constants));
  } catch (error) {
    return unchecked(error);
  } finally {
    await own.end();
  }
}

/** Whether the file may have left a transaction prepared, as far as the outcome goes. */
function mayLeavePrepared({ left, unchecked }) {
  return left.length > 0 || unchecked !== undefined;
}

/** The text, followed by the sentences when there are any. */
function withSentences(text, sentences) {
  return sentences ? `${text} ${sentences}` : text;
}

/** Each id with the commands that resolve the transaction prepared under it. */
function resolvingEach(gids) {
  return gids
    .map(gid => {
      const literal = escapeLiteral(gid);
      return `${literal}: ROLLBACK PREPARED ${literal} undoes its transactional changes (not effects such as a sequence), ` +
        `COMMIT PREPARED ${literal} applies them`;
    })
    .join('; ');
}

/**
 * What an error says about the transactions a file names in PREPARE
 * TRANSACTION, or '' when there is nothing to say: the ones it leaves prepared,
 * the ones that could not be checked, and, while it may still be running, the
 * ones it has not prepared yet.
 */
function preparedSentences({ named, left, unlisted, unchecked }, { stillRunning }) {
  const theOnes = gids => (gids.length > 1 ? 'the transactions it names in PREPARE TRANSACTION' : 'the transaction it names in PREPARE TRANSACTION');
  const sentences = [];
  if (unchecked !== undefined) {
    sentences.push(
      `Whether it leaves prepared ${theOnes(named)} could not be checked (${unchecked}). ` +
        `${named.length > 1 ? 'For each one pg_prepared_xacts lists' : 'If pg_prepared_xacts lists it'}: ${resolvingEach(named)}.`
    );
  }
  if (left.length > 0) {
    const plural = left.length > 1;
    sentences.push(
      `It leaves ${plural ? 'transactions' : 'a transaction'} prepared, neither committed nor rolled back: ${resolvingEach(left)}. ` +
        `Resolve ${plural ? 'each one' : 'it'} before running the migrations again; nothing resolves ${plural ? 'them' : 'it'} on its own.`
    );
  }
  if (stillRunning && unlisted.length > 0) {
    sentences.push(
      `It may yet leave prepared ${theOnes(unlisted)}, which pg_prepared_xacts does not list yet. ` +
        `${unlisted.length > 1 ? 'For each one it comes to list' : 'Once it does'}: ${resolvingEach(unlisted)}.`
    );
  }
  return sentences.join(' ');
}

/** What the runner says about a file that ran to the end and leaves one or more transactions prepared, and how to resolve each. */
function leftoverPreparedMessage(gids) {
  const plural = gids.length > 1;
  return (
    `the file leaves ${plural ? 'transactions' : 'a transaction'} prepared, neither committed nor rolled back: ` +
    `${resolvingEach(gids)}. It is not recorded as run, so the next run starts the file over: resolve ` +
    `${plural ? 'each one' : 'it'} before running the migrations again. Nothing resolves it on its own.`
  );
}

const SPACE = /[ \t\n\r\f\v]/;
const HORIZONTAL_SPACE = /[ \t\f\v]/;
const NEWLINE = /[\n\r]/;
const IDENTIFIER_START = /[A-Za-z_-￿]/;
const IDENTIFIER_PART = /[A-Za-z0-9_$-￿]/;
const DOLLAR_QUOTE = /\$(?:[A-Za-z_-￿][A-Za-z0-9_-￿]*)?\$/y;

/**
 * The string constant of each PREPARE TRANSACTION statement at the top level
 * of a query string, as the string writes it: '…', E'…', U&'…' with the
 * UESCAPE clause after it, or a dollar-quoted string, together with the strings
 * a quote continues it into across a newline. The string is read as Postgres's
 * scanner reads it under the standard_conforming_strings given: -- and nested
 * block comments, quoted strings, quoted identifiers and dollar quotes are not
 * searched. A string or dollar quote that does not end is not a constant, and
 * the server refuses the query it is in.
 */
export function preparedTransactionConstants(sql, { standardConformingStrings = true } = {}) {
  const tokens = [];
  for (let start = afterSpace(sql, 0); start < sql.length; ) {
    const [kind, end] = tokenAt(sql, start, standardConformingStrings);
    tokens.push({ kind, start, end, word: kind === 'word' ? sql.slice(start, end).replace(/[A-Z]/g, letter => letter.toLowerCase()) : null });
    start = afterSpace(sql, end);
  }
  return tokens.flatMap((token, index) => {
    const startsStatement = index === 0 || tokens[index - 1].kind === ';';
    const constant = tokens[index + 2];
    return startsStatement && token.word === 'prepare' && tokens[index + 1]?.word === 'transaction' && constant?.kind === 'constant'
      ? [sql.slice(constant.start, constant.end)]
      : [];
  });
}

/** Where the whitespace and comments from `i` on end. */
function afterSpace(sql, i) {
  for (;;) {
    if (SPACE.test(sql.charAt(i))) i++;
    else if (sql.startsWith('--', i)) {
      while (i < sql.length && !NEWLINE.test(sql.charAt(i))) i++;
    } else if (sql.startsWith('/*', i)) {
      let depth = 0;
      do {
        if (sql.startsWith('/*', i)) {
          depth++;
          i += 2;
        } else if (sql.startsWith('*/', i)) {
          depth--;
          i += 2;
        } else i++;
      } while (depth > 0 && i < sql.length);
    } else return i;
  }
}

/**
 * The kind of the token that starts at `i`, and where it ends: 'word' for a
 * keyword or an unquoted identifier, 'constant' for a string constant PREPARE
 * TRANSACTION takes, ';', or 'other'. One that does not end runs to the end of
 * the string, as 'other'.
 */
function tokenAt(sql, i, standardConformingStrings) {
  const unended = ['other', sql.length];
  const quoted = (end, kind = 'constant') => (end === -1 ? unended : [kind, end]);
  const char = sql.charAt(i);
  if (char === "'") return quoted(quotedStringEnd(sql, i, { backslashes: !standardConformingStrings, doubled: true }));
  if (/^[eE]'/.test(sql.slice(i, i + 2))) return quoted(quotedStringEnd(sql, i + 1, { backslashes: true, doubled: true }));
  if (/^[uU]&'/.test(sql.slice(i, i + 3))) {
    const end = quotedStringEnd(sql, i + 2, { backslashes: false, doubled: true });
    return end === -1 ? unended : ['constant', withUnicodeEscapeClause(sql, end, standardConformingStrings)];
  }
  // bit strings, which PREPARE TRANSACTION does not take
  if (/^[bBxX]'/.test(sql.slice(i, i + 2))) return quoted(quotedStringEnd(sql, i + 1, { backslashes: false, doubled: false }), 'other');
  if (char === '"') return quoted(quotedIdentifierEnd(sql, i), 'other');
  if (/^[uU]&"/.test(sql.slice(i, i + 3))) return quoted(quotedIdentifierEnd(sql, i + 2), 'other');
  if (char === '$') {
    DOLLAR_QUOTE.lastIndex = i;
    const delimiter = DOLLAR_QUOTE.exec(sql)?.[0];
    if (delimiter) {
      const close = sql.indexOf(delimiter, i + delimiter.length);
      return close === -1 ? unended : ['constant', close + delimiter.length];
    }
  }
  if (IDENTIFIER_START.test(char)) {
    let end = i + 1;
    while (IDENTIFIER_PART.test(sql.charAt(end))) end++;
    return ['word', end];
  }
  if (/[0-9]/.test(char)) {
    let end = i + 1;
    while (/[0-9A-Za-z_.]/.test(sql.charAt(end))) end++;
    return ['other', end];
  }
  return [char === ';' ? ';' : 'other', i + 1];
}

/**
 * Where the quoted string whose opening quote is at `i` ends, including the
 * strings a quote continues it into, or -1 when it does not end. A backslash
 * escapes the character after it when `backslashes`, and two quotes stand for
 * one when `doubled`.
 */
function quotedStringEnd(sql, i, { backslashes, doubled }) {
  for (i++; i < sql.length; ) {
    const char = sql.charAt(i);
    if (backslashes && char === '\\') i += 2;
    else if (char !== "'") i++;
    else if (doubled && sql.charAt(i + 1) === "'") i += 2;
    else {
      const next = continuingQuote(sql, i + 1);
      if (next === -1) return i + 1;
      i = next + 1;
    }
  }
  return -1;
}

/**
 * Where the quote that continues a string whose closing quote is just before
 * `i` is, or -1 when none does: Postgres joins two strings when what separates
 * them is whitespace with at least one newline in it, and -- comments.
 */
function continuingQuote(sql, i) {
  let newline = false;
  for (;;) {
    const char = sql.charAt(i);
    if (NEWLINE.test(char)) {
      newline = true;
      i++;
    } else if (HORIZONTAL_SPACE.test(char)) i++;
    else if (sql.startsWith('--', i)) {
      while (i < sql.length && !NEWLINE.test(sql.charAt(i))) i++;
    } else return char === "'" && newline ? i : -1;
  }
}

/** Where the quoted identifier whose opening quote is at `i` ends, or -1 when it does not end. */
function quotedIdentifierEnd(sql, i) {
  for (i++; i < sql.length; i++) {
    if (sql.charAt(i) !== '"') continue;
    if (sql.charAt(i + 1) !== '"') return i + 1;
    i++;
  }
  return -1;
}

/** Where a U&'…' string that ends at `end` ends together with the UESCAPE clause that follows it, if one does. */
function withUnicodeEscapeClause(sql, end, standardConformingStrings) {
  const keyword = afterSpace(sql, end);
  if (sql.slice(keyword, keyword + 7).toLowerCase() !== 'uescape' || IDENTIFIER_PART.test(sql.charAt(keyword + 7))) return end;
  const [kind, clauseEnd] = tokenAt(sql, afterSpace(sql, keyword + 7), standardConformingStrings);
  return kind === 'constant' ? clauseEnd : end;
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
  const waitMs = sideConnectionWaitMs(limit);
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
