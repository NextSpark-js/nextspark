import { test } from 'node:test'
import assert from 'node:assert/strict'

import { exec, step, killProcessGroup, cancelActiveChildrenAndExit } from './mobile-verify.mjs'

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

test('killProcessGroup on POSIX re-throws errors other than ESRCH', () => {
  const error = Object.assign(new Error('not permitted'), { code: 'EPERM' })
  assert.throws(() => killProcessGroup(1, { platform: 'linux', kill: () => { throw error } }), /not permitted/)
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
  killProcessGroup(unkilledPid)
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
