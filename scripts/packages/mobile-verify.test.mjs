import { test } from 'node:test'
import assert from 'node:assert/strict'

import { exec, step, killProcessGroup, cancelActiveChildrenAndExit } from './mobile-verify.mjs'

test('killProcessGroup uses taskkill /T /F on win32 instead of a POSIX group signal', () => {
  const taskkillCalls = []
  const killCalls = []
  killProcessGroup(4242, {
    platform: 'win32',
    spawnTaskkill: (...args) => taskkillCalls.push(args),
    kill: (...args) => killCalls.push(args),
  })
  assert.deepEqual(taskkillCalls, [['taskkill', ['/pid', '4242', '/T', '/F']]])
  assert.deepEqual(killCalls, [])
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
