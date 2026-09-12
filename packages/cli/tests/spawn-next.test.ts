import { test } from 'node:test'
import assert from 'node:assert/strict'

import { npxInvocation, quoteForWindowsShell } from '../src/utils/spawn-next.js'

const onWindows = process.platform === 'win32'

// The arguments are the user's own, forwarded to Next verbatim. A shell would
// split this one at the ampersand and background the rest.
const AWKWARD = 'https://trace.invalid/upload?run=1&team=alpha'

test('off Windows, nothing goes through a shell', { skip: onWindows }, () => {
  const invocation = npxInvocation(['next', 'build', '--experimental-upload-trace', AWKWARD])

  assert.equal(invocation.command, 'npx')
  assert.equal(invocation.shell, false)
  assert.deepEqual(invocation.args, ['next', 'build', '--experimental-upload-trace', AWKWARD])
})

test('on Windows the shell is unavoidable, so the arguments are quoted', { skip: !onWindows }, () => {
  const invocation = npxInvocation(['next', 'build', AWKWARD])

  assert.equal(invocation.command, 'npx.cmd')
  assert.equal(invocation.shell, true)
  assert.equal(invocation.args[0], 'next')
  assert.match(invocation.args[2], /^".*"$/)
})

test('quoting leaves an ordinary argument alone', () => {
  assert.equal(quoteForWindowsShell('next'), 'next')
  assert.equal(quoteForWindowsShell('--turbopack'), '--turbopack')
  assert.equal(quoteForWindowsShell('-p'), '-p')
})

test('quoting wraps what cmd.exe would otherwise read as syntax', () => {
  for (const argument of [AWKWARD, 'a b', 'x|y', 'x>y', 'say "hi"', '%PATH%', '']) {
    const quoted = quoteForWindowsShell(argument)

    assert.match(quoted, /^".*"$/, `not quoted: ${argument}`)
  }
})
