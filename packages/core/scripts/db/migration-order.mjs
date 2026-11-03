/**
 * The order migration files run in (#382).
 *
 * By the number the file name starts with, then by file name: `151_` runs before `1001_`. Comparing the names
 * as text put `1001_` first, so a project that numbered a migration after the existing ones had to read every
 * file name to pick a prefix that sorted last. A file without a numeric prefix runs after the numbered ones.
 * Every core and template migration has a three-digit prefix, so for them this is the order text gave.
 *
 * The ledgers record a migration by file name, never by position, so a different order never runs an applied
 * migration again.
 */

/** The digits the name starts with (`999a_x.sql` is 999), or Infinity when it does not start with any. */
export function migrationNumber(filename) {
  const match = /^(\d+)/.exec(filename);
  return match ? parseInt(match[1], 10) : Infinity;
}

/** Comparator for migration objects with a `filename`, or for plain file names. */
export function compareMigrations(a, b) {
  const nameA = typeof a === 'string' ? a : a.filename;
  const nameB = typeof b === 'string' ? b : b.filename;
  const byNumber = migrationNumber(nameA) - migrationNumber(nameB);
  // Infinity - Infinity is NaN: two files without a prefix are ordered by name
  return byNumber || nameA.localeCompare(nameB);
}
