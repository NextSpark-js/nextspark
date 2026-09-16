import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
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

test('killProcessGroup uses taskkill /T /F on win32 instead of a POSIX group signal, and skips the fallback once confirmed gone', () => {
  const taskkillCalls = []
  const killCalls = []
  const { result: ok, logs } = withCapturedLog(() =>
    killProcessGroup(4242, {
      platform: 'win32',
      spawnTaskkill: (...args) => {
        taskkillCalls.push(args)
        return { error: null, status: 0, stderr: '' }
      },
      kill: (...args) => killCalls.push(args),
      isRunning: () => false,
    }),
  )
  assert.equal(taskkillCalls.length, 1)
  assert.deepEqual(taskkillCalls[0].slice(0, 2), ['taskkill', ['/pid', '4242', '/T', '/F']])
  assert.equal(typeof taskkillCalls[0][2]?.timeout, 'number', 'taskkill must be bounded by a timeout')
  assert.deepEqual(killCalls, [])
  assert.equal(ok, true)
  assert.ok(
    !logs.some((line) => line.includes('is still running')),
    `a confirmed-gone leader must not also be reported as still running:\n${logs.join('\n')}`,
  )
})

// Each of the next three stands in for one way taskkill can fail to actually
// end the pid - missing, refused, or lying about success - forced through
// `platform: 'win32'` on whatever OS the suite runs on. The fallback itself
// (`kill(pid, 'SIGKILL')`) is not faked: on a POSIX runner this is a real
// SIGKILL to a real spawned child, which is the part `taskkill` itself
// cannot be exercised for outside Windows.
test('killProcessGroup on win32 falls back past a taskkill that is not on PATH, and actually ends the process', async () => {
  const child = spawn(...LONG_RUNNING, { stdio: 'ignore' })
  await new Promise((resolve) => setTimeout(resolve, 200))
  const { result: ok, logs } = withCapturedLog(() =>
    killProcessGroup(child.pid, {
      platform: 'win32',
      spawnTaskkill: () => ({ error: Object.assign(new Error('spawn taskkill ENOENT'), { code: 'ENOENT' }) }),
    }),
  )
  try {
    assert.ok(logs.some((line) => line.includes('taskkill did not run') && line.includes('ENOENT')))
    assert.ok(
      ok === true || logs.some((line) => line.includes(`pid ${child.pid} is still running`)),
      `must either confirm the pid gone or fail naming it:\n${logs.join('\n')}`,
    )
    assert.ok(await waitUntil(() => !isRunning(child.pid), 5_000), 'the child must actually terminate despite the missing taskkill')
  } finally {
    if (isRunning(child.pid)) process.kill(child.pid, 'SIGKILL')
  }
})

test('killProcessGroup on win32 falls back past a taskkill that exits non-zero (e.g. access denied), and actually ends the process', async () => {
  const child = spawn(...LONG_RUNNING, { stdio: 'ignore' })
  await new Promise((resolve) => setTimeout(resolve, 200))
  const { result: ok, logs } = withCapturedLog(() =>
    killProcessGroup(child.pid, {
      platform: 'win32',
      spawnTaskkill: () => ({ error: null, status: 5, stderr: 'ERROR: Access is denied.\n' }),
    }),
  )
  try {
    assert.ok(logs.some((line) => line.includes('taskkill exited 5') && line.includes('Access is denied')))
    assert.ok(
      ok === true || logs.some((line) => line.includes(`pid ${child.pid} is still running`)),
      `must either confirm the pid gone or fail naming it:\n${logs.join('\n')}`,
    )
    assert.ok(await waitUntil(() => !isRunning(child.pid), 5_000), 'the child must actually terminate despite the refused taskkill')
  } finally {
    if (isRunning(child.pid)) process.kill(child.pid, 'SIGKILL')
  }
})

test('killProcessGroup on win32 does not trust a taskkill that exits 0 without having killed anything, and still ends the process', async () => {
  const child = spawn(...LONG_RUNNING, { stdio: 'ignore' })
  await new Promise((resolve) => setTimeout(resolve, 200))
  const { result: ok, logs } = withCapturedLog(() =>
    killProcessGroup(child.pid, {
      platform: 'win32',
      // Reports success without touching the process, like a taskkill that
      // raced the process's own exit or missed a re-parented descendant.
      spawnTaskkill: () => ({ error: null, status: 0, stderr: '' }),
    }),
  )
  try {
    assert.ok(
      ok === true || logs.some((line) => line.includes(`pid ${child.pid} is still running`)),
      `must either confirm the pid gone or fail naming it:\n${logs.join('\n')}`,
    )
    assert.ok(await waitUntil(() => !isRunning(child.pid), 5_000), 'the child must actually terminate even though taskkill claimed success')
  } finally {
    if (isRunning(child.pid)) process.kill(child.pid, 'SIGKILL')
  }
})

test('killProcessGroup on win32 fails and names only the leader pid when it is still running after taskkill and the fallback kill', () => {
  const killCalls = []
  const { result: ok, logs } = withCapturedLog(() =>
    killProcessGroup(4242, {
      platform: 'win32',
      spawnTaskkill: () => ({ error: null, status: 0, stderr: '' }),
      kill: (...args) => killCalls.push(args),
      isRunning: () => true,
    }),
  )
  assert.equal(ok, false)
  assert.deepEqual(killCalls, [[4242, 'SIGKILL']], 'the fallback kill must still be attempted')
  assert.ok(logs.some((line) => line.includes('pid 4242 is still running after taskkill and the fallback kill')))
  assert.ok(
    !logs.some((line) => line.includes('after killing pid')),
    `an unconfirmed kill must never be phrased as already done:\n${logs.join('\n')}`,
  )
})

// The decision behind this shape: a walk of Win32_Process can always miss a
// grandchild spawned after it queried its parent, so no enumeration this
// script could write proves the tree taskkill was asked to end is actually
// empty (round 14 of #196). killProcessGroup therefore never enumerates
// descendants and never turns one into a kill target; it only confirms the
// leader and always says plainly that the rest of the tree is unconfirmed.
test('killProcessGroup on win32 always reports descendants as unconfirmed, without enumerating or naming one to kill', () => {
  const { logs } = withCapturedLog(() =>
    killProcessGroup(4242, {
      platform: 'win32',
      spawnTaskkill: () => ({ error: null, status: 0, stderr: '' }),
      isRunning: () => false,
    }),
  )
  const disclaimer = logs.find((line) => line.includes('descendants may still be running'))
  assert.ok(disclaimer, `must always disclose that descendants are unconfirmed:\n${logs.join('\n')}`)
  assert.match(disclaimer, /cannot confirm/i)
  assert.match(disclaimer, /lists processes by parent/i)
  assert.ok(disclaimer.includes('4242'), 'the disclaimer must name the leader pid taskkill was asked to end')
  assert.ok(!disclaimer.includes('taskkill /PID'), 'the disclaimer must never turn an unconfirmed descendant into a kill command')
})

test('killProcessGroup on win32 reports the same unconfirmed-descendants disclaimer even when the leader is confirmed gone', () => {
  const { result: ok, logs } = withCapturedLog(() =>
    killProcessGroup(4242, {
      platform: 'win32',
      spawnTaskkill: () => ({ error: null, status: 0, stderr: '' }),
      isRunning: () => false,
    }),
  )
  assert.equal(ok, true, 'the leader confirmed gone is what this call can vouch for')
  assert.ok(
    logs.some((line) => line.includes('descendants may still be running')),
    `confirming the leader must not be read as confirming its descendants too:\n${logs.join('\n')}`,
  )
})

test('killProcessGroup does not wait out a taskkill that hangs past its timeout', () => {
  const started = Date.now()
  const { result: ok, logs } = withCapturedLog(() =>
    killProcessGroup(4242, {
      platform: 'win32',
      // A real child outliving the timeout, run through the real spawnSync so
      // the `timeout` this passes through options is exercised for real
      // instead of a mocked return value.
      spawnTaskkill: (command, args, options) => spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 2_000)'], options),
      isRunning: () => false,
      taskkillTimeoutMs: 200,
    }),
  )
  const elapsed = Date.now() - started
  assert.ok(elapsed < 1_500, `killProcessGroup must give up around taskkillTimeoutMs instead of waiting out the hang (${elapsed}ms)`)
  assert.ok(
    logs.some((line) => line.includes('taskkill did not run for pid 4242') && line.includes('did not finish within')),
    logs.join('\n'),
  )
  assert.equal(ok, true, 'an already-gone leader still counts as confirmed once taskkill itself is given up on')
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

// Guards the call site itself, not just killProcessGroup's own handling of a
// killLeader it is given: an injected killProcessGroup like the tests above
// only proves exec() calls *some* function, not that it threads the timed-out
// child's own handle through. A killLeader silently dropped from this call
// site would still pass every test above.
test('exec passes the timed-out child\'s own handle as killLeader, not just its pid', async () => {
  let capturedPid
  let capturedKillLeader
  const { result } = await withCapturedLogAsync(() =>
    exec(...LONG_RUNNING, process.cwd(), {
      timeoutMs: 50,
      killFallbackMs: 100,
      killProcessGroup: (pid, options) => {
        capturedPid = pid
        capturedKillLeader = options?.killLeader
        return true
      },
    }),
  )
  try {
    assert.equal(result, false)
    assert.equal(typeof capturedKillLeader, 'function', 'exec must pass killLeader to killProcessGroup')
    assert.ok(isRunning(capturedPid), 'the fake kill above never actually signalled the child')
    capturedKillLeader()
    assert.ok(await waitUntil(() => !isRunning(capturedPid), 5_000), "killLeader must end the child through its own handle")
  } finally {
    if (isRunning(capturedPid)) process.kill(capturedPid, 'SIGKILL')
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

// Same gap as the exec test above, for the other real call site: an injected
// killProcessGroup only proves cancelActiveChildrenAndExit calls it, not that
// it threads each active child's own handle through as killLeader.
test("cancelActiveChildrenAndExit passes each active child's own handle as killLeader, not just its pid", async () => {
  let capturedPid
  let capturedKillLeader
  const stepPromise = step('hang', () => exec(...LONG_RUNNING, process.cwd()))

  // Give the child time to actually spawn before the cancel tries to kill it.
  await new Promise((resolve) => setTimeout(resolve, 200))

  let exitCode
  await cancelActiveChildrenAndExit(1, {
    exit: (code) => { exitCode = code },
    cleanupTimeoutMs: 100,
    killProcessGroup: (pid, options) => {
      capturedPid = pid
      capturedKillLeader = options?.killLeader
      return true
    },
  })

  try {
    assert.equal(exitCode, 1)
    assert.equal(typeof capturedKillLeader, 'function', 'cancelActiveChildrenAndExit must pass killLeader for each active child')
    assert.ok(isRunning(capturedPid), 'the fake kill above never actually signalled the child')
    capturedKillLeader()
    assert.ok(await waitUntil(() => !isRunning(capturedPid), 5_000), "killLeader must end the child through its own handle")
  } finally {
    if (isRunning(capturedPid)) process.kill(capturedPid, 'SIGKILL')
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
