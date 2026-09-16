import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { copyFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { isMainModule } from './mobile-verify.mjs'

// Kept out of mobile-verify.test.mjs: the integration test below runs a copy
// of mobile-verify.mjs for real, whose first step is `node --test
// mobile-verify.test.mjs` - inside that file, it would run itself again.

const HERE = dirname(fileURLToPath(import.meta.url))

test('isMainModule matches a path with a space the way node actually invokes it', () => {
  const argv1 = '/repo/scripts with space/mobile-verify.mjs'
  assert.equal(isMainModule(pathToFileURL(argv1).href, argv1), true)
})

test('isMainModule rejects a path it was not invoked from', () => {
  const argv1 = '/repo/scripts/mobile-verify.mjs'
  assert.equal(isMainModule(pathToFileURL('/repo/scripts/some-other-file.mjs').href, argv1), false)
})

test('isMainModule matches on Windows, where import.meta.url and argv1 disagree on slashes, drive-letter form, and casing of the encoding', () => {
  const windowsToFileURL = (path) => pathToFileURL(path, { windows: true })
  const argv1 = 'C:\\repo\\scripts\\packages\\mobile-verify.mjs'
  assert.equal(isMainModule(windowsToFileURL(argv1).href, argv1, { toFileURL: windowsToFileURL }), true)
  assert.equal(
    // The old `file://${argv1}` comparison this replaces would have failed here.
    windowsToFileURL(argv1).href === `file://${argv1}`,
    false,
  )
})

test('mobile:verify actually runs when invoked from a path containing a space', async () => {
  // The copy sits next to the real script (same directory depth), so
  // REPO_ROOT - computed from the copy's own location - still resolves to
  // the real repo and the run gets as far as its first real step, instead
  // of a throwaway copy elsewhere that would fail before proving anything.
  const spacedCopy = join(HERE, 'mobile-verify (space regression copy).mjs')
  copyFileSync(join(HERE, 'mobile-verify.mjs'), spacedCopy)

  // detached so the whole process group (main() would otherwise go on to
  // install and typecheck apps/mobile for real) can be killed at once, the
  // moment there is enough output to prove the guard let main() run.
  const child = spawn(process.execPath, [spacedCopy], { cwd: join(HERE, '../..'), detached: true })
  let output = ''
  let exited = false
  child.once('exit', () => { exited = true })
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })

  try {
    const deadline = Date.now() + 10_000
    while (!exited && Date.now() < deadline && !/This script's process-group teardown/.test(output)) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.match(output, /NextSpark - Mobile Verify/, 'main() must run and print its banner')
    assert.match(
      output,
      /This script's process-group teardown/,
      'the guard must let main() reach its first real step, not just print the banner and stop',
    )
  } finally {
    if (!exited) {
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        // already gone
      }
    }
    rmSync(spacedCopy, { force: true })
  }
})
