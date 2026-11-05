/**
 * Which files of a project count as its code. Shared by the code migrations (which rewrite them) and the query-provider
 * search (which reads them); no file system here, so the registry build can load it (it writes only through safe-fs).
 *
 * @module core/scripts/maintenance/source-files
 */

/** Code files: what a project imports from */
export const SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/
/** Tests, which mock modules by name, and type declarations are left alone */
export const SKIPPED_FILE = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/
/** Installed, built or test code; also every directory starting with a dot and the generated src/app */
export const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'public', 'storybook-static', 'ios', 'android', '__tests__', 'tests', 'cypress'])
