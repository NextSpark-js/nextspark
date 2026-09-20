import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { isMainModule } from './mobile-verify.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const POSIX_ONLY = process.platform === 'win32' ? 'symlinks and sh wrappers are POSIX-only here' : false

test('isMainModule matches a path with a space the way node actually invokes it', () => {
  const argv1 = '/repo/scripts with space/mobile-verify.mjs'
  assert.equal(isMainModule(pathToFileURL(argv1).href, argv1), true)
})

test('isMainModule rejects a path it was not invoked from', () => {
  const argv1 = '/repo/scripts/mobile-verify.mjs'
  assert.equal(isMainModule(pathToFileURL('/repo/scripts/some-other-file.mjs').href, argv1), false)
})

test('isMainModule rejects a module imported without a script path, as from `node -e`', () => {
  assert.equal(isMainModule(pathToFileURL('/repo/scripts/mobile-verify.mjs').href, undefined), false)
})

// Node before 20.13 ignores the { windows } option and converts with this
// platform's rules, so the simulation below needs a node that honors it.
const WINDOWS_PATHS = pathToFileURL('C:\\x', { windows: true }).href === 'file:///C:/x'
  ? false
  : 'this node ignores the { windows } option of pathToFileURL and fileURLToPath'

test('isMainModule matches on Windows, where the file: URL and argv1 disagree on slashes, drive-letter form and percent-encoding', { skip: WINDOWS_PATHS }, () => {
  const argv1 = 'C:\\repo with space\\scripts\\packages\\mobile-verify.mjs'
  const moduleUrl = pathToFileURL(argv1, { windows: true }).href
  assert.equal(isMainModule(moduleUrl, argv1, { windows: true }), true)
  assert.equal(isMainModule(moduleUrl, 'C:\\repo with space\\scripts\\packages\\other.mjs', { windows: true }), false)
})

test('the process-group teardown suite does not expose expected fixture failures as run failures', async () => {
  const { NODE_TEST_CONTEXT, ...env } = process.env
  const fixturePattern = "cancelActiveChildrenAndExit (waits for the active step's finally before exiting|names the children it could not kill before exiting|passes each active child's own handle as killLeader, not just its pid)"
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--test', '--test-reporter=spec', `--test-name-pattern=${fixturePattern}`, join(HERE, 'mobile-verify.test.mjs')],
      { cwd: HERE, env, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, output }))
  })
  const output = result.output.replace(/\x1b\[[0-9;]*m/g, '')

  assert.equal(result.code, 0, output)
  assert.doesNotMatch(output, /(?:^|\n)(?:→ (?:hang|unkillable)|Killed with SIGKILL|✗ (?:hang|unkillable) failed)(?:\n|$)/)
})

test('isMainModule matches a file reached through a symlink, on whichever side node resolved it', { skip: POSIX_ONLY }, () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'mobile-verify-guard-')))
  try {
    const target = join(dir, 'mobile-verify.mjs')
    const link = join(dir, 'mobile-verify-symlink.mjs')
    writeFileSync(target, '')
    symlinkSync(target, link)
    // By default node resolves the link for import.meta.url, not for argv1...
    assert.equal(isMainModule(pathToFileURL(target).href, link), true)
    // ...and under --preserve-symlinks-main it resolves neither.
    assert.equal(isMainModule(pathToFileURL(link).href, link), true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * A throwaway root laid out the way mobile-verify.mjs expects the repo to be,
 * holding a copy of it. Every node:test suite next to the real script has a
 * stand-in there that only appends its own name to suites.log, and
 * apps/mobile/src has a file the template's src lacks. A run of the copy gets
 * past the root-install check, runs whichever suite steps it has against the
 * stand-ins, and then fails for real at the src comparison, before any step
 * that installs or builds. The stand-ins also mean a copy never runs this
 * file again, even though mobile:verify runs it as one of its steps.
 */
let base
let root
let script
let suitesLog

before(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'mobile-verify-entrypoint-')))
  root = join(base, 'repo with space')
  script = join(root, 'scripts/packages/mobile-verify.mjs')
  suitesLog = join(root, 'suites.log')

  mkdirSync(dirname(script), { recursive: true })
  copyFileSync(join(HERE, 'mobile-verify.mjs'), script)
  for (const suite of readdirSync(HERE).filter((name) => name.endsWith('.test.mjs'))) {
    writeFileSync(
      join(root, 'scripts/packages', suite),
      `import { appendFileSync } from 'node:fs'\nappendFileSync(new URL('../../suites.log', import.meta.url), ${JSON.stringify(`${suite}\n`)})\n`,
    )
  }
  for (const manifest of ['packages/mobile/package.json', 'packages/ui/package.json', 'node_modules/react-native/package.json']) {
    mkdirSync(join(root, dirname(manifest)), { recursive: true })
    writeFileSync(join(root, manifest), '{}\n')
  }
  mkdirSync(join(root, 'apps/mobile/src'), { recursive: true })
  writeFileSync(join(root, 'apps/mobile/src/only-in-app.ts'), 'export {}\n')
  mkdirSync(join(root, 'packages/mobile/templates/src'), { recursive: true })
})

after(() => {
  rmSync(base, { recursive: true, force: true })
})

function run(command, args) {
  if (existsSync(suitesLog)) rmSync(suitesLog)
  // This file runs under `node --test`, which sets NODE_TEST_CONTEXT for its
  // children; a `node --test` that inherits it skips its files and exits 0,
  // so the copy's suite steps would pass without running a single stand-in.
  const { NODE_TEST_CONTEXT, ...env } = process.env
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: base, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    // SIGTERM, not SIGKILL: the script's own handler takes its step's process
    // group down with it.
    const timer = setTimeout(() => child.kill('SIGTERM'), 60_000)
    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timer)
      const suites = existsSync(suitesLog) ? readFileSync(suitesLog, 'utf8').split('\n').filter(Boolean) : []
      resolve({ code, output, suites })
    })
  })
}

function assertVerified({ code, output, suites }) {
  assert.match(output, /NextSpark - Mobile Verify/, `main() must run and print its banner:\n${output}`)
  assert.ok(suites.length > 0, `the suite steps must run:\n${output}`)
  assert.match(
    output,
    /apps\/mobile\/src\/only-in-app\.ts has no counterpart/,
    `the src comparison must run against the root the script lives in:\n${output}`,
  )
  assert.equal(code, 1, `a failed step must fail the run:\n${output}`)
}

const entrypoints = [
  ['a path with a space', () => [process.execPath, [script]]],
  ['a symlink to the script', () => {
    const link = join(base, 'mobile-verify-symlink.mjs')
    if (!existsSync(link)) symlinkSync(script, link)
    return [process.execPath, [link]]
  }, POSIX_ONLY],
  ['a symlink to the script under --preserve-symlinks-main', () => {
    const link = join(base, 'mobile-verify-preserved-symlink.mjs')
    if (!existsSync(link)) symlinkSync(script, link)
    return [process.execPath, ['--preserve-symlinks-main', link]]
  }, POSIX_ONLY],
  ['a symlinked directory above the script', () => {
    const linkedRoot = join(base, 'linked-root')
    if (!existsSync(linkedRoot)) symlinkSync(root, linkedRoot, 'dir')
    return [process.execPath, [join(linkedRoot, 'scripts/packages/mobile-verify.mjs')]]
  }, POSIX_ONLY],
  ['a wrapper script that runs it by a relative path, as `pnpm mobile:verify` does', () => {
    const wrapper = join(base, 'mobile-verify-wrapper.sh')
    writeFileSync(wrapper, `#!/bin/sh\ncd "${root}" && exec "${process.execPath}" scripts/packages/mobile-verify.mjs "$@"\n`)
    chmodSync(wrapper, 0o755)
    return [wrapper, []]
  }, POSIX_ONLY],
]

test('mobile:verify runs every node:test suite next to it as a step', async () => {
  const { output, suites } = await run(process.execPath, [script])
  const expected = readdirSync(HERE).filter((name) => name.endsWith('.test.mjs'))
  assert.deepEqual([...suites].sort(), [...expected].sort(), output)
})

for (const [name, entrypoint, skip = false] of entrypoints) {
  test(`mobile:verify runs its steps when invoked through ${name}`, { skip }, async () => {
    const [command, args] = entrypoint()
    assertVerified(await run(command, args))
  })
}
