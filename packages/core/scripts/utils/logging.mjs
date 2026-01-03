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
