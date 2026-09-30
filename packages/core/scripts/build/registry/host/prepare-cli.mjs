#!/usr/bin/env node
// First, so what any module prints as it loads is escaped too
import '../../../utils/console-guard.mjs'

/**
 * The script `nextspark prepare`, `build` and `dev` run from the installed core, in the project
 * root:
 *
 *   node <core>/scripts/build/registry/host/prepare-cli.mjs [--check] [--production] [--dev] [--watch] [--no-initial]
 *
 * - (default) generate and publish src/app and the registries (development mode);
 * - --production: the registry build runs with NODE_ENV=production;
 * - --check: write nothing; exit 0 when src/app and the registries match what `prepare` would
 *   generate, 1 listing what is missing, stale or foreign (with --dev: what `nextspark dev` writes);
 * - --dev: include the development status module (nextspark dev only);
 * - --contracts-only: generate (or with --check, compare) only the portable contracts module, in any
 *   host mode; it never touches src/app;
 * - --watch: regenerate on source changes (after an initial generation unless --no-initial).
 *
 * A project whose src/app is a committed app tree no generation owns (mode.mjs `legacy-app`) is not
 * prepared: every option fails with a message pointing to `nextspark migrate`, which converts it. A
 * core without a route manifest cannot generate the host at all and fails the same way.
 *
 * Exit codes: 0 success; 1 failure or check mismatch.
 *
 * @module core/scripts/build/registry/host/prepare-cli
 */


import { NoCoreRouteManifestError, PrepareError, checkContractsOnly, checkHost, diagnosticLines, prepareContractsOnly, prepareHost, projectHostConfig, watchHost } from './prepare.mjs'
import { LEGACY_APP_MESSAGE, resolveHostMode } from './mode.mjs'
import { unsafeWritePlaces, unsafeWritePlacesLines } from '../write-places.mjs'

const args = new Set(process.argv.slice(2))
const flag = name => args.has(`--${name}`)
// The console guard escapes a multi-line argument: print each line with a call of its own.
const errorLines = text => String(text).split('\n').forEach(line => console.error(line))

/** Generate only the contracts module; the exit code. */
async function generateContracts() {
  const config = projectHostConfig({ projectRoot: process.cwd() })
  try {
    for (const line of contractsLines({ contracts: await prepareContractsOnly(config) })) console.log(line)
    return 0
  } catch (error) {
    if (!(error instanceof PrepareError)) throw error
    printFailure(error)
    return 1
  }
}

/** Compare only the contracts module with what prepare generates; the exit code. */
async function checkContractsModule() {
  const config = projectHostConfig({ projectRoot: process.cwd() })
  const result = await checkContractsOnly(config)
  if (result.ok) {
    console.log('The portable contracts match what nextspark prepare generates.')
    return 0
  }
  console.error(result.problems.some(problem => problem.state === 'missing' && problem.path.endsWith('contracts.generation.json')) ? 'The portable contracts have not been generated: run nextspark prepare.' : 'The portable contracts differ from what nextspark prepare generates:')
  for (const problem of result.problems) errorLines(`  ${problem.state.padEnd(8)} ${problem.path ?? ''}${problem.path ? ': ' : ''}${problem.detail}`)
  console.error('Run nextspark prepare to regenerate.')
  return 1
}

function printFailure(error) {
  errorLines(diagnosticLines(error).join('\n'))
}

function summary(result) {
  const app = result.files.filter(file => file.path.startsWith('src/app/')).length
  const registries = result.files.length - app
  return `Generated src/app (${app} files) and ${registries} registries: ${result.written.length} written, ${result.deleted.length} deleted, ${result.unchanged} unchanged. Recorded in .nextspark/generation.json.`
}

/** The plan's notices (information, not problems), as terminal lines. */
function noticeLines(result) {
  return (result.notices ?? []).map(notice => `Info: [${notice.code}] ${notice.message}`)
}

/** The contracts module line (and its warnings), when the host generates one. */
function contractsLines(result) {
  const contracts = result.contracts
  if (!contracts) return []
  return [
    `Generated the portable contracts (${contracts.files} files) in ${contracts.label}: ${contracts.written.length} written, ${contracts.deleted.length} deleted, ${contracts.unchanged} unchanged.`,
    ...contracts.warnings.map(warning => `Warning: contracts: ${warning}`),
  ]
}

async function main() {
  if (flag('contracts-only')) {
    if (flag('watch') || flag('dev')) {
      errorLines('--contracts-only generates or checks once: it cannot be combined with --watch or --dev')
      process.exit(1)
    }
  }
  const config = projectHostConfig({ projectRoot: process.cwd() })
  const { mode: hostMode } = resolveHostMode({ coreRoot: config.coreRoot, projectRoot: config.projectRoot })
  if (flag('contracts-only')) {
    // One rule for every prepare flavour: a committed app tree is migrated first
    if (hostMode === 'legacy-app') {
      errorLines(LEGACY_APP_MESSAGE)
      process.exit(1)
    }
    process.exit(flag('check') ? await checkContractsModule() : await generateContracts())
  }

  if (hostMode === 'no-manifest') {
    errorLines(`${new NoCoreRouteManifestError(config.coreRoot).message}\nnextspark prepare needs a core that generates the host.`)
    process.exit(1)
  }
  if (hostMode === 'legacy-app') {
    errorLines(LEGACY_APP_MESSAGE)
    process.exit(1)
  }

  if (flag('check')) {
    const result = await checkHost(config, { dev: flag('dev') })
    if (result.ok) {
      console.log(`src/app and the registries${config.contracts ? ' and the portable contracts' : ''} match what nextspark prepare generates.`)
      process.exit(0)
    }
    const notPrepared = result.problems.some(problem => problem.state === 'not-prepared')
    console.error(notPrepared ? 'src/app has not been generated: run nextspark prepare.' : 'src/app, the registries or the contracts differ from what nextspark prepare generates:')
    for (const problem of result.problems.filter(problem => problem.state !== 'not-prepared')) {
      errorLines(`  ${problem.state.padEnd(8)} ${problem.path ?? ''}${problem.path ? ': ' : ''}${problem.detail}`)
    }
    if (!notPrepared) console.error('Run nextspark prepare to regenerate.')
    process.exit(1)
  }

  // Nothing is written, in the project or through it, while a place the preparation writes under can't
  // take it safely (a symlink, something of another kind, a .gitignore that would not keep the registries out of git)
  const unsafe = unsafeWritePlaces(config.projectRoot)
  if (unsafe.length > 0) {
    errorLines("Preparation failed before writing anything: nextspark prepare can't write safely under these paths")
    for (const line of unsafeWritePlacesLines(unsafe)) errorLines(`   ${line}`)
    process.exit(1)
  }

  const mode = flag('production') ? 'production' : 'development'
  const devStatus = flag('dev') && mode === 'development'

  let printedNotices = null
  if (!flag('watch') || !flag('no-initial')) {
    try {
      const result = await prepareHost(config, { mode, devStatus })
      console.log(summary(result))
      for (const line of noticeLines(result)) console.log(line)
      printedNotices = noticeLines(result).join('\n')
      for (const line of contractsLines(result)) console.log(line)
    } catch (error) {
      if (!(error instanceof PrepareError)) throw error
      printFailure(error)
      process.exit(1)
    }
    if (!flag('watch')) return
  }

  const watcher = watchHost(config, {
    devStatus,
    onSuccess: result => {
      console.log(`[prepare] ${result.changed.length > 0 ? `${result.changed.length} change(s): ` : ''}${summary(result)}`)
      // Printed when they change, not on every regeneration
      const notices = noticeLines(result).join('\n')
      if (notices !== printedNotices && notices) for (const line of notices.split('\n')) console.log(`[prepare] ${line}`)
      printedNotices = notices
      for (const line of contractsLines(result)) console.log(`[prepare] ${line}`)
    },
    onFailure: ({ error, lines, statusWritten }) => {
      console.error('[prepare] Regeneration failed; the last valid src/app stays in place.')
      for (const line of lines.join('\n').split('\n')) console.error(`[prepare] ${line}`)
      if (statusWritten) console.error('[prepare] The error is shown in the browser until the source is fixed.')
      else if (error?.parseError) console.error('[prepare] Next.js shows the syntax error in the browser; src/app is regenerated once the source parses again.')
    },
  })
  console.log('[prepare] Watching templates/, api/, plugins/, entities/, config/ and nextspark.config.ts for changes.')
  const stop = () => {
    watcher.close()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch(error => {
  errorLines(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
