import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildCli } from './built-cli.js'

let cliEntry: string
before(() => { cliEntry = buildCli() })

async function fixture(script: string) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark prepare space '))
  const core = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(join(core, 'scripts/build'), { recursive: true })
  await writeFile(join(core, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  await writeFile(join(core, 'scripts/build/registry.mjs'), script)
  // A passing auth readiness check: its behavior is covered by auth-readiness-preflight.test.ts
  await writeFile(join(core, 'scripts/build/auth-readiness.mjs'), '')
  await mkdir(join(core, 'scripts/build/registry/post-build'), { recursive: true })
  await writeFile(join(core, 'scripts/build/registry/write-places.mjs'), `
export function unsafeWritePlaces() { return [] }
export function unsafeWritePlacesLines() { return [] }
`)
  await writeFile(join(core, 'scripts/build/registry/post-build/own-gitignores.mjs'), `
export const BACKUPS_GITIGNORE = '.nextspark/backups/.gitignore'
export const REGISTRIES_GITIGNORE = '.nextspark/registries/.gitignore'
`)
  await writeFile(join(root, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME=from-file\nNODE_ENV=file-value\n')
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

function run(root: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 15_000,
  })
}

test('built CLI exposes prepare and rejects unsupported freshness checks', () => {
  const help = spawnSync(process.execPath, [cliEntry, 'prepare', '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /Generate the current registry output/)
  assert.match(help.stdout, /--production/)
  assert.match(help.stdout, /--watch/)

  const unsupported = spawnSync(process.execPath, [cliEntry, 'prepare', '--check'], { encoding: 'utf8' })
  assert.notEqual(unsupported.status, 0)
  assert.match(unsupported.stderr, /unknown option '--check'/)
})

test('prepare invokes the core registry script once from its core directory with project resolution and production precedence', async () => {
  const project = await fixture(`
import { appendFileSync } from 'node:fs'
appendFileSync(process.env.NEXTSPARK_PROJECT_ROOT + '/runs.txt', JSON.stringify({ cwd: process.cwd(), root: process.env.NEXTSPARK_PROJECT_ROOT, theme: process.env.NEXT_PUBLIC_ACTIVE_THEME, nodeEnv: process.env.NODE_ENV }) + '\\n')
`)
  try {
    const runResult = run(project.root, ['prepare', '--production'], { NEXT_PUBLIC_ACTIVE_THEME: 'from-process', NODE_ENV: 'development' })
    assert.equal(runResult.status, 0, `${runResult.stdout}\n${runResult.stderr}`)
    const runs = (await readFile(join(project.root, 'runs.txt'), 'utf8')).trim().split('\n').map(JSON.parse)
    const resolvedRoot = await realpath(project.root)
    assert.deepEqual(runs, [{
      cwd: join(resolvedRoot, 'node_modules/@nextsparkjs/core'),
      root: resolvedRoot,
      theme: 'from-process',
      nodeEnv: 'production',
    }])
  } finally {
    await project.cleanup()
  }
})

test('a failed prepare reports bounded diagnostics and prevents build from launching Next', async () => {
  const project = await fixture(`
console.log('❌ registry failed at contents/themes/example/templates/page.tsx')
process.exitCode = 7
`)
  await mkdir(join(project.root, 'node_modules/.bin'), { recursive: true })
  await writeFile(join(project.root, 'node_modules/.bin/next'), '#!/bin/sh\necho next-was-run > next-ran.txt\n', { mode: 0o755 })
  try {
    const prepared = run(project.root, ['prepare'])
    assert.equal(prepared.status, 7, `${prepared.stdout}\n${prepared.stderr}`)
    assert.match(`${prepared.stdout}\n${prepared.stderr}`, /registry failed at/)

    const built = run(project.root, ['build'])
    assert.notEqual(built.status, 0)
    await assert.rejects(readFile(join(project.root, 'next-ran.txt'), 'utf8'))
  } finally {
    await project.cleanup()
  }
})

test('build --no-registry preserves the opt-out', async () => {
  const project = await fixture(`throw new Error('registry should not run')`)
  await mkdir(join(project.root, 'node_modules/.bin'), { recursive: true })
  await writeFile(join(project.root, 'node_modules/.bin/next'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  try {
    const built = run(project.root, ['build', '--no-registry'])
    assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`)
  } finally {
    await project.cleanup()
  }
})

test('prepare and generate watch exit successfully after SIGTERM cleans up a watcher that does not trap SIGTERM', { timeout: 15_000 }, async () => {
  const project = await fixture(`
console.log('watcher ready')
setInterval(() => {}, 1000)
`)
  try {
    for (const args of [['prepare', '--watch'], ['generate', '--watch']]) {
      const child = spawn(process.execPath, [cliEntry, ...args], { cwd: project.root, stdio: ['ignore', 'pipe', 'pipe'] })
      let output = ''
      child.stdout.on('data', (chunk) => { output += chunk })
      child.stderr.on('data', (chunk) => { output += chunk })
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error(`watcher did not start: ${output}`)), 5_000)
        const started = setInterval(() => {
          if (!/running|Watching/.test(output) || !/watcher ready/.test(output)) return
          clearTimeout(deadline)
          clearInterval(started)
          resolve()
        }, 25)
      })
      child.kill('SIGTERM')
      const code = await new Promise<number | null>((resolve) => child.on('close', resolve))
      assert.equal(code, 0, `${args.join(' ')}: code=${code}; ${output}`)
    }
  } finally {
    await project.cleanup()
  }
})

test('prepare watch preserves a genuine watcher failure after it starts', { timeout: 15_000 }, async () => {
  const project = await fixture(`
console.log('watcher ready')
setTimeout(() => process.exit(7), 100)
`)
  try {
    const result = run(project.root, ['prepare', '--watch'])
    assert.equal(result.status, 7, `${result.stdout}\n${result.stderr}`)
  } finally {
    await project.cleanup()
  }
})

test('prepare watch does not hide a watcher failure that occurs during requested cleanup', { timeout: 15_000 }, async () => {
  const project = await fixture(`
process.on('SIGTERM', () => process.exit(7))
console.log('watcher ready')
setInterval(() => {}, 1000)
`)
  try {
    const child = spawn(process.execPath, [cliEntry, 'prepare', '--watch'], { cwd: project.root, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    await new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`watcher did not start: ${output}`)), 5_000)
      const started = setInterval(() => {
        if (!/Preparation watcher running/.test(output) || !/watcher ready/.test(output)) return
        clearTimeout(deadline)
        clearInterval(started)
        resolve()
      }, 25)
    })
    child.kill('SIGTERM')
    const code = await new Promise<number | null>((resolve) => child.on('close', resolve))
    assert.equal(code, 7, `code=${code}; ${output}`)
  } finally {
    await project.cleanup()
  }
})
