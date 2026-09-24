/**
 * Auth Discovery
 *
 * Discovers authentication configuration files from the project auth directory
 *
 * @module core/scripts/build/registry/discovery/auth
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { verbose } from '../../../utils/index.mjs'

/**
 * Discover auth configuration files
 * Looks for roles.json in the auth directory
 * @returns {Promise<Array<{type: string, path: string, data: object, relativePath: string}>>}
 */
export async function discoverAuthConfig(config) {
  const authDir = join(config.projectSourceDir, 'auth')
  const authConfig = []

  try {
    if (!existsSync(authDir)) {
      verbose('No auth directory found, skipping auth config discovery')
      return []
    }

    const rolesFile = join(authDir, 'roles.json')
    if (existsSync(rolesFile)) {
      const rolesContent = await readFile(rolesFile, 'utf8')
      const rolesData = JSON.parse(rolesContent)

      authConfig.push({
        type: 'roles',
        path: 'roles.json',
        data: rolesData,
        relativePath: 'auth/roles.json'
      })

      verbose('Auth config found: roles.json')
    }
  } catch (error) {
    verbose(`Error discovering auth config: ${error.message}`)
  }

  return authConfig
}
