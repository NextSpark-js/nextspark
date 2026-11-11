/**
 * The throwaway PostgreSQL cluster core's suites start (#402). The implementation ships with the package
 * (scripts/test/throwaway-postgres.cjs, #430), so the database suites of a project start theirs the same way;
 * this file keeps the import path the suites here already use.
 */
export * from '../../scripts/test/throwaway-postgres.cjs'
