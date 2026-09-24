#!/usr/bin/env node
/** Run the current root-first project's Jest suite. */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveProjectPaths } from '../build/registry/project-mode.mjs'

const { projectRoot } = resolveProjectPaths(process.cwd())
const candidates = ['tests/jest/jest.config.ts', 'tests/jest/jest.config.cjs', 'jest.config.ts', 'jest.config.cjs']
const configPath = candidates.find(candidate => existsSync(join(projectRoot, candidate)))
if (!configPath) {
  console.error('Error: Jest config not found in the project tests directory.')
  process.exit(1)
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Jest Project Runner')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`  Config: ${configPath}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const child = spawn('pnpm', ['exec', 'jest', '--config', configPath, ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
})
child.on('error', error => {
  console.error(`Failed to start Jest: ${error.message}`)
  process.exit(1)
})
child.on('close', code => process.exit(code ?? 0))
