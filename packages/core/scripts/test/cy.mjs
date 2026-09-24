#!/usr/bin/env node
/** Run the current root-first project's Cypress suite. */

import { spawn, execFileSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import { join, relative, resolve } from 'path'
import { findProjectRoot } from '../build/registry/project-mode.mjs'

const projectRoot = findProjectRoot(process.cwd())
let command = process.argv[2] || 'open'
const port = process.env.PORT || 5173
const configPath = join(projectRoot, 'tests/cypress.config.ts')
const specsRoot = join(projectRoot, 'tests/cypress/e2e')
const allureResultsPath = join(projectRoot, 'tests/cypress/allure-results')
let extraArgs = []

if (command === 'tags') {
  const tag = process.argv[3]
  if (!tag) {
    console.error('\x1b[31mError: Tag argument required\x1b[0m')
    console.error('Usage: pnpm cy:tags "@smoke"')
    process.exit(1)
  }
  command = 'run'
  extraArgs = ['--env', `grepTags=${tag}`]
  process.argv.splice(3, 1)
}

if (command === 'e2e') {
  console.log('\x1b[36m🧪 Running project E2E tests\x1b[0m')
  execFileSync('node', [join(projectRoot, 'scripts/build-test-entities.mjs')], { cwd: projectRoot, stdio: 'inherit' })
  execFileSync('pnpm', ['exec', 'start-server-and-test', 'pnpm dev', `http://localhost:${port}`, 'pnpm cy:run'], {
    cwd: projectRoot,
    stdio: 'inherit',
  })
  process.exit(0)
}

if (!existsSync(configPath)) {
  console.error(`\x1b[31mError: Cypress config not found: ${relative(projectRoot, configPath)}\x1b[0m`)
  process.exit(1)
}

function resolveSpecPath(specPath) {
  if (resolve(specPath).startsWith(resolve(specsRoot))) return specPath
  return join(specsRoot, specPath.replace(/^[/\\]+/, ''))
}

function processSpecArgs(args) {
  const processed = [...args]
  for (let i = 0; i < processed.length; i++) {
    if (processed[i] === '--spec' && processed[i + 1]) {
      processed[i + 1] = resolveSpecPath(processed[i + 1])
    }
  }
  return processed
}

if (command === 'run' && existsSync(allureResultsPath)) {
  rmSync(allureResultsPath, { recursive: true, force: true })
}

const cliArgs = processSpecArgs([...extraArgs, ...process.argv.slice(3)])
const child = spawn('pnpm', ['exec', 'cypress', command, '--config-file', configPath, ...cliArgs], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
child.on('close', code => process.exit(code ?? 1))
