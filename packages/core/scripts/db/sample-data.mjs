// Which migrations are sample data, and whether a db:migrate run applies them.
//
// Sample data is applied only when the run asks for it -- `--sample-data`
// (what `nextspark db:seed` passes) or NEXTSPARK_SEED_SAMPLE_DATA=1, in the
// environment or the project .env -- and never when NODE_ENV is production in
// either: its accounts have a documented development password. A sample-data
// file that is not applied is not recorded either, so a later run that asks
// for it still applies it.

export const SAMPLE_DATA_FLAG = '--sample-data';
export const SAMPLE_DATA_VARIABLE = 'NEXTSPARK_SEED_SAMPLE_DATA';
/** A line that marks a migration as sample data when its name does not say so. */
export const SAMPLE_DATA_MARKER = '-- nextspark:sample-data';

// A value as a .env or a shell may write it: any case, quotes, a trailing comment.
const isProduction = value => /^\s*["']?production\b/i.test(String(value ?? ''));
const isOn = value => /^\s*["']?(1|true)\b/i.test(String(value ?? ''));

export function isSampleDataMigration(filename, sql = '') {
  const name = filename.toLowerCase();
  return name.includes('sample_data') || name.includes('sample-data') || sql.split('\n').some(line => line.trim() === SAMPLE_DATA_MARKER);
}

/**
 * `env` is the process environment, `fileEnv` what the project .env sets.
 * Returns whether sample data is applied and the line the runner prints about it.
 */
export function sampleDataPolicy({ argv = [], env = {}, fileEnv = {} }) {
  const requested = argv.includes(SAMPLE_DATA_FLAG) || [env[SAMPLE_DATA_VARIABLE], fileEnv[SAMPLE_DATA_VARIABLE]].some(isOn);
  if ([env.NODE_ENV, fileEnv.NODE_ENV].some(isProduction)) {
    return { apply: false, notice: `Sample data is not applied: NODE_ENV is production${requested ? ', which the sample-data switch does not override' : ''}.` };
  }
  if (requested) {
    return { apply: true, notice: 'Sample data is applied (development). Its accounts share a documented password: use this only on a local database, and never use a database seeded this way in production (its sample accounts are kept, and later migrations do not disable them).' };
  }
  return { apply: false, notice: `Sample data is not applied. For a local development database, run \`pnpm db:seed\` (or pass ${SAMPLE_DATA_FLAG}, or set ${SAMPLE_DATA_VARIABLE}=1).` };
}
