import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildCli } from './built-cli.js'

/**
 * prepare, build and dev with a core that generates the whole src/app (#203): a stand-in core
 * whose route manifest check says yes and whose host preparation script records how it was run.
 * The script itself is core's (packages/core/scripts/build/registry/host, tested there).
 */

let cliEntry: string
before(() => { cliEntry = buildCli() })

const STUB = `
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
const args = process.argv.slice(2)
appendFileSync(process.cwd() + '/host-runs.txt', JSON.stringify({ args, nodeEnv: process.env.NODE_ENV, cli: process.env.NEXTSPARK_CLI_VERSION ?? null }) + '\\n')
const fail = existsSync(process.cwd() + '/fail-' + (args[0] ?? 'generate').replace(/^--/, ''))
if (fail) {
  console.error('[NS_HOST_ROUTE_COLLISION] src/app/about/page.tsx: two project files provide this route')
  process.exit(1)
}
if (args.includes('--watch')) {
  console.log('[prepare] Watching')
  setInterval(() => {}, 1000)
} else {
  console.log('Generated src/app (3 files) and 1 registries: 3 written, 0 deleted, 0 unchanged.')
}
`

async function hostProject() {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-host-cli-'))
  const core = join(root, 'node_modules/@nextsparkjs/core')
  const write = async (path: string, content: string, mode?: number) => {
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, content, mode ? { mode } : undefined)
  }
  await write(join(core, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  await write(join(core, 'scripts/build/registry.mjs'), "throw new Error('the legacy registry build must not run for a generated host')\n")
  await write(join(core, 'scripts/build/auth-readiness.mjs'), "import { appendFileSync } from 'node:fs'\nappendFileSync(process.cwd() + '/host-runs.txt', JSON.stringify({ auth: true }) + '\\n')\n")
  await write(join(core, 'scripts/build/registry/write-places.mjs'), 'export function unsafeWritePlaces() { return [] }\nexport function unsafeWritePlacesLines() { return [] }\n')
  await write(join(core, 'scripts/build/registry/post-build/own-gitignores.mjs'), "export const BACKUPS_GITIGNORE = '.nextspark/backups/.gitignore'\nexport const REGISTRIES_GITIGNORE = '.nextspark/registries/.gitignore'\nexport function trackedFilesUnder() { return [] }\nexport function trackedRegistriesLines() { return [] }\n")
  // Core decides the mode (mode.mjs, tested in core): a committed src/app no generation owns is legacy
  await write(join(core, 'scripts/build/registry/host/mode.mjs'), `
import { existsSync } from 'node:fs'
import { join } from 'node:path'
export function resolveHostMode({ projectRoot }) {
  if (existsSync(join(projectRoot, 'src/app/layout.tsx')) && !existsSync(join(projectRoot, '.nextspark/generation.json'))) {
    return { mode: 'legacy-app', reason: 'committed' }
  }
  return { mode: 'host', reason: 'generated' }
}
`)
  await write(join(core, 'scripts/build/registry/host/prepare-cli.mjs'), STUB)
  await write(join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  await write(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '16.3.5' } }))
  await write(join(root, 'node_modules/.bin/next'), '#!/bin/sh\necho "$@" >> next-runs.txt\n', 0o755)
  return {
    root,
    runs: async () => (existsSync(join(root, 'host-runs.txt')) ? (await readFile(join(root, 'host-runs.txt'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line)) : []),
    nextRuns: async () => (existsSync(join(root, 'next-runs.txt')) ? (await readFile(join(root, 'next-runs.txt'), 'utf8')).trim().split('\n') : []),
    fail: (step: string) => writeFile(join(root, `fail-${step}`), ''),
    cleanup: () => rm(root, { recursive: true, force: true }),
  }
}

function run(root: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(process.execPath, [cliEntry, ...args], { cwd: root, env: { ...process.env, FORCE_COLOR: '0', ...env }, encoding: 'utf8', timeout: 30_000 })
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` }
}

test('prepare runs core host preparation (not the legacy registry build), recording the CLI version; --production then checks auth readiness', async () => {
  const project = await hostProject()
  try {
    const prepared = run(project.root, ['prepare'])
    assert.equal(prepared.status, 0, prepared.output)
    assert.match(prepared.output, /src\/app and registries prepared/)
    assert.match(prepared.output, /Generated src\/app \(3 files\)/)
    const production = run(project.root, ['prepare', '--production'], { NODE_ENV: 'development' })
    assert.equal(production.status, 0, production.output)
    const runs = await project.runs()
    assert.deepEqual(runs.map((entry) => entry.args ?? 'auth'), [[], ['--production'], 'auth'])
    assert.equal(runs[1].nodeEnv, 'production')
    assert.match(runs[0].cli, /^\d+\.\d+\.\d+/)
  } finally {
    await project.cleanup()
  }
})

test('prepare --check passes the verdict through: 0 up to date, 1 with what is stale', async () => {
  const project = await hostProject()
  try {
    const ok = run(project.root, ['prepare', '--check'])
    assert.equal(ok.status, 0, ok.output)
    assert.match(ok.output, /up to date/)
    await project.fail('check')
    const stale = run(project.root, ['prepare', '--check'])
    assert.equal(stale.status, 1, stale.output)
    assert.match(stale.output, /not up to date/)
    assert.match(stale.output, /NS_HOST_ROUTE_COLLISION/)
    assert.deepEqual((await project.runs()).map((entry) => entry.args), [['--check'], ['--check']])
  } finally {
    await project.cleanup()
  }
})

test('build: prepare --production must succeed before next build; --no-registry requires an up-to-date host', async () => {
  const project = await hostProject()
  try {
    const built = run(project.root, ['build'], { NEXTSPARK_AUTH_PREFLIGHT: 'off' })
    assert.equal(built.status, 0, built.output)
    const [nextBuild] = await project.nextRuns()
    assert.match(nextBuild, /^build\b/)
    assert.equal((await project.nextRuns()).length, 1)

    const skipped = run(project.root, ['build', '--no-registry'])
    assert.equal(skipped.status, 0, skipped.output)
    assert.equal((await project.nextRuns()).length, 2)

    await project.fail('production')
    const failed = run(project.root, ['build'])
    assert.equal(failed.status, 1, failed.output)
    assert.match(failed.output, /NS_HOST_ROUTE_COLLISION/)

    await project.fail('check')
    const stale = run(project.root, ['build', '--no-registry'])
    assert.equal(stale.status, 1, stale.output)
    assert.match(stale.output, /not up to date/)

    assert.equal((await project.nextRuns()).length, 2, 'next build never runs after a failed preparation')
    assert.deepEqual((await project.runs()).filter((entry) => entry.args).map((entry) => entry.args), [['--production'], ['--check'], ['--production'], ['--check']])
  } finally {
    await project.cleanup()
  }
})

test('dev: the first generation is fatal on failure; then a watcher regenerates alongside next dev', async () => {
  const project = await hostProject()
  try {
    const started = run(project.root, ['dev', '-p', '4391'])
    assert.equal(started.status, 0, started.output)
    assert.deepEqual((await project.runs()).map((entry) => entry.args), [['--dev'], ['--dev', '--watch', '--no-initial']])
    const nextRuns = await project.nextRuns()
    assert.equal(nextRuns.length, 1)
    assert.match(nextRuns[0], /^dev .*-p 4391/)

    assert.doesNotMatch(started.output, /--registry has no effect/)
    for (const args of [['dev', '--registry', '-p', '4391'], ['dev:registry', '-p', '4391']]) {
      const legacyFlag = run(project.root, args)
      assert.equal(legacyFlag.status, 0, legacyFlag.output)
      assert.match(legacyFlag.output, /--registry has no effect with this core: nextspark dev always watches and regenerates src\/app/)
    }
    assert.equal((await project.runs()).filter((entry) => entry.args?.includes('--watch')).length, 3, 'the host watcher, never the legacy registry watcher')

    await project.fail('dev')
    const failed = run(project.root, ['dev', '-p', '4391'])
    assert.equal(failed.status, 1, failed.output)
    assert.match(failed.output, /the dev server was not started/)
    assert.match(failed.output, /NS_HOST_ROUTE_COLLISION/)
    assert.equal((await project.nextRuns()).length, 3, 'next dev did not start after the failed generation')
  } finally {
    await project.cleanup()
  }
})

test('dev with a core that only builds registries: a failed registry build no longer starts Next anyway', async () => {
  const project = await hostProject()
  try {
    await rm(join(project.root, 'node_modules/@nextsparkjs/core/scripts/build/registry/host'), { recursive: true })
    await writeFile(join(project.root, 'node_modules/@nextsparkjs/core/scripts/build/registry.mjs'), "console.log('❌ registry failed at templates/page.tsx')\nprocess.exit(3)\n")
    for (const args of [['dev', '-p', '4392'], ['dev', '--registry', '-p', '4392']]) {
      const failed = run(project.root, args)
      assert.equal(failed.status, 1, failed.output)
      assert.match(failed.output, /Registry build failed; the dev server was not started/)
      assert.match(failed.output, /registry failed at templates\/page\.tsx/)
    }
    assert.deepEqual(await project.nextRuns(), [])
  } finally {
    await project.cleanup()
  }
})

test('prepare --watch generates first (no --no-initial); only dev, which just generated, skips it', { timeout: 30_000 }, async () => {
  const project = await hostProject()
  try {
    const child = spawn(process.execPath, [cliEntry, 'prepare', '--watch'], { cwd: project.root, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    await new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`watcher did not start: ${output}`)), 10_000)
      const poll = setInterval(() => {
        if (!/\[prepare\] Watching/.test(output)) return
        clearTimeout(deadline)
        clearInterval(poll)
        resolve()
      }, 25)
    })
    child.kill('SIGTERM')
    await new Promise((resolve) => child.on('close', resolve))
    assert.deepEqual((await project.runs()).map((entry) => entry.args), [['--watch']])

    const dev = run(project.root, ['dev', '-p', '4393'])
    assert.equal(dev.status, 0, dev.output)
    assert.deepEqual((await project.runs()).map((entry) => entry.args).slice(1), [['--dev'], ['--dev', '--watch', '--no-initial']])
  } finally {
    await project.cleanup()
  }
})

test('prepare --check targets the production host; --check --dev the one nextspark dev writes; --dev alone is refused', async () => {
  const project = await hostProject()
  try {
    assert.equal(run(project.root, ['prepare', '--check']).status, 0)
    assert.equal(run(project.root, ['prepare', '--check', '--dev']).status, 0)
    const alone = run(project.root, ['prepare', '--dev'])
    assert.equal(alone.status, 1, alone.output)
    assert.match(alone.output, /--dev only applies to --check/)
    assert.deepEqual((await project.runs()).map((entry) => entry.args), [['--check'], ['--check', '--dev']])
  } finally {
    await project.cleanup()
  }
})

test('a host --check rejects (e.g. an interrupted publication) never reaches next: build --no-registry stops, build and dev regenerate first', async () => {
  const project = await hostProject()
  try {
    // core's check reports an interrupted publication as not fresh (host-robustness.test.mjs); here it answers 1
    await project.fail('check')
    const skipped = run(project.root, ['build', '--no-registry'])
    assert.equal(skipped.status, 1, skipped.output)
    assert.deepEqual(await project.nextRuns(), [])
    // build and dev always run prepare before next, which completes the publication
    assert.equal(run(project.root, ['build'], { NEXTSPARK_AUTH_PREFLIGHT: 'off' }).status, 0)
    assert.equal(run(project.root, ['dev', '-p', '4394']).status, 0)
    const runs = (await project.runs()).filter((entry) => entry.args).map((entry) => entry.args)
    assert.deepEqual(runs, [['--check'], ['--production'], ['--dev'], ['--dev', '--watch', '--no-initial']])
    assert.equal((await project.nextRuns()).length, 2)
  } finally {
    await project.cleanup()
  }
})

test('a committed src/app no generation owns: prepare, build and dev take the legacy registry build silently; --check reports legacy mode', async () => {
  const project = await hostProject()
  try {
    await writeFile(join(project.root, 'node_modules/@nextsparkjs/core/scripts/build/registry.mjs'), "import { appendFileSync } from 'node:fs'\nappendFileSync(process.cwd() + '/host-runs.txt', JSON.stringify({ legacy: true }) + '\\n')\nconsole.log('✅ legacy registry build')\n")
    await mkdir(join(project.root, 'src/app'), { recursive: true })
    await writeFile(join(project.root, 'src/app/layout.tsx'), 'export default function Layout({ children }) { return children }\n')
    const advice = (output: string) => /nextspark migrate|legacy path will be removed/.test(output)

    const checked = run(project.root, ['prepare', '--check'])
    assert.equal(checked.status, 1, checked.output)
    assert.match(checked.output, /Legacy mode: src\/app is not a generated host/)
    assert.equal(advice(checked.output), false)

    for (const args of [['prepare'], ['build'], ['dev', '-p', '4395']]) {
      const result = run(project.root, args, { NEXTSPARK_AUTH_PREFLIGHT: 'off' })
      assert.equal(result.status, 0, `${args.join(' ')}: ${result.output}`)
      assert.equal(advice(result.output), false, `${args.join(' ')}: silent, exactly as before the generated host`)
    }
    const runs = await project.runs()
    // The generated host is never produced, but the portable contracts do not depend on how src/app is made:
    // `prepare` (and only it) runs the script for them, contracts only
    assert.deepEqual(runs.filter((entry) => entry.args).map((entry) => entry.args), [['--contracts-only']], 'the host preparation script ran once, for the contracts, and never for the host')
    assert.equal(runs.filter((entry) => entry.legacy).length, 3, 'the legacy registry build ran for prepare, build and dev')
    assert.equal((await project.nextRuns()).length, 2, 'build and dev still start next')
  } finally {
    await project.cleanup()
  }
})
