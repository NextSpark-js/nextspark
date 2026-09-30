#!/usr/bin/env node
/**
 * mobile-boundary.mjs - the mobile app imports portable code only (#203 stage 7b)
 *
 * The check lives in @nextsparkjs/core (packages/core/scripts/build/mobile-boundary.mjs), which ships it: a generated
 * web+mobile project runs it as `nextspark check:mobile`. This is the same check on this repository's layout
 * (apps/mobile, packages/mobile, packages/ui, packages/contracts).
 *
 * Usage:
 *   node scripts/packages/mobile-boundary.mjs      (pnpm mobile:boundary)
 *
 * Exit codes: 0 no violation; 1 a violation, or the sources could not be read.
 */

import { realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkMobileBoundary as check, describeViolations, serverPackageReason } from '../../packages/core/scripts/build/mobile-boundary.mjs'

export { describeViolations, serverPackageReason }
export { MOBILE_TREES } from '../../packages/core/scripts/build/mobile-boundary.mjs'

const SELF_ROOT = join(dirname(realpathSync(fileURLToPath(import.meta.url))), '../..')

/** The check on this repository, or on the repository under `repoRoot` with the same layout. */
export const checkMobileBoundary = ({ repoRoot = SELF_ROOT, ...options } = {}) => check({ repoRoot, ...options })

function main() {
  const { violations, filesChecked } = checkMobileBoundary()
  if (violations.length > 0) {
    console.error(`Mobile boundary: ${violations.length} violation(s). Mobile may import portable contracts and design primitives only.`)
    for (const line of describeViolations(violations)) console.error(`  ${line}`)
    return 1
  }
  console.log(`Mobile boundary: ${filesChecked} files checked, nothing imports server code, the database, the registries, migrations or Node-only modules.`)
  return 0
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main()
