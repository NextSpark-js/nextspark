/**
 * NextSpark Config Loader
 *
 * Synchronous loader for nextspark.config.ts
 * Used by build scripts to read project-level configuration
 *
 * @module core/scripts/build/config-loader
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Parse nextspark.config.ts synchronously
 * Simple regex-based parser for config values
 *
 * @param {string} projectRoot - Project root path
 * @returns {object|null} Parsed config or null if not found
 */
export function loadNextSparkConfigSync(projectRoot) {
  const configPath = join(projectRoot, 'nextspark.config.ts')

  if (!existsSync(configPath)) {
    return null
  }

  try {
    const content = readFileSync(configPath, 'utf8')

    // Extract plugins array
    const pluginsMatch = content.match(/plugins:\s*\[([^\]]+)\]/)
    const plugins = pluginsMatch
      ? pluginsMatch[1]
          .split(',')
          .map(p => p.trim().replace(/['"]/g, ''))
          .filter(Boolean)
      : null

    // Extract features object
    const featuresMatch = content.match(/features:\s*\{([^}]+)\}/)
    const features = featuresMatch
      ? parseFeaturesObject(featuresMatch[1])
      : null

    // Extract theme (though it should be in .env)
    const themeMatch = content.match(/theme:\s*['"]([^'"]+)['"]/)
    const theme = themeMatch ? themeMatch[1] : null

    return {
      theme,
      plugins,
      features
    }
  } catch (error) {
    console.warn(`Warning: Could not parse nextspark.config.ts: ${error.message}`)
    return null
  }
}

/**
 * Parse features object from string
 * @param {string} featuresStr - Features object string
 * @returns {object} Parsed features
 */
function parseFeaturesObject(featuresStr) {
  const features = {}

  // Parse each feature flag (e.g., "billing: true")
  const featurePattern = /(\w+):\s*(true|false)/g
  let match

  while ((match = featurePattern.exec(featuresStr)) !== null) {
    features[match[1]] = match[2] === 'true'
  }

  return features
}
