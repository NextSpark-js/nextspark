/**
 * Synchronous, validated loader for the required project-root
 * nextspark.config.ts file.
 *
 * @module core/scripts/build/config-loader
 */

import { createRequire } from 'module'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { createJiti } = require('jiti')
const coreRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const sourceContract = join(coreRoot, 'src/lib/config/nextspark-types.ts')
const builtContract = join(coreRoot, 'dist/lib/config/nextspark-types.js')
const contractPath = existsSync(sourceContract) ? sourceContract : builtContract
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  fsCache: false,
  alias: { '@nextsparkjs/core/lib/config': contractPath },
})

export function loadNextSparkConfigSync(projectRoot) {
  const configPath = join(projectRoot, 'nextspark.config.ts')
  if (!existsSync(configPath)) {
    throw new Error(`NextSpark project root ${projectRoot} is missing required nextspark.config.ts.`)
  }

  let loaded
  try {
    loaded = jiti(configPath)
  } catch (error) {
    throw new Error(`Could not load ${configPath}: ${error.message}`, { cause: error })
  }

  const value = loaded?.default ?? loaded
  const contract = jiti(contractPath)
  const validation = contract.validateNextSparkConfig(value)
  if (!validation.valid) {
    throw new Error(`Invalid nextspark.config.ts:\n- ${validation.errors.join('\n- ')}`)
  }
  return validation.config
}
