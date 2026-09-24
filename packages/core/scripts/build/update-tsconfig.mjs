#!/usr/bin/env node

/** Generate tsconfig.json from tsconfig.base.json for one root-first project. */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { projectFiles } from './safe-fs.mjs'
import { resolveProjectPaths } from './registry/project-mode.mjs'

function generateTsConfig() {
  const { projectRoot, isNpmMode } = resolveProjectPaths(process.cwd())
  const basePath = path.join(projectRoot, 'tsconfig.base.json')
  const outputPath = path.join(projectRoot, 'tsconfig.json')
  if (!existsSync(basePath)) throw new Error(`tsconfig.base.json not found at ${basePath}`)

  const config = JSON.parse(readFileSync(basePath, 'utf8'))
  config.compilerOptions ||= {}
  config.compilerOptions.paths ||= {}
  config.compilerOptions.paths['@nextsparkjs/registries/*'] = ['./.nextspark/registries/*']
  config.compilerOptions.paths['@/plugins/*'] = ['./plugins/*']
  config.compilerOptions.paths['@/*'] = ['./*']
  if (isNpmMode) {
    config.compilerOptions.paths['@nextsparkjs/core/*'] = ['./node_modules/@nextsparkjs/core/dist/*']
    config.compilerOptions.paths['@/core/*'] = ['./node_modules/@nextsparkjs/core/dist/*']
  }
  config.include ||= []
  if (!config.include.includes('.nextspark/**/*.ts')) config.include.push('.nextspark/**/*.ts')
  config.exclude = config.baseExclude || ['node_modules', '**/tests/**', '**/cypress/**', '_tmp/**/**']
  delete config.baseExclude
  delete config._comment

  projectFiles(projectRoot).writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  console.log('📝 Generated root-first tsconfig.json')
}

try {
  generateTsConfig()
} catch (error) {
  console.error('❌ Failed to generate tsconfig.json:', error)
  process.exit(1)
}
