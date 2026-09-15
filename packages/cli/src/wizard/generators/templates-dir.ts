/**
 * Templates Directory
 *
 * Locates the project templates shipped in @nextsparkjs/core.
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Get the templates directory path from @nextsparkjs/core
 *
 * @param projectRoot - The directory whose node_modules holds @nextsparkjs/core.
 *   A web + mobile project installs core at its root but generates the web app
 *   from inside web/, so code that runs after that chdir has to pass the root.
 */
export function getTemplatesDir(projectRoot: string = process.cwd()): string {
  // Check multiple possible paths for templates directory
  // Priority: installed package in node_modules > development monorepo paths
  const possiblePaths = [
    // From project root node_modules (most common for installed packages)
    path.resolve(projectRoot, 'node_modules/@nextsparkjs/core/templates'),
    // From CLI dist folder for development
    path.resolve(__dirname, '../../core/templates'),
    // Legacy paths for different build structures
    path.resolve(__dirname, '../../../../../core/templates'),
    path.resolve(__dirname, '../../../../core/templates'),
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p
    }
  }

  throw new Error(`Could not find @nextsparkjs/core templates directory. Searched: ${possiblePaths.join(', ')}`)
}
