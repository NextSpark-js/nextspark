/**
 * Logging utilities for build scripts
 *
 * @module core/scripts/utils/logging
 */

import { format } from 'node:util'

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
 * Text as a line of output shows it: as it is, or, when it holds a character
 * that breaks or reorders the line, quoted, with each such character escaped -
 * the way `nextspark` shows one, which repeats these lines. JSON escapes the C0
 * controls but writes the rest as they are.
 *
 * @param {string} path - The text to show
 * @returns {string}
 */
export function shownPath(path) {
  if (!BREAKS_A_LINE.test(path)) return path
  return JSON.stringify(path).replace(new RegExp(BREAKS_A_LINE.source, 'g'), character =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

/**
 * What one call to the console prints, as a line of output shows it. The
 * newlines and spaces it starts with and the newlines it ends with are kept, as
 * the blank lines around it and its indent; when what is between them holds a
 * character that breaks or reorders a line, all of it is shown the way
 * `shownPath` shows a path, on the one line. A
 * newline inside a call can't be told from one in a name the call prints, so
 * what spans lines is printed one call per line, and a call starts with its own
 * text rather than with a name.
 *
 * @param {string} text - What one call prints
 * @returns {string}
 */
export function shownLine(text) {
  const [, before, body, after] = /^([\n ]*)([\s\S]*?)(\n*)$/.exec(text)
  return `${before}${shownPath(body)}${after}`
}

/**
 * `value` as JSON that a line of output shows as it is: JSON.stringify escapes
 * the C0 controls but leaves the C1 controls, the separators and the
 * bidirectional marks as they are, and those are valid JSON escaped too.
 *
 * @param {unknown} value - What to write as JSON
 * @returns {string}
 */
export function jsonLine(value) {
  return JSON.stringify(value).replace(new RegExp(BREAKS_A_LINE.source, 'g'), character =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

const GUARDED = Symbol.for('nextspark.shownLine')

/**
 * Make each call to `target`'s log, info, warn, error and debug print what it
 * formats the way `shownLine` shows it. Once this runs, whatever prints through
 * the console - the build's own lines, the paths and names in them, and the
 * libraries it loads, dotenv among them - is escaped there, where it is printed.
 *
 * @param {Console} [target] - The console to guard
 */
export function guardConsole(target = console) {
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    const original = target[method]
    if (typeof original !== 'function' || original[GUARDED]) continue
    const guarded = (...args) => original.call(target, shownLine(format(...args)))
    guarded[GUARDED] = true
    target[method] = guarded
  }
}

/**
 * An error whose message is `lines`, one per line. The build prints an error's
 * message one line per call, and takes as lines of their own only the ones an
 * error carries this way: a newline anywhere else in a message belongs to a
 * name in it.
 *
 * @param {string[]} lines - The lines of the message
 * @returns {Error}
 */
export function errorWithLines(lines) {
  return Object.assign(new Error(lines.join('\n')), { lines })
}

/**
 * The lines of an error's message, each printed with a call of its own: the
 * ones `errorWithLines` gave it, or else the whole message as one.
 *
 * @param {unknown} error - What was thrown
 * @returns {string[]}
 */
export function messageLines(error) {
  if (Array.isArray(error?.lines) && error.lines.every(line => typeof line === 'string')) return error.lines
  return [typeof error?.message === 'string' ? error.message : String(error)]
}

/**
 * The lines of an error's stack, each printed with a call of its own: its
 * heading with the message as `messageLines` splits it, and then each frame -
 * split where the next `    at ` starts, since a frame names a file whose path
 * can hold a newline of its own.
 *
 * @param {unknown} error - What was thrown
 * @returns {string[]}
 */
export function stackLines(error) {
  const stack = typeof error?.stack === 'string' ? error.stack : String(error)
  const message = typeof error?.message === 'string' ? error.message : ''
  const at = message ? stack.indexOf(message) : -1
  if (at === -1) return stack.split(/\n(?= {4}at )/)
  const [first, ...rest] = messageLines(error)
  const frames = stack.slice(at + message.length).replace(/^\n/, '')
  return [`${stack.slice(0, at)}${first}`, ...rest, ...(frames ? frames.split(/\n(?= {4}at )/) : [])]
}

/**
 * Log that what `label` names failed with `error`: the first line of its
 * message after the label, each other line of it on its own, and, with
 * `withStack`, the stack on stderr, one line per call.
 *
 * @param {string} label - What failed
 * @param {unknown} error - What was thrown
 * @param {boolean} [withStack] - Whether to print the stack too
 */
export function logFailure(label, error, withStack = false) {
  const [first, ...rest] = messageLines(error)
  log(`${label}: ${first}`, 'error')
  for (const line of rest) console.log(line)
  if (withStack) {
    for (const line of stackLines(error)) console.error(line)
  }
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
