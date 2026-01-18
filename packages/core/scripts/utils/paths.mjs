/**
 * Cross-Platform Path Utilities
 *
 * Helper functions for handling paths consistently across Windows, macOS, and Linux.
 * Always use these utilities instead of direct string operations on paths.
 *
 * Key differences between platforms:
 * - Windows: Uses backslashes (\) in file paths
 * - macOS/Linux: Uses forward slashes (/) in file paths
 * - Node's import.meta.url: Always uses forward slashes (file:///...)
 * - Node's process.argv: Uses platform-native separators
 *
 * @module core/scripts/utils/paths
 */

import { sep, posix, win32 } from 'path'

/**
 * Normalize path separators to forward slashes (POSIX style)
 * Useful for consistent path handling across platforms
 *
 * @param {string} path - Path to normalize
 * @returns {string} Path with forward slashes
 *
 * @example
 * toForwardSlashes('C:\\Users\\name\\file.txt')
 * // Returns: 'C:/Users/name/file.txt'
 */
export function toForwardSlashes(path) {
  return path.replace(/\\/g, '/')
}

/**
 * Normalize path separators to platform-native style
 *
 * @param {string} path - Path to normalize
 * @returns {string} Path with native separators
 */
export function toNativeSeparators(path) {
  if (sep === '\\') {
    return path.replace(/\//g, '\\')
  }
  return path.replace(/\\/g, '/')
}

/**
 * Get the basename of a path, handling both forward and back slashes
 * This is safe to use on paths from any source (argv, import.meta.url, etc.)
 *
 * @param {string} path - Path to get basename from
 * @returns {string} The last segment of the path
 *
 * @example
 * getBasename('C:\\Users\\name\\file.txt')
 * // Returns: 'file.txt'
 *
 * getBasename('file:///Users/name/file.txt')
 * // Returns: 'file.txt'
 */
export function getBasename(path) {
  return path.split(/[/\\]/).pop() || ''
}

/**
 * Get the directory name of a path, handling both separators
 *
 * @param {string} path - Path to get dirname from
 * @returns {string} The directory portion of the path
 */
export function getDirname(path) {
  const parts = path.split(/[/\\]/)
  parts.pop()
  return parts.join(sep)
}

/**
 * Join path segments using forward slashes (for glob patterns, URLs, etc.)
 *
 * @param {...string} segments - Path segments to join
 * @returns {string} Joined path with forward slashes
 */
export function joinPosix(...segments) {
  return segments.join('/').replace(/\/+/g, '/')
}

/**
 * Check if running on Windows
 * @returns {boolean}
 */
export function isWindows() {
  return process.platform === 'win32'
}

/**
 * Check if a path is absolute, handling both Windows and POSIX paths
 *
 * @param {string} path - Path to check
 * @returns {boolean}
 */
export function isAbsolute(path) {
  return posix.isAbsolute(path) || win32.isAbsolute(path)
}

/**
 * Normalize an array of paths to use forward slashes
 * Useful for glob results on Windows
 *
 * @param {string[]} paths - Array of paths
 * @returns {string[]} Paths with forward slashes
 */
export function normalizePathArray(paths) {
  return paths.map(toForwardSlashes)
}
