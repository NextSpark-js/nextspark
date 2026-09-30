#!/usr/bin/env node
/**
 * `nextspark dev` recovery, end to end (#203).
 *
 * Checks over HTTP, against a running dev server with the prepare watcher in dev mode:
 *
 * 1. a source that stops parsing and is then fixed: the fix is served within the timeout. Turbopack kept
 *    serving the code from before the error when the watcher rewrote a module of the graph (the dev
 *    diagnostic module) while another one did not parse;
 * 2. an error only prepare detects (an export a page may not have): the NextSpark status panel is
 *    rendered, and it is gone once the source is fixed.
 *
 * Only JSX changes between steps (a marker attribute on the page's first element), never exports: the
 * facade stays byte-identical, as when a user fixes a typo.
 *
 * What guards what:
 * - the regression guard of that Turbopack failure is the unit test with its negative control in
 *   packages/core/scripts/build/registry/host/__tests__/host-robustness.test.mjs ("... does not parse writes nothing");
 * - `--project <dir>` is the manual reproduction: an installed project (e.g. one created from local tarballs) with
 *   its own `nextspark dev` (its next.config decides the cache mode). It is where the failure reproduced; restore
 *   the fix out of core to see it fail. `--break-file <path>` breaks another source instead of the page (a config
 *   the registries import, an entity config) and checks that the page recovers once it parses again;
 * - the default target, a temporary copy of the host-conformance fixture with what `nextspark dev` runs (the
 *   prepare watcher `watchHost` with the dev status module, and `next dev`) per bundler and cache mode, does NOT
 *   reproduce the failure: it passes without the fix. It checks recovery and the panel in general.
 *
 * Cleanup: every dev server (its process group and every process under it) is stopped, every copy removed and the
 * project's files restored, also on failure, on SIGINT/SIGTERM and when the global watchdog (`--max-ms`) fires.
 * Exit code 0 when every check passes.
 *
 * Usage:
 *   node scripts/performance/dev-recovery-e2e.mjs [--bundlers turbopack,webpack] [--modes cc,isr] [--timeout-ms 30000] [--max-ms N]
 *   node scripts/performance/dev-recovery-e2e.mjs --project <dir> [--page 'templates/(public)/page.tsx'] [--path /]
 *     [--break-file <path under the project>] [--bundlers ...] [--timeout-ms 30000] [--max-ms N]
 */
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = join(fileURLToPath(import.meta.url), '../../..')
const FIXTURES = join(REPO_ROOT, 'packages/core/tests/fixtures')
const FIXTURE = join(FIXTURES, 'host-conformance')
const PANEL = 'data-nextspark-generation-status'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}
const BUNDLERS = option('bundlers', 'turbopack,webpack').split(',')
const MODES = option('modes', 'cc,isr').split(',')
const TIMEOUT_MS = Number(option('timeout-ms', '30000'))
const PROJECT = option('project', null) && realpathSync(resolve(option('project')))
const BREAK_FILE = option('break-file', null)
const RUNS = PROJECT ? BUNDLERS.map(bundler => [bundler]) : BUNDLERS.flatMap(bundler => MODES.map(mode => [bundler, mode]))
// Per run: first compile (up to 4 min), arming (1 min) and six waits of the timeout, plus slack
const MAX_MS = Number(option('max-ms', String(RUNS.length * (300_000 + 6 * TIMEOUT_MS) + 60_000)))

const sleep = ms => new Promise(done => setTimeout(done, ms))

// ---------------------------------------------------------------------------
// Cleanup: runs once, from `finally`, a signal or the watchdog
// ---------------------------------------------------------------------------

const cleanups = new Set()
/** Register `fn` to run on cleanup; returns a function that runs it now (once) and unregisters it. */
function onCleanup(fn) {
  let done = false
  const run = async () => {
    if (done) return
    done = true
    cleanups.delete(run)
    await fn()
  }
  cleanups.add(run)
  return run
}
async function cleanupAll() {
  for (const run of [...cleanups].reverse()) {
    try {
      await run()
    } catch (error) {
      console.error(`cleanup: ${error.message}`)
    }
  }
}
let exiting = false
async function abort(reason, code) {
  if (exiting) return
  exiting = true
  console.error(`\n${reason}: stopping dev servers, restoring files, removing copies`)
  await cleanupAll()
  process.exit(code)
}
process.on('SIGINT', () => void abort('SIGINT', 130))
process.on('SIGTERM', () => void abort('SIGTERM', 143))
setTimeout(() => void abort(`watchdog: still running after ${MAX_MS} ms`, 1), MAX_MS).unref()

/** Every process under `pid` (children, grandchildren, ...), from one `ps` listing. */
function descendants(pid) {
  const listing = spawnSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).stdout ?? ''
  const children = new Map()
  for (const line of listing.split('\n')) {
    const [child, parent] = line.trim().split(/\s+/).map(Number)
    if (!child || !parent) continue
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent).push(child)
  }
  const found = []
  const queue = [pid]
  while (queue.length > 0) {
    for (const child of children.get(queue.shift()) ?? []) {
      found.push(child)
      queue.push(child)
    }
  }
  return found
}

const signal = (pid, name) => {
  try {
    process.kill(pid, name)
  } catch {}
}

/** Stop a dev server started with `detached: true`: its process group, and every process that was under it. */
async function stop(child) {
  if (!child?.pid) return
  const tree = [child.pid, ...descendants(child.pid)]
  signal(-child.pid, 'SIGTERM')
  for (const pid of tree) signal(pid, 'SIGTERM')
  await sleep(1500)
  signal(-child.pid, 'SIGKILL')
  for (const pid of tree) signal(pid, 'SIGKILL')
}

// ---------------------------------------------------------------------------
// HTTP and the scenarios
// ---------------------------------------------------------------------------

function freePort() {
  return new Promise((done, fail) => {
    const server = createServer()
    server.on('error', fail)
    server.listen(0, () => {
      const { port } = server.address()
      server.close(() => done(port))
    })
  })
}

async function get(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    return { status: response.status, body: await response.text() }
  } catch (error) {
    return { status: 0, body: String(error) }
  }
}

/** Poll `probe` until it returns a truthy value or `ms` pass; returns [value, elapsed ms]. */
async function until(probe, ms, every = 500) {
  const start = Date.now()
  for (;;) {
    const value = await probe()
    if (value) return [value, Date.now() - start]
    if (Date.now() - start > ms) return [null, Date.now() - start]
    await sleep(every)
  }
}

/** The template with `data-dev-recovery="<marker>"` on the first JSX element after its first `return`. */
function withMarker(source, marker) {
  const from = source.indexOf('return')
  const match = /<([a-z][a-z0-9]*)(?=[\s>/])/.exec(source.slice(from))
  if (from === -1 || !match) throw new Error('the page has no JSX element after a return to mark')
  const at = from + match.index + match[0].length
  return `${source.slice(0, at)} data-dev-recovery="${marker}"${source.slice(at)}`
}

const BROKEN = '\nexport const broken = (\n'

/**
 * The two scenarios on a running server. `failures()` counts the watcher's failed regenerations so far; `breakFile`
 * (default: the page) is the source made unparsable in scenario 1.
 */
async function scenarios({ label, url, page, breakFile = page, failures, log, results }) {
  const check = (name, ok, detail) => {
    results.push({ label, name, ok: Boolean(ok), detail })
    console.log(`${ok ? 'PASS' : 'FAIL'} [${label}] ${name}${detail ? ` (${detail})` : ''}`)
  }
  const original = readFileSync(page, 'utf8')
  const breakOriginal = readFileSync(breakFile, 'utf8')
  const served = marker => async () => {
    const response = await get(url)
    return response.status === 200 && response.body.includes(marker) && !response.body.includes(PANEL) ? true : null
  }

  const [first, firstMs] = await until(async () => ((await get(url)).status === 200 ? true : null), 240_000, 1000)
  check(`first ${new URL(url).pathname}`, first, `${firstMs} ms`)
  if (!first) throw new Error(`the dev server never answered ${url}:\n${log.join('').slice(-3000)}`)

  // The watcher arms asynchronously: change the page until an edit is served.
  let armedMarker = null
  const [armed] = await until(async () => {
    const marker = `armed-${Date.now()}`
    writeFileSync(page, withMarker(original, marker))
    const [ok] = await until(served(marker), 5000, 500)
    if (ok) armedMarker = marker
    return ok
  }, 60_000, 0)
  check('an edit is served (watcher and dev server running)', armed)

  // 1. A syntax error, then the fix
  const before = failures()
  if (breakFile === page) writeFileSync(page, `${withMarker(original, 'broken')}${BROKEN}`)
  else writeFileSync(breakFile, `${breakOriginal}${BROKEN}`)
  const [reported] = await until(() => (failures() > before ? true : null), breakFile === page ? TIMEOUT_MS : 10_000)
  // A page that does not parse always fails the regeneration; another source may not be read by prepare at all
  // (config/*.config.ts, plugin.config.ts are only imported by the app), which is informational
  if (breakFile === page) check(`syntax error in ${relative(PROJECT ?? FIXTURES, breakFile)} reported by the watcher`, reported)
  else console.log(`INFO [${label}] the watcher ${reported ? 'reported' : 'did not report'} a failed regeneration for ${relative(PROJECT, breakFile)}`)
  const [broken] = await until(async () => ((await get(url)).status === 500 ? true : null), TIMEOUT_MS, 1000)
  check('syntax error answers 500 (Next reports it)', broken)
  await sleep(3000) // let the dev server settle on the error, as a user reading it would
  let expected = armedMarker
  if (breakFile === page) {
    expected = `fixed-${Date.now()}`
    writeFileSync(page, withMarker(original, expected))
  } else writeFileSync(breakFile, breakOriginal)
  const [recovered, recoveredMs] = await until(served(expected), TIMEOUT_MS, 1000)
  check(`the fix is served within ${TIMEOUT_MS} ms`, recovered, `${recoveredMs} ms`)

  // 2. An error only prepare detects: the NextSpark panel, then its removal
  writeFileSync(page, `${withMarker(original, 'invalid')}\nexport const notAllowed = 1\n`)
  const [panel, panelMs] = await until(async () => ((await get(url)).body.includes(PANEL) ? true : null), TIMEOUT_MS, 1000)
  check('prepare-only error shows the NextSpark status panel', panel, `${panelMs} ms`)
  const again = `again-${Date.now()}`
  writeFileSync(page, withMarker(original, again))
  const [cleared, clearedMs] = await until(served(again), TIMEOUT_MS, 1000)
  check('panel gone and the fix served', cleared, `${clearedMs} ms`)
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

async function runFixture(bundler, mode, results) {
  const { prepareHost, watchHost } = await import(join(REPO_ROOT, 'packages/core/scripts/build/registry/host/prepare.mjs'))
  const nextBin = createRequire(join(REPO_ROOT, 'packages/core/package.json')).resolve('next/dist/bin/next')
  // A sibling of the fixture, so its relative paths (../source, ../fake-core, ../../../scripts) and
  // packages/core's node_modules resolve as they do for the fixture itself.
  const copy = join(FIXTURES, `.dev-recovery-${process.pid}-${bundler}-${mode}`)
  const skip = /(^|\/)(generated\/src|generated\/\.nextspark|\.next-[^/]*|\.report|\.probe|next-env\.d\.ts)(\/|$)/
  const removeCopy = onCleanup(() => rmSync(copy, { recursive: true, force: true }))
  cpSync(FIXTURE, copy, { recursive: true, filter: source => !skip.test(relative(FIXTURE, source).split(sep).join('/')) })
  let failed = 0
  const log = []
  let watcher = null
  const closeWatcher = onCleanup(() => watcher?.close())
  let next = null
  const stopNext = onCleanup(() => stop(next))
  try {
    const { fixtureHostConfig } = await import(pathToFileURL(join(copy, 'plan.mjs')).href)
    const config = fixtureHostConfig()
    await prepareHost(config, { devStatus: true })
    watcher = watchHost(config, { debounceMs: 100, devStatus: true, onFailure: () => (failed += 1) })
    const port = await freePort()
    next = spawn(process.execPath, [nextBin, 'dev', bundler === 'webpack' ? '--webpack' : '--turbopack', '-p', String(port)], {
      cwd: join(copy, 'generated'),
      env: { ...process.env, HOST_CACHE_MODE: mode, HOST_BUNDLER: bundler, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })
    for (const stream of [next.stdout, next.stderr]) stream.on('data', chunk => log.push(String(chunk)))
    await scenarios({ label: `fixture ${bundler} ${mode}`, url: `http://localhost:${port}/about`, page: join(copy, 'source/templates/about/page.tsx'), failures: () => failed, log, results })
  } finally {
    await closeWatcher()
    await stopNext()
    await removeCopy()
  }
}

async function runProject(bundler, results) {
  const page = join(PROJECT, option('page', 'templates/(public)/page.tsx'))
  const breakFile = BREAK_FILE ? join(PROJECT, BREAK_FILE) : page
  const bin = join(PROJECT, 'node_modules/.bin/nextspark')
  if (!existsSync(bin)) throw new Error(`${PROJECT} has no node_modules/.bin/nextspark`)
  const restore = [...new Set([page, breakFile])].map(file => {
    const content = readFileSync(file, 'utf8')
    return onCleanup(() => writeFileSync(file, content))
  })
  const port = await freePort()
  const log = []
  let next = null
  const stopNext = onCleanup(() => stop(next))
  try {
    next = spawn(bin, ['dev', '-p', String(port), ...(bundler === 'webpack' ? ['--webpack'] : [])], {
      cwd: PROJECT,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })
    for (const stream of [next.stdout, next.stderr]) stream.on('data', chunk => log.push(String(chunk)))
    const failures = () => log.join('').split('[prepare] Regeneration failed').length - 1
    await scenarios({ label: `project ${bundler}`, url: `http://localhost:${port}${option('path', '/')}`, page, breakFile, failures, log, results })
  } finally {
    for (const run of restore) await run()
    await stopNext()
  }
}

const results = []
for (const [bundler, mode] of RUNS) {
  try {
    if (PROJECT) await runProject(bundler, results)
    else await runFixture(bundler, mode, results)
  } catch (error) {
    results.push({ label: `${bundler} ${mode ?? ''}`, name: 'run', ok: false, detail: error.message })
    console.log(`FAIL [${bundler} ${mode ?? ''}] ${error.message}`)
  }
}
const failed = results.filter(result => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
