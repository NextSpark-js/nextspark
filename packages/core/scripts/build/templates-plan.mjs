#!/usr/bin/env node

/**
 * What the registry build would change in a project's app/(templates), worked
 * out without writing anything. `nextspark sync:app` runs it to name those
 * changes in --dry-run, and to count them before asking for confirmation.
 *
 * The project comes from NEXTSPARK_PROJECT_ROOT, as for registry.mjs. Stdin
 * carries a JSON object of files under app/, by path from the project root, to
 * read as having that content (null: removed) instead of what is on disk: what
 * the sync about to run leaves there, since the build copies app/ layouts into
 * the tree. The result is printed on a line of its own, after
 * `nextspark-templates-plan:`, as { create, replace, remove } with paths from
 * the project root.
 */

// First, so what any module prints as it loads is escaped too
import '../utils/console-guard.mjs'

import { getConfig } from './registry/config.mjs'
import { discoverTemplates } from './registry/discovery/templates.mjs'
import { planMissingPages } from './registry/post-build/page-generator.mjs'
import { jsonLine, messageLines } from '../utils/index.mjs'

const RESULT_MARKER = 'nextspark-templates-plan:'

async function readAppFiles() {
  if (process.stdin.isTTY) return new Map()

  let input = ''
  for await (const chunk of process.stdin) input += chunk
  return new Map(Object.entries(input.trim() ? JSON.parse(input) : {}))
}

try {
  const appFiles = await readAppFiles()
  const config = getConfig()
  const templates = await discoverTemplates(config)
  const changes = await planMissingPages(templates, config, appFiles)
  console.log(`${RESULT_MARKER}${jsonLine(changes)}`)
} catch (error) {
  for (const line of messageLines(error)) console.error(line)
  process.exit(1)
}
