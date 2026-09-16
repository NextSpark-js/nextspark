/**
 * Build script utilities
 *
 * Re-exports all utilities for convenient importing:
 *
 * @example
 * import { log, verbose, extractExportName } from '../utils/index.mjs'
 *
 * @module core/scripts/utils
 */

export {
  log,
  verbose,
  setVerboseMode,
  isVerbose,
  shownPath,
  shownLine,
  jsonLine,
  guardConsole,
  errorWithLines,
  messageLines,
  stackLines,
  logFailure
} from './logging.mjs'

export {
  extractExportName,
  extractHttpMethods,
  extractTemplateMetadata,
  scanDirectory,
  pathExists,
  readFileSafe
} from './file-utils.mjs'
