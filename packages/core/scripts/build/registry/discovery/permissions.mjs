/**
 * Permissions Discovery
 *
 * Discovers permissions configuration from active theme
 *
 * @module core/scripts/build/registry/discovery/permissions
 */

import { join } from 'path'
import { existsSync, readFileSync } from 'fs'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { log, verbose } from '../../../utils/index.mjs'

/**
 * Parse roles configuration from permissions config file using regex
 * This extracts the roles object from the TypeScript file
 * @param {string} content - File content
 * @returns {Object|null} Parsed roles object
 */
function parseRolesFromConfig(content) {
  // Find roles: { ... } section
  const rolesMatch = content.match(/roles:\s*\{([\s\S]*?)\n  \},?\s*\n/)
  if (!rolesMatch) {
    verbose('No roles section found in permissions.config.ts')
    return null
  }

  const rolesContent = rolesMatch[1]
  const roles = {}

  // Extract additionalRoles array
  const additionalRolesMatch = rolesContent.match(/additionalRoles:\s*\[([^\]]+)\]/)
  if (additionalRolesMatch) {
    roles.additionalRoles = additionalRolesMatch[1]
      .split(',')
      .map(r => r.trim().replace(/['"]/g, '').replace(/\s+as\s+const/, ''))
      .filter(r => r.length > 0)
  }

  // Extract hierarchy object
  const hierarchyMatch = rolesContent.match(/hierarchy:\s*\{([^}]+)\}/)
  if (hierarchyMatch) {
    roles.hierarchy = {}
    const pairs = hierarchyMatch[1].match(/(\w+):\s*(\d+)/g)
    if (pairs) {
      for (const pair of pairs) {
        const [key, value] = pair.split(':').map(s => s.trim())
        roles.hierarchy[key] = parseInt(value, 10)
      }
    }
  }

  // Extract displayNames object
  const displayNamesMatch = rolesContent.match(/displayNames:\s*\{([^}]+)\}/)
  if (displayNamesMatch) {
    roles.displayNames = {}
    const pairs = displayNamesMatch[1].match(/(\w+):\s*['"]([^'"]+)['"]/g)
    if (pairs) {
      for (const pair of pairs) {
        const match = pair.match(/(\w+):\s*['"]([^'"]+)['"]/)
        if (match) {
          roles.displayNames[match[1]] = match[2]
        }
      }
    }
  }

  // Extract descriptions object
  const descriptionsMatch = rolesContent.match(/descriptions:\s*\{([^}]+)\}/)
  if (descriptionsMatch) {
    roles.descriptions = {}
    const pairs = descriptionsMatch[1].match(/(\w+):\s*['"]([^'"]+)['"]/g)
    if (pairs) {
      for (const pair of pairs) {
        const match = pair.match(/(\w+):\s*['"]([^'"]+)['"]/)
        if (match) {
          roles.descriptions[match[1]] = match[2]
        }
      }
    }
  }

  return Object.keys(roles).length > 0 ? roles : null
}

/**
 * Parse entities from permissions config file using regex
 * This extracts the entities object from the TypeScript file
 * @param {string} content - File content
 * @returns {Object} Parsed entities object
 */
function parseEntitiesFromConfig(content) {
  const entities = {}

  // Find entities: { ... } section
  const entitiesMatch = content.match(/entities:\s*\{([\s\S]*?)\n  \},?\s*\n/)
  if (!entitiesMatch) {
    verbose('No entities section found in permissions.config.ts')
    return entities
  }

  const entitiesContent = entitiesMatch[1]

  // Match each entity block: entityName: [ ... ]
  // Supports: customers:, "ai-agents":, 'landing-metrics':
  // The key can be:
  //   - Simple word: customers
  //   - Quoted with hyphens: "ai-agents" or 'ai-agents'
  //
  // IMPORTANT: The closing bracket must be at the start of a line (after newline + whitespace)
  // This prevents matching `]` inside nested arrays like `roles: ['owner', 'admin']`
  // which appear in the MIDDLE of a line, not at the start.
  //
  // The regex requires:
  //   - Entity key at start of line (newline + whitespace)
  //   - Closing bracket at start of line (newline + whitespace)
  const entityBlockRegex = /\n\s*['"]?([\w-]+)['"]?:\s*\[([\s\S]*?)\n\s*\]/g
  let entityMatch

  while ((entityMatch = entityBlockRegex.exec(entitiesContent)) !== null) {
    const entitySlug = entityMatch[1]
    const actionsContent = entityMatch[2]
    const actions = []

    // Match each action object
    const actionRegex = /\{\s*action:\s*['"](\w+)['"][^}]*\}/g
    let actionMatch

    while ((actionMatch = actionRegex.exec(actionsContent)) !== null) {
      const actionBlock = actionMatch[0]
      const action = actionMatch[1]

      // Extract label
      const labelMatch = actionBlock.match(/label:\s*['"]([^'"]+)['"]/)
      const label = labelMatch ? labelMatch[1] : null

      // Extract description
      const descMatch = actionBlock.match(/description:\s*['"]([^'"]+)['"]/)
      const description = descMatch ? descMatch[1] : null

      // Extract roles
      const rolesMatch = actionBlock.match(/roles:\s*\[([^\]]+)\]/)
      const roles = rolesMatch
        ? rolesMatch[1].split(',').map(r => r.trim().replace(/['"]/g, ''))
        : ['owner', 'admin']

      // Extract dangerous
      const dangerousMatch = actionBlock.match(/dangerous:\s*(true|false)/)
      const dangerous = dangerousMatch ? dangerousMatch[1] === 'true' : false

      actions.push({ action, label, description, roles, dangerous })
    }

    entities[entitySlug] = actions
  }

  return entities
}

/**
 * Parse a flat array of permission action objects from a named section
 * Works for both `teams: [...]` and `features: [...]`
 * Each item has: action, label, description, roles, category?, dangerous?
 *
 * @param {string} content - Full file content
 * @param {string} sectionName - Section name ('teams' or 'features')
 * @returns {Array} Parsed permission actions
 */
function parseActionArrayFromConfig(content, sectionName) {
  const results = []

  // Find the section: sectionName: [ ... ]
  // The closing bracket must be at column 2 (two-space indent) followed by ],
  const sectionRegex = new RegExp(`${sectionName}:\\s*\\[([\\s\\S]*?)\\n  \\],?\\s*\\n`)
  const sectionMatch = content.match(sectionRegex)
  if (!sectionMatch) {
    verbose(`No ${sectionName} section found in permissions.config.ts`)
    return results
  }

  const sectionContent = sectionMatch[1]

  // Match each action object { ... }
  // Handles both single-line: { action: 'x', ... }
  // and multi-line: {\n  action: 'x',\n  ...\n}
  const actionRegex = /\{[^}]+\}/g
  let actionMatch

  while ((actionMatch = actionRegex.exec(sectionContent)) !== null) {
    const block = actionMatch[0]

    // Extract action (supports dotted names like 'media.upload', 'team.view')
    const actionKeyMatch = block.match(/action:\s*['"]([^'"]+)['"]/)
    if (!actionKeyMatch) continue
    const action = actionKeyMatch[1]

    // Extract label
    const labelMatch = block.match(/label:\s*['"]([^'"]+)['"]/)
    const label = labelMatch ? labelMatch[1] : action

    // Extract description
    const descMatch = block.match(/description:\s*['"]([^'"]+)['"]/)
    const description = descMatch ? descMatch[1] : null

    // Extract category (features have this, teams don't)
    const categoryMatch = block.match(/category:\s*['"]([^'"]+)['"]/)
    const category = categoryMatch ? categoryMatch[1] : null

    // Extract roles
    const rolesMatch = block.match(/roles:\s*\[([^\]]+)\]/)
    const roles = rolesMatch
      ? rolesMatch[1].split(',').map(r => r.trim().replace(/['"]/g, ''))
      : ['owner', 'admin']

    // Extract dangerous
    const dangerousMatch = block.match(/dangerous:\s*(true|false)/)
    const dangerous = dangerousMatch ? dangerousMatch[1] === 'true' : false

    results.push({ action, label, description, category, roles, dangerous })
  }

  return results
}

/**
 * Discover permissions configuration from active theme
 * Returns null if theme doesn't have a permissions.config.ts
 * @param {object} config - Optional configuration object (defaults to DEFAULT_CONFIG)
 * @returns {Promise<{path: string, importPath: string, themeName: string, entities: Object}|null>}
 */
export async function discoverPermissionsConfig(config = DEFAULT_CONFIG) {
  const themeName = config.activeTheme
  if (!themeName) {
    log('No active theme set, skipping permissions config discovery', 'warning')
    return null
  }

  const permissionsPath = join(config.themesDir, themeName, 'config', 'permissions.config.ts')

  if (!existsSync(permissionsPath)) {
    log(`No permissions.config.ts found for theme ${themeName}`, 'info')
    return null
  }

  log(`Found permissions.config.ts for theme ${themeName}`, 'success')

  // Parse entities, roles, teams, and features from the config file
  let entities = {}
  let roles = null
  let teams = []
  let features = []
  try {
    const content = readFileSync(permissionsPath, 'utf8')
    entities = parseEntitiesFromConfig(content)
    roles = parseRolesFromConfig(content)
    teams = parseActionArrayFromConfig(content, 'teams')
    features = parseActionArrayFromConfig(content, 'features')

    const entityCount = Object.keys(entities).length
    const permCount = Object.values(entities).reduce((acc, arr) => acc + arr.length, 0)
    if (entityCount > 0) {
      log(`  📋 Parsed ${permCount} entity permissions across ${entityCount} entities`, 'info')
    }
    if (teams.length > 0) {
      log(`  🔑 Parsed ${teams.length} team permissions`, 'info')
    }
    if (features.length > 0) {
      log(`  ⚡ Parsed ${features.length} feature permissions`, 'info')
    }
    if (roles && roles.additionalRoles) {
      log(`  👥 Parsed ${roles.additionalRoles.length} custom roles: ${roles.additionalRoles.join(', ')}`, 'info')
    }
  } catch (err) {
    log(`Error parsing permissions.config.ts: ${err.message}`, 'warning')
  }

  return {
    path: permissionsPath,
    importPath: `@/contents/themes/${themeName}/config/permissions.config`,
    themeName,
    entities,
    roles,
    teams,
    features
  }
}
