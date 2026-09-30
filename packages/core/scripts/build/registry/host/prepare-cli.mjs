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
 *   mode: a legacy project (committed src/app) gets its contracts this way, and after its registry build;
 * - --watch: regenerate on source changes (after an initial generation unless --no-initial).
 *
 * Legacy projects (mode.mjs): a core without a route manifest, or a project whose src/app is a
 * committed app tree no generation owns, run the legacy registry build unchanged for generation and
 * --watch, silently (no command converts a committed src/app yet); --check fails saying so.
 *
 * Exit codes: 0 success; 1 failure or check mismatch.
 *
 * @module core/scripts/build/registry/host/prepare-cli
 */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NoCoreRouteManifestError, PrepareError, checkContractsOnly, checkHost, diagnosticLines, prepareContractsOnly, prepareHost, projectHostConfig, watchHost } from './prepare.mjs'
import { resolveHostMode } from './mode.mjs'

const CORE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const args = new Set(process.argv.slice(2))
const flag = name => args.has(`--${name}`)
// The console guard escapes a multi-line argument: print each line with a call of its own.
const errorLines = text => String(text).split('\n').forEach(line => console.error(line))

function legacyRegistryBuild(extra = []) {
  const child = spawn(process.execPath, [join(CORE_ROOT, 'scripts/build/registry.mjs'), ...extra], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: flag('production') ? { ...process.env, NODE_ENV: 'production' } : process.env,
  })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
  child.on('close', async (code, signal) => {
    const status = code ?? (signal ? 1 : 0)
    // The portable contracts do not depend on how src/app is produced: a one-shot legacy build makes them too
    if (status === 0 && !extra.includes('--watch')) {
      try {
        process.exit(await generateContracts())
      } catch (error) {
        errorLines(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    }
    process.exit(status)
  })
}

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
    process.exit(flag('check') ? await checkContractsModule() : await generateContracts())
  }
  const config = projectHostConfig({ projectRoot: process.cwd() })
  const { mode: hostMode } = resolveHostMode({ coreRoot: config.coreRoot, projectRoot: config.projectRoot })

  if (flag('check')) {
    if (hostMode === 'no-manifest') {
      errorLines(`${new NoCoreRouteManifestError(config.coreRoot).message}\nnextspark prepare --check needs a core that generates the host.`)
      process.exit(1)
    }
    if (hostMode === 'legacy-app') {
      errorLines('Legacy mode: src/app is not a generated host, so there is nothing to check it against (not fresh).')
      process.exit(1)
    }
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

  if (hostMode !== 'host') {
    legacyRegistryBuild(flag('watch') ? ['--watch'] : [])
    return
  }

  const mode = flag('production') ? 'production' : 'development'
  const devStatus = flag('dev') && mode === 'development'

  if (!flag('watch') || !flag('no-initial')) {
    try {
      const result = await prepareHost(config, { mode, devStatus })
      console.log(summary(result))
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
      for (const line of contractsLines(result)) console.log(`[prepare] ${line}`)
    },
    onFailure: ({ lines, statusWritten }) => {
      console.error('[prepare] Regeneration failed; the last valid src/app stays in place.')
      for (const line of lines.join('\n').split('\n')) console.error(`[prepare] ${line}`)
      if (statusWritten) console.error('[prepare] The error is shown in the browser until the source is fixed.')
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
