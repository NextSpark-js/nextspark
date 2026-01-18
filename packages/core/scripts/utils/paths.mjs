/**
 * Cross-Platform Path Utilities
 *
 * Helper functions for handling paths consistently across Windows, macOS, and Linux.
 *
 * Key differences between platforms:
 * - Windows: Uses backslashes (\) in file paths, process.argv uses backslashes
 * - macOS/Linux: Uses forward slashes (/) in file paths
 * - Node's import.meta.url: Always uses forward slashes (file:///...)
 *
 * @module core/scripts/utils/paths
 */

/**
 * Get the basename of a path, handling both forward and back slashes.
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
