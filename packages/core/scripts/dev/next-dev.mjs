#!/usr/bin/env node
/**
 * Next.js Dev Server Wrapper
 *
 * Loads environment variables from .env and starts Next.js dev server
 * with the correct PORT. This is needed because concurrently doesn't
 * pass environment variables properly to subprocesses.
 *
 * Usage:
 *   node scripts/next-dev.mjs
 *
 * Port Configuration:
 *   - Reads PORT from .env.local or .env (via dotenv)
 *   - Defaults to 5173 if PORT is not set
 */

import { spawn } from 'child_process'
import { config } from 'dotenv'
import { projectEnvFiles } from '../utils/env-files.mjs'
import { packageManagerCommand } from '../utils/package-manager.mjs'

// .env.local before .env, as Next.js reads them; an exported variable still wins
config({ path: projectEnvFiles() })

const port = process.env.PORT || 5173

console.log(`Starting Next.js dev server on port ${port}...`)

const npx = packageManagerCommand('npx', ['next', 'dev', '--turbopack', '-p', String(port)])
const child = spawn(npx.command, npx.args, {
  stdio: 'inherit',
  shell: npx.shell, windowsHide: npx.windowsHide
})

child.on('close', (code) => {
  process.exit(code)
})
