/**
 * Path Security
 *
 * Validates that file paths resolve within the project directory.
 * Prevents path traversal attacks (e.g., ../../etc/passwd).
 *
 * Shared between API routes and the chat MCP server.
 */

import path from 'path'

/**
 * Validate that a resolved path is within the project directory.
 * Prevents path traversal attacks.
 *
 * @param filePath - Relative path to validate
 * @param projectDir - The project root directory
 * @returns The fully resolved path
 * @throws Error if path escapes the project directory
 */
export function assertWithinProject(filePath: string, projectDir: string): string {
  const resolved = path.resolve(projectDir, filePath)
  const normalizedProject = path.resolve(projectDir)
  if (!resolved.startsWith(normalizedProject + path.sep) && resolved !== normalizedProject) {
    throw new Error(`Access denied: path "${filePath}" is outside the project directory`)
  }
  return resolved
}
