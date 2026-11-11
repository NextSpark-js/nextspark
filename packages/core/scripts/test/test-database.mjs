// Which database the `db` project of a project's Jest suite runs against (#430).
//
// A database suite writes to its database, and often empties it. The environment's DATABASE_URL is usually the shared
// development database of a developer, sometimes a remote one, so the runner does not use it: the `db` project gets a
// throwaway PostgreSQL cluster of its own (scripts/test/throwaway-postgres.cjs), unless NEXTSPARK_TEST_DATABASE_URL
// names a database to use instead. That one has to be on this machine, unless NEXTSPARK_TEST_ALLOW_REMOTE_DATABASE
// says otherwise.

import { destinationParts } from '../db/destination.mjs';

/** The name of the Jest project that runs against a database. */
export const DATABASE_PROJECT = 'db';
/** The database to run the `db` project against instead of a throwaway cluster. */
export const TEST_DATABASE_URL = 'NEXTSPARK_TEST_DATABASE_URL';
/** `1` or `true` lets TEST_DATABASE_URL name a database that is not on this machine. */
export const ALLOW_REMOTE_DATABASE = 'NEXTSPARK_TEST_ALLOW_REMOTE_DATABASE';

export const isOn = value => /^\s*["']?(1|true)\b/i.test(String(value ?? ''));

/** Whether the Jest arguments select the `db` project: `--selectProjects db`, `--selectProjects=db`, among others. */
export function selectsDatabaseProject(args) {
  const selected = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--selectProjects=')) selected.push(args[i].slice('--selectProjects='.length));
    else if (args[i] === '--selectProjects') {
      // the project names run up to the next option
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) selected.push(args[++i]);
    }
  }
  return selected.includes(DATABASE_PROJECT);
}

/** Whether a host is this machine: nothing (the default socket), a socket directory, localhost or a loopback address. */
export function isLocalHost(host) {
  const name = String(host ?? '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  return name === '' || name.startsWith('/') || name === 'localhost' || name.endsWith('.localhost') || name === '::1' || /^127(\.\d{1,3}){3}$/.test(name);
}

/**
 * Where the `db` project runs, from the environment: `{ url: null }` for a throwaway cluster, or `{ url }` for the
 * database TEST_DATABASE_URL names. Throws, with the way out in the message, for one that is not on this machine
 * without ALLOW_REMOTE_DATABASE, and for a URL it cannot read (it could be anywhere).
 */
export function testDatabaseTarget(env) {
  // (a URL with no host connects to PGHOST, which destinationParts reads from the same environment)
  const url = env[TEST_DATABASE_URL];
  if (!url) return { url: null };
  const parts = destinationParts(url, env);
  if (!parts) {
    throw new Error(`${TEST_DATABASE_URL} is not a connection URL that can be read, so it cannot be checked for being on this machine. Nothing was run.`);
  }
  if (!isLocalHost(parts.host) && !isOn(env[ALLOW_REMOTE_DATABASE])) {
    throw new Error(
      `${TEST_DATABASE_URL} points at host ${parts.host}, database ${parts.database || '(none)'}, which is not this machine, and the db project writes to its database. ` +
      `To run against it anyway, set ${ALLOW_REMOTE_DATABASE}=1. To use a throwaway database on this machine instead, unset ${TEST_DATABASE_URL}. Nothing was run.`
    );
  }
  return { url };
}
