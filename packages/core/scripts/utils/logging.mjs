/**
 * Logging utilities for build scripts
 *
 * @module core/scripts/utils/logging
 */

// Verbose mode state (set via setVerboseMode)
let verboseMode = false

/**
 * Set verbose mode for logging
 * Call this at script initialization with your config
 *
 * @param {boolean} enabled - Whether to enable verbose logging
 */
export function setVerboseMode(enabled) {
  verboseMode = enabled
}

/**
 * Check if verbose mode is enabled
 * @returns {boolean}
 */
export function isVerbose() {
  return verboseMode
}

/**
 * What breaks a line in a terminal or a log, or reorders how it reads: C0 and C1
 * controls - a newline, a carriage return, ESC and the sequences it starts - DEL,
 * the line and paragraph separators, and the bidirectional marks, embeddings,
 * overrides and isolates.
 */
const BREAKS_A_LINE = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/

/**
 * A path as a log line names it: as it is, or, when it holds a character that
 * breaks or reorders the line, quoted, with each such character escaped - the
 * way `nextspark sync:app` names one, which repeats these lines. JSON escapes
 * the C0 controls but writes the rest as they are.
 *
 * @param {string} path - The path to name
 * @returns {string}
 */
export function shownPath(path) {
  if (!BREAKS_A_LINE.test(path)) return path
  return JSON.stringify(path).replace(new RegExp(BREAKS_A_LINE.source, 'g'), character =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

/**
 * A path as a message names it between double quotes: quoted as it is, or, when
 * it holds a character that breaks or reorders a line, the way `shownPath`
 * quotes it.
 *
 * @param {string} path - The path to name
 * @returns {string}
 */
export function quotedPath(path) {
  const shown = shownPath(path)
  return shown === path ? `"${path}"` : shown
}

/**
 * An error's message as a log shows it. The paths Node puts in the message of an
 * error from the file system - its path, and its dest - are shown the way
 * `shownPath` shows one, in place of the quotes around them; the lines of the
 * message are kept, each shown the way `shownPath` shows a line. The build's own
 * messages show the paths they name that way where each is written.
 *
 * @param {unknown} error - What was thrown
 * @returns {string}
 */
export function shownMessage(error) {
  let message = typeof error?.message === 'string' ? error.message : String(error)
  for (const path of [error?.path, error?.dest]) {
    if (typeof path !== 'string' || shownPath(path) === path) continue
    message = message.split(`'${path}'`).join(shownPath(path)).split(path).join(shownPath(path))
  }
  return message.split('\n').map(shownPath).join('\n')
}

/**
 * An error's stack as a log shows it: its message as `shownMessage` shows it,
 * and each line of the stack the way `shownPath` shows a line.
 *
 * @param {unknown} error - What was thrown
 * @returns {string}
 */
export function shownStack(error) {
  const message = typeof error?.message === 'string' ? error.message : ''
  const stack = typeof error?.stack === 'string' ? error.stack : String(error)
  const withMessageShown = message && stack.includes(message) ? stack.replace(message, () => shownMessage(error)) : stack
  return withMessageShown.split('\n').map(shownPath).join('\n')
}

/**
 * Log a message with an emoji prefix based on type
 *
 * @param {string} message - The message to log
 * @param {'info' | 'success' | 'warning' | 'error' | 'build'} type - Message type
 */
export function log(message, type = 'info') {
  const prefix = {
    info: '🔍',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    build: '🏗️ '
  }[type] || '📝'

  console.log(`${prefix} ${message}`)
}

/**
 * Log a verbose message (only if verbose mode is enabled)
 *
 * @param {string} message - The message to log
 */
export function verbose(message) {
  if (verboseMode) {
    console.log(`   ${message}`)
  }
}
