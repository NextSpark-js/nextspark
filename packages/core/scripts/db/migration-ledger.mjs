// What the ledgers (`_migrations`, `_content_migrations`, `_entity_migrations`) remember about a migration
// beyond its name (#428): a hash of the file as it ran. A run compares it with the file on disk and says
// when an applied migration was edited, because the ledgers record a file by name and never run it again, so
// the edit reaches databases created afterwards and none that ran the earlier version. It also finds the
// rename: a recorded name that is no longer on disk, next to an unrecorded file with the same content, which
// the runner would apply a second time.
//
// A row without a hash (every ledger before this) is not compared: its hash is filled in from the file on
// disk the first time, which trusts that file to be the one that ran.

import { createHash } from 'node:crypto';
import pg from 'pg';
const { escapeIdentifier, escapeLiteral } = pg;

export const HASH_COLUMN = 'content_hash';

/** The three ledgers, and the columns that identify a migration in each (the last one is always the file name). */
export const LEDGERS = [
  { table: '_migrations', keys: ['filename'] },
  { table: '_content_migrations', keys: ['source_type', 'source_name', 'filename'] },
  { table: '_entity_migrations', keys: ['entity_name', 'filename'] },
];

/** The hash of a migration file. Line endings are not part of it: a checkout that converts them is not an edit. */
export function migrationHash(sql) {
  return createHash('sha256').update(sql.replace(/\r\n?/g, '\n')).digest('hex');
}

/** The migrations on disk, as the rows of each ledger would name them: `{ <ledger table>: [{ ...keys, hash }] }`. */
export function ledgerFiles({ core, migrations }) {
  return {
    _migrations: core.map(({ filename, hash }) => ({ filename, hash })),
    _content_migrations: migrations.allContentMigrations.map(m => ({ source_type: m.sourceType, source_name: m.sourceName, filename: m.filename, hash: m.hash })),
    _entity_migrations: migrations.allEntityMigrations.map(m => ({ entity_name: m.entityName, filename: m.filename, hash: m.hash })),
  };
}

const identity = (ledger, item) => ledger.keys.map(key => item[key]).join('\0');
const scopeOf = (ledger, item) => ledger.keys.slice(0, -1).map(key => item[key]).join('\0');

/**
 * Compares the rows of a ledger (`{ ...keys, content_hash }`) with the files on disk (`{ ...keys, hash }`):
 *  - `edited`: a recorded file whose hash differs from the one recorded;
 *  - `renamed`: a recorded name with no file, and a file with no record in the same scope whose hash is the
 *    recorded one (each file is matched once);
 *  - `unhashed`: a recorded file whose row has no hash yet.
 */
export function compareLedger(ledger, rows, files) {
  const onDisk = new Map(files.map(file => [identity(ledger, file), file]));
  const recorded = new Set(rows.map(row => identity(ledger, row)));
  const edited = [];
  const unhashed = [];
  for (const row of rows) {
    const file = onDisk.get(identity(ledger, row));
    if (!file) continue;
    if (row.content_hash == null) unhashed.push({ row, file });
    else if (row.content_hash !== file.hash) edited.push({ row, file });
  }
  const unrecorded = files.filter(file => !recorded.has(identity(ledger, file)));
  const renamed = [];
  for (const row of rows) {
    if (onDisk.has(identity(ledger, row)) || row.content_hash == null) continue;
    const at = unrecorded.findIndex(file => scopeOf(ledger, file) === scopeOf(ledger, row) && file.hash === row.content_hash);
    if (at >= 0) renamed.push({ row, file: unrecorded.splice(at, 1)[0] });
  }
  return { edited, renamed, unhashed };
}

/** Whether a ledger table exists, and has the hash column. */
async function ledgerState(client, table) {
  const { rows } = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS "exists",
            EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass($1) AND attname = $2 AND NOT attisdropped) AS "hashed"`,
    [escapeIdentifier(table), HASH_COLUMN]
  );
  return rows[0];
}

/**
 * Adds the hash column to the ledgers that exist without it. A ledger whose column cannot be added (the role
 * does not own the table) is listed in `failures` and its migrations are not checked: that never stops a run.
 * Returns the tables that have the column.
 */
export async function ensureHashColumns(client) {
  const hashed = new Set();
  const failures = [];
  for (const { table } of LEDGERS) {
    const state = await ledgerState(client, table);
    if (!state.exists) continue;
    if (state.hashed) {
      hashed.add(table);
      continue;
    }
    try {
      await client.query(`ALTER TABLE ${escapeIdentifier(table)} ADD COLUMN IF NOT EXISTS ${escapeIdentifier(HASH_COLUMN)} TEXT`);
      hashed.add(table);
    } catch (error) {
      failures.push({ table, message: error.message });
    }
  }
  return { hashed, failures };
}

/** The rows of a ledger (none when the table does not exist yet), with `content_hash` null where there is no hash. */
export async function readLedger(client, ledger) {
  const state = await ledgerState(client, ledger.table);
  if (!state.exists) return [];
  const columns = [...ledger.keys, ...(state.hashed ? [HASH_COLUMN] : [])].map(escapeIdentifier).join(', ');
  const { rows } = await client.query(`SELECT ${columns} FROM ${escapeIdentifier(ledger.table)} ORDER BY ${ledger.keys.map(escapeIdentifier).join(', ')}`);
  return rows.map(row => ({ ...row, content_hash: row.content_hash ?? null }));
}

/** Records the hash of the files whose rows have none: the first run after the column was added. */
export async function fillHashes(client, ledger, unhashed) {
  if (unhashed.length === 0) return;
  const columns = ledger.keys.map(key => `${escapeIdentifier(key)} text`).join(', ');
  const match = ledger.keys.map(key => `t.${escapeIdentifier(key)} = v.${escapeIdentifier(key)}`).join(' AND ');
  const values = unhashed.map(({ row, file }) => ({ ...Object.fromEntries(ledger.keys.map(key => [key, row[key]])), hash: file.hash }));
  await client.query(
    `UPDATE ${escapeIdentifier(ledger.table)} t SET ${escapeIdentifier(HASH_COLUMN)} = v.hash
     FROM jsonb_to_recordset($1::jsonb) AS v(${columns}, hash text)
     WHERE ${match} AND t.${escapeIdentifier(HASH_COLUMN)} IS NULL`,
    [JSON.stringify(values)]
  );
}

/**
 * Compares every ledger of the database with the files. Writes nothing unless `write`: then it adds the hash
 * column where it is missing and fills the hash of the rows that have none.
 * Returns `{ edited, renamed, hashed, failures }`: the edited and renamed files, each with its `ledger`; the ledgers
 * that have the column; and the ones that could not get it.
 */
export async function ledgerFindings(client, files, { write }) {
  const { hashed, failures } = write ? await ensureHashColumns(client) : { hashed: new Set(), failures: [] };
  const found = { edited: [], renamed: [], hashed, failures };
  for (const ledger of LEDGERS) {
    const { edited, renamed, unhashed } = compareLedger(ledger, await readLedger(client, ledger), files[ledger.table]);
    found.edited.push(...edited.map(item => ({ ledger, ...item })));
    found.renamed.push(...renamed.map(item => ({ ledger, ...item })));
    if (write && !failures.some(failure => failure.table === ledger.table)) await fillHashes(client, ledger, unhashed);
  }
  return found;
}

/** Where a migration comes from, for a message. */
export function describeMigration({ ledger, row }) {
  if (ledger.table === '_migrations') return 'core';
  if (ledger.table === '_entity_migrations') return `entity ${row.entity_name}`;
  return `${row.source_type} ${row.source_name}`;
}

/** The condition that picks the rows of one scope (everything but the file name) in a ledger. */
const scopeCondition = (ledger, row) => ledger.keys.slice(0, -1).map(key => `${key} = ${escapeLiteral(row[key])}`);

/** The UPDATE that records a renamed file under its new name. */
export function renameStatement({ ledger, row, file }) {
  return `UPDATE ${escapeIdentifier(ledger.table)} SET filename = ${escapeLiteral(file.filename)} WHERE ${[...scopeCondition(ledger, row), `filename = ${escapeLiteral(row.filename)}`].join(' AND ')};`;
}

/** The UPDATEs that accept the edited files as they are now: the hash is recorded again on the next run. One per ledger scope. */
export function acceptStatements(edited) {
  const groups = new Map();
  for (const { ledger, row } of edited) {
    const key = `${ledger.table}\0${scopeOf(ledger, row)}`;
    if (!groups.has(key)) groups.set(key, { ledger, row, files: [] });
    groups.get(key).files.push(row.filename);
  }
  return [...groups.values()].map(({ ledger, row, files }) =>
    `UPDATE ${escapeIdentifier(ledger.table)} SET ${HASH_COLUMN} = NULL WHERE ${[...scopeCondition(ledger, row), `filename IN (${files.map(escapeLiteral).join(', ')})`].join(' AND ')};`
  );
}

/** What db:migrate says about the recorded files that changed: `null` when none did. */
export function editedReport(edited, destination) {
  if (edited.length === 0) return null;
  return [
    `${edited.length} migration file(s) changed after ${edited.length === 1 ? 'it was' : 'they were'} applied to ${destination}:`,
    ...edited.map(item => `   - ${item.row.filename} (${describeMigration(item)})`),
    'A recorded file never runs again, so an edit does not reach this database, while a database created from the files as they are now gets it:',
    'the two end up different. Put the change in a new migration, or restore the file to what ran. If the edit changes nothing the',
    'database sees (a comment, formatting), accept the file as it is now, and the next db:migrate records its hash again:',
    ...acceptStatements(edited).map(statement => `   ${statement}`),
  ].join('\n');
}

/** What db:migrate says about recorded files that were renamed: `null` when none were. */
export function renamedReport(renamed, destination) {
  if (renamed.length === 0) return null;
  return [
    `${renamed.length} recorded migration(s) are no longer on disk under the name ${renamed.length === 1 ? 'it was' : 'they were'} applied with, and a file with the same content has no record in ${destination}:`,
    ...renamed.map(item => `   - ${item.row.filename} is now ${item.file.filename} (${describeMigration(item)})`),
    'db:migrate would apply each of them again. If the file was renamed, record the new name:',
    ...renamed.map(item => `   ${renameStatement(item)}`),
    'If it is meant to run again as a new migration, delete the old record instead.',
  ].join('\n');
}
