import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { exec, step, killProcessGroup, cancelActiveChildrenAndExit } from './mobile-verify.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// A child that outlives every time limit below unless something kills it.
const LONG_RUNNING = [process.execPath, ['-e', 'setTimeout(() => {}, 30_000)']]

const POSIX_ONLY = process.platform === 'win32' ? 'Windows has no process groups' : false

/**
 * A leader that starts a long-running process in its own process group
 * without waiting for it, records both pids in pidsFile, and exits 0.
 */
function leaderLeavingStraggler(pidsFile) {
  return `
    const { spawn } = require('node:child_process')
    const { writeFileSync } = require('node:fs')
    const straggler = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30_000)'], { stdio: 'ignore' })
    writeFileSync(${JSON.stringify(pidsFile)}, JSON.stringify({ leaderPid: process.pid, stragglerPid: straggler.pid }))
    straggler.unref()
  `
}

function withCapturedLog(run) {
  const logs = []
  const originalLog = console.log
  console.log = (line) => logs.push(line)
  try {
    return { result: run(), logs }
  } finally {
    console.log = originalLog
  }
}

async function withCapturedLogAsync(run) {
  const logs = []
  const originalLog = console.log
  console.log = (line) => logs.push(line)
  try {
    return { result: await run(), logs }
  } finally {
    console.log = originalLog
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

async function waitUntil(condition, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return condition()
}

/** Kills a child's process group for real and waits until its leader is gone. */
async function killForReal(pid) {
  killProcessGroup(pid)
  assert.ok(await waitUntil(() => !isRunning(pid), 5_000), `pid ${pid} must be gone after the test kills it`)
}

test('killProcessGroup uses taskkill /T /F on win32 instead of a POSIX group signal, and reports success', () => {
  const taskkillCalls = []
  const killCalls = []
  const ok = killProcessGroup(4242, {
    platform: 'win32',
    spawnTaskkill: (...args) => {
      taskkillCalls.push(args)
      return { error: null, status: 0, stderr: '' }
    },
    kill: (...args) => killCalls.push(args),
  })
  assert.deepEqual(taskkillCalls, [['taskkill', ['/pid', '4242', '/T', '/F']]])
  assert.deepEqual(killCalls, [])
  assert.equal(ok, true)
})

test('killProcessGroup on win32 reports failure when taskkill is not on PATH', () => {
  const { result: ok, logs } = withCapturedLog(() =>
    killProcessGroup(4242, {
      platform: 'win32',
      spawnTaskkill: () => ({ error: Object.assign(new Error('spawn taskkill ENOENT'), { code: 'ENOENT' }) }),
    }),
  )
  assert.equal(ok, false)
  assert.ok(logs.some((line) => line.includes('taskkill did not run') && line.includes('ENOENT')))
})

test('killProcessGroup on win32 reports failure when taskkill exits non-zero (e.g. access denied)', () => {
  const { result: ok, logs } = withCapturedLog(() =>
    killProcessGroup(4242, {
      platform: 'win32',
      spawnTaskkill: () => ({ error: null, status: 5, stderr: 'ERROR: Access is denied.\n' }),
    }),
  )
  assert.equal(ok, false)
  assert.ok(logs.some((line) => line.includes('taskkill exited 5') && line.includes('Access is denied')))
})

test('killProcessGroup signals the POSIX process group on every other platform', () => {
  const taskkillCalls = []
  const killCalls = []
  killProcessGroup(4242, {
    platform: 'darwin',
    spawnTaskkill: (...args) => taskkillCalls.push(args),
    kill: (...args) => killCalls.push(args),
  })
  assert.deepEqual(killCalls, [[-4242, 'SIGKILL']])
  assert.deepEqual(taskkillCalls, [])
})

test('killProcessGroup on POSIX swallows ESRCH from an already-dead process', () => {
  const error = Object.assign(new Error('no such process'), { code: 'ESRCH' })
  assert.doesNotThrow(() => killProcessGroup(1, { platform: 'linux', kill: () => { throw error } }))
})

test('killProcessGroup on POSIX reports failure instead of throwing when the group cannot be signaled', () => {
  const error = Object.assign(new Error('not permitted'), { code: 'EPERM' })
  const { result: ok, logs } = withCapturedLog(() =>
    killProcessGroup(1, { platform: 'linux', kill: () => { throw error } }),
  )
  assert.equal(ok, false)
  assert.ok(logs.some((line) => line.includes('Could not confirm process group 1 was killed') && line.includes('not permitted')))
})

test("cancelActiveChildrenAndExit waits for the active step's finally before exiting", async () => {
  let cleanedUp = false
  const stepPromise = step('hang', async () => {
    try {
      return await exec('sleep', ['30'], process.cwd())
    } finally {
      cleanedUp = true
    }
  })

  // Give the child time to actually spawn before it gets killed.
  await new Promise((resolve) => setTimeout(resolve, 200))

  let exitCode
  await cancelActiveChildrenAndExit(1, { exit: (code) => { exitCode = code } })

  assert.equal(cleanedUp, true, "the active step's finally must run before exit is called")
  assert.equal(exitCode, 1)

  await stepPromise
})

test('exec gives up on a step instead of hanging forever when its kill signal is never confirmed', async () => {
  let unkilledPid
  const { result, logs } = await (async () => {
    const originalLog = console.log
    const collected = []
    console.log = (line) => collected.push(line)
    try {
      // The fake killProcessGroup never actually signals the child, like a
      // missing or refused taskkill on Windows would.
      const value = await exec('sleep', ['5'], process.cwd(), {
        timeoutMs: 50,
        killFallbackMs: 100,
        killProcessGroup: (pid) => {
          unkilledPid = pid
          return false
        },
      })
      return { result: value, logs: collected }
    } finally {
      console.log = originalLog
    }
  })()

  assert.equal(result, false)
  assert.ok(logs.some((line) => line.includes('Gave up waiting') && line.includes('never confirmed delivered')))

  // The fake kill above never actually signaled the child; do it for real.
  await killForReal(unkilledPid)
})

test('exec gives up on a step whose process is still running after its kill was delivered', async () => {
  let unkilledPid
  const started = Date.now()
  // Stands in for a SIGKILL that has not taken effect: the signal was sent,
  // but the process does not exit.
  const { result, logs } = await withCapturedLogAsync(() =>
    exec(...LONG_RUNNING, process.cwd(), {
      timeoutMs: 50,
      killFallbackMs: 100,
      killProcessGroup: (pid) => {
        unkilledPid = pid
        return true
      },
    }),
  )
  const elapsed = Date.now() - started

  try {
    assert.equal(result, false)
    assert.ok(elapsed < 5_000, `exec must give up about killFallbackMs after the timeout, not wait for the child (${elapsed}ms)`)
    assert.ok(logs.some((line) => line.includes(`Gave up waiting for pid ${unkilledPid}`) && line.includes('left running')))
  } finally {
    await killForReal(unkilledPid)
  }
})

test('exec fails a step that ran past its time limit even when its process then exits 0', async () => {
  // Whether or not the kill reports success, a process it did not stop can
  // still finish on its own before exec gives up on it.
  for (const delivered of [true, false]) {
    const { result, logs } = await withCapturedLogAsync(() =>
      exec(process.execPath, ['-e', 'setTimeout(() => {}, 300)'], process.cwd(), {
        timeoutMs: 50,
        killFallbackMs: 10_000,
        killProcessGroup: () => delivered,
      }),
    )
    assert.equal(result, false, `a step past its time limit must fail (kill reported delivered: ${delivered})`)
    assert.ok(
      logs.some((line) => line.includes('Exited with code 0 after the time limit')),
      `the late exit must be reported as past the limit (kill reported delivered: ${delivered})`,
    )
  }
})

test('exec lets this script exit, and its output end, once it gives up on a child it cannot kill, and says the child is left running', async () => {
  // Runs in a process of its own: whether exec still holds the event loop
  // open, or lets the child hold the script's output, only shows in whether
  // that process's output ever ends.
  const harness = `
    import { exec } from ${JSON.stringify(pathToFileURL(join(HERE, 'mobile-verify.mjs')).href)}
    const ok = await exec(process.execPath, ['-e', 'setTimeout(() => {}, 30_000)'], process.cwd(), {
      timeoutMs: 50,
      killFallbackMs: 100,
      killProcessGroup: (pid) => {
        console.log('child pid ' + pid)
        return false
      },
    })
    console.log('step ok=' + ok)
  `
  const harnessDir = mkdtempSync(join(tmpdir(), 'mobile-verify-exec-'))
  const harnessFile = join(harnessDir, 'harness.mjs')
  writeFileSync(harnessFile, harness)
  const child = spawn(process.execPath, [harnessFile], { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  let exitCode
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  // `close`, not `exit`: a child left holding the harness's stdout would keep
  // this pipe open, as it would for a CI step reading mobile:verify's output.
  child.once('close', (code) => { exitCode = code })

  let unkilledPid
  try {
    const closed = await waitUntil(() => exitCode !== undefined, 5_000)
    unkilledPid = Number(output.match(/child pid (\d+)/)?.[1]) || undefined
    assert.ok(closed, `the script must exit, and its output end, on its own once exec gave up on the child:\n${output}`)
    assert.equal(exitCode, 0, output)
    assert.match(output, /step ok=false/)
    assert.match(output, new RegExp(`Gave up waiting for pid ${unkilledPid} .*left running`))
    assert.ok(isRunning(unkilledPid), 'the child reported as left running must actually still be running')
  } finally {
    if (exitCode === undefined) child.kill('SIGKILL')
    if (unkilledPid) await killForReal(unkilledPid)
    rmSync(harnessDir, { recursive: true, force: true })
  }
})

test('cancelActiveChildrenAndExit names the children it could not kill before exiting', async () => {
  let unkilledPid
  const stepPromise = step('unkillable', () => exec(...LONG_RUNNING, process.cwd()))

  // Give the child time to actually spawn before the cancel tries to kill it.
  await new Promise((resolve) => setTimeout(resolve, 200))

  let exitCode
  const { logs } = await withCapturedLogAsync(() =>
    cancelActiveChildrenAndExit(1, {
      exit: (code) => { exitCode = code },
      cleanupTimeoutMs: 100,
      killProcessGroup: (pid) => {
        unkilledPid = pid
        return false
      },
    }),
  )

  try {
    assert.equal(exitCode, 1)
    assert.ok(unkilledPid, 'the cancel must try to kill the active child')
    assert.ok(
      logs.some((line) => line.includes(`Left running: pid ${unkilledPid}`)),
      `the cancel must name the child it left running:\n${logs.join('\n')}`,
    )
  } finally {
    if (unkilledPid) await killForReal(unkilledPid)
    await stepPromise
  }
})

test('cancelActiveChildrenAndExit neither crashes on nor names a child that exited just before the cancel', async () => {
  let childPid
  const stepPromise = step('already exited', () => exec(process.execPath, ['-e', 'process.exit(0)'], process.cwd()))

  // Blocks the event loop while the child starts and exits, so node has not
  // reaped it when the cancel kills its group: the child is still tracked,
  // and on macOS kill(-pid) on a group holding only a zombie fails with EPERM.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000)

  let exitCode
  let logs
  let stepPassed
  try {
    ;({ logs } = await withCapturedLogAsync(() =>
      cancelActiveChildrenAndExit(1, {
        exit: (code) => { exitCode = code },
        cleanupTimeoutMs: 5_000,
        killProcessGroup: (pid) => {
          childPid = pid
          return killProcessGroup(pid)
        },
      }),
    ))
  } finally {
    // Lets node reap the child even if the cancel threw, so the next test
    // does not find it still tracked.
    stepPassed = await stepPromise
  }

  assert.equal(exitCode, 1)
  assert.ok(childPid, 'the cancel must find the unreaped child still tracked')
  if (process.platform === 'darwin') {
    assert.ok(logs.some((line) => line.includes('EPERM')), `the group kill must have hit the unreaped child:\n${logs.join('\n')}`)
  }
  assert.ok(!logs.some((line) => line.includes('Left running')), `an exited child is not left running:\n${logs.join('\n')}`)
  assert.equal(stepPassed, true)
})

test("cancelActiveChildrenAndExit gives up and exits anyway when a step's own cleanup hangs", async () => {
  const stepPromise = step('stuck cleanup', async () => {
    try {
      return true
    } finally {
      await new Promise(() => {}) // simulates a finally that never returns
    }
  })

  const { result: exitCode, logs } = await (async () => {
    const originalLog = console.log
    const collected = []
    console.log = (line) => collected.push(line)
    try {
      let code
      await cancelActiveChildrenAndExit(1, {
        exit: (c) => { code = c },
        cleanupTimeoutMs: 100,
      })
      return { result: code, logs: collected }
    } finally {
      console.log = originalLog
    }
  })()

  assert.equal(exitCode, 1, 'must exit anyway instead of hanging on the stuck finally')
  assert.ok(logs.some((line) => line.includes('Gave up waiting for the active step')))

  void stepPromise // deliberately left pending: its finally never resolves
})

test('exec kills the processes a step leaves in its process group when its leader exits, and says so', { skip: POSIX_ONLY }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mobile-verify-straggler-'))
  const pidsFile = join(dir, 'pids.json')
  let pids
  try {
    const { result, logs } = await withCapturedLogAsync(() =>
      exec(process.execPath, ['-e', leaderLeavingStraggler(pidsFile)], process.cwd()),
    )
    pids = JSON.parse(readFileSync(pidsFile, 'utf8'))

    assert.equal(result, true, 'the leader itself exited 0')
    assert.ok(
      logs.some((line) => line.includes(`Process group ${pids.leaderPid}`) && line.includes('killing them')),
      `the straggler must be reported:\n${logs.join('\n')}`,
    )
    assert.ok(await waitUntil(() => !isRunning(pids.stragglerPid), 5_000), 'the straggler must be killed with its group')
  } finally {
    if (pids && isRunning(pids.stragglerPid)) process.kill(pids.stragglerPid, 'SIGKILL')
    rmSync(dir, { recursive: true, force: true })
  }
})

test('exec stops reading a straggler that holds its output once outputDrainMs has passed', { skip: POSIX_ONLY }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mobile-verify-straggler-'))
  const pidsFile = join(dir, 'pids.json')
  const leader = leaderLeavingStraggler(pidsFile).replace(`{ stdio: 'ignore' }`, `{ stdio: 'inherit' }`)
  let pids
  const started = Date.now()
  try {
    // The kill reports success without stopping the straggler, which keeps
    // the leader's stdout and stderr open.
    const { result } = await withCapturedLogAsync(() =>
      exec(process.execPath, ['-e', leader], process.cwd(), { outputDrainMs: 200, killProcessGroup: () => true }),
    )
    pids = JSON.parse(readFileSync(pidsFile, 'utf8'))
    assert.equal(result, true, 'the leader itself exited 0')
    assert.ok(Date.now() - started < 5_000, `exec must not wait for the straggler to release its output (${Date.now() - started}ms)`)
    assert.ok(isRunning(pids.stragglerPid), 'the straggler was not killed, so exec returned without it')
  } finally {
    if (pids) {
      killProcessGroup(pids.leaderPid)
      assert.ok(await waitUntil(() => !isRunning(pids.stragglerPid), 5_000), 'the straggler must be gone after the test kills it')
    }
    rmSync(dir, { recursive: true, force: true })
  }
})

// Last in this file: the stray groups it leaves tracked would otherwise be
// more pids the injected kills of the cancel tests above receive.
test('cancelActiveChildrenAndExit names a stray process group its kill did not stop', { skip: POSIX_ONLY }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mobile-verify-straggler-'))
  const leaders = []
  try {
    // Whether the kill reports it was delivered or not, the straggler lives.
    for (const delivered of [false, true]) {
      const pidsFile = join(dir, `pids-${delivered}.json`)
      const { logs } = await withCapturedLogAsync(() =>
        exec(process.execPath, ['-e', leaderLeavingStraggler(pidsFile)], process.cwd(), { killProcessGroup: () => delivered }),
      )
      leaders.push(JSON.parse(readFileSync(pidsFile, 'utf8')))
      assert.ok(logs.some((line) => line.includes('killing them')), logs.join('\n'))
    }

    let exitCode
    const { logs } = await withCapturedLogAsync(() =>
      cancelActiveChildrenAndExit(1, { exit: (code) => { exitCode = code }, cleanupTimeoutMs: 100, killProcessGroup: () => false }),
    )
    assert.equal(exitCode, 1)
    for (const { leaderPid } of leaders) {
      assert.ok(
        logs.some((line) => line.includes(`Left running: process group ${leaderPid}`)),
        `the cancel must name stray group ${leaderPid}:\n${logs.join('\n')}`,
      )
    }
  } finally {
    for (const { leaderPid, stragglerPid } of leaders) {
      killProcessGroup(leaderPid)
      assert.ok(await waitUntil(() => !isRunning(stragglerPid), 5_000), 'the straggler must be gone after the test kills it')
    }
    rmSync(dir, { recursive: true, force: true })
  }
})
